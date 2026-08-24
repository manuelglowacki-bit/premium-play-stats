import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Vérification du code d'invitation, côté SERVEUR uniquement.
//
// Le code est stocké dans la table app_invite (une seule ligne), régénérable
// à tout moment depuis Admin → Réglages. Il n'est JAMAIS envoyé au
// navigateur : la page d'inscription transmet ce que le joueur a tapé, et
// c'est ici, sur le serveur, que la comparaison a lieu.
//
// La lecture utilise la clé de service, seule habilitée : la politique RLS
// de app_invite n'autorise personne d'autre que l'admin, donc même un joueur
// déjà connecté ne peut pas récupérer le code pour le diffuser.
//
// Ce que ça protège : quelqu'un qui tombe sur l'adresse du site ne peut pas
// créer de compte. Ce que ça ne protège pas : quelqu'un de techniquement
// averti peut encore appeler Supabase directement. Pour fermer complètement,
// il faut désactiver l'inscription publique dans Supabase et créer les
// comptes depuis l'Admin.

function reponse(res: VercelResponse, statut: number, corps: Record<string, unknown>) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(statut).json(corps);
}

function safeParse(valeur: string): unknown {
  try {
    return JSON.parse(valeur);
  } catch {
    return {};
  }
}

async function codeAttendu(): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await client.from("app_invite").select("code").eq("id", 1).maybeSingle();
    if (error) return null;
    const code = String(data?.code ?? "").trim();
    return code || null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return reponse(res, 405, { ok: false, raison: "methode" });
  }

  const attendu = await codeAttendu();

  // Aucun code disponible (table absente, clé de service manquante) : on
  // REFUSE au lieu de laisser passer. Une panne de configuration ne doit
  // jamais rouvrir les inscriptions à tout le monde.
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
