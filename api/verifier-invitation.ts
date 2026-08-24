import type { VercelRequest, VercelResponse } from "@vercel/node";

// Vérification du code d'invitation, côté SERVEUR uniquement.
//
// Pourquoi une route API plutôt qu'un simple test dans la page : tout ce qui
// est écrit dans le code du site est téléchargé par le navigateur et donc
// lisible par n'importe qui. Un code écrit dans src/ serait visible en clair
// dans le fichier JavaScript. Ici il vit dans une variable d'environnement
// Vercel (PRONO_INVITE_CODE), jamais envoyée au navigateur — exactement le
// même principe que le jeton football-data.org des autres routes.
//
// Ce que ça protège : quelqu'un qui tombe sur l'adresse du site ne peut pas
// créer de compte sans le code. Ce que ça ne protège pas : quelqu'un de
// techniquement averti peut encore appeler Supabase directement. Pour fermer
// complètement, il faut désactiver l'inscription publique dans Supabase et
// créer les comptes depuis l'Admin.

function reponse(res: VercelResponse, statut: number, corps: Record<string, unknown>) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(statut).json(corps);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return reponse(res, 405, { ok: false, raison: "methode" });
  }

  const attendu = (process.env.PRONO_INVITE_CODE ?? "").trim();

  // Aucun code configuré : on REFUSE au lieu de laisser passer. Un oubli de
  // configuration ne doit jamais rouvrir les inscriptions à tout le monde.
  if (!attendu) {
    return reponse(res, 503, { ok: false, raison: "non-configure" });
  }

  const brut = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const fourni = String((brut as any)?.code ?? "").trim();

  if (!fourni) {
    return reponse(res, 400, { ok: false, raison: "vide" });
  }

  // Comparaison insensible à la casse et aux espaces : un code recopié depuis
  // un message WhatsApp arrive souvent avec une majuscule ou un espace final.
  const valide = fourni.toLowerCase() === attendu.toLowerCase();

  return reponse(res, valide ? 200 : 403, { ok: valide, raison: valide ? null : "invalide" });
}

function safeParse(valeur: string): unknown {
  try {
    return JSON.parse(valeur);
  } catch {
    return {};
  }
}
