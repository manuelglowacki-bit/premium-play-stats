import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Adresses e-mail des joueurs et liste de ceux qui ont active les
// notifications, pour les onglets Admin → Joueurs et Admin → Suivi pronos.
//
// Les e-mails vivent dans auth.users, une table que le navigateur ne peut pas
// lire : seule la clé de service y accède. D'où cette route.
//
// ELLE EST RÉSERVÉE AUX ADMINS. Sans ce contrôle, n'importe qui pourrait
// appeler l'adresse et récupérer les 23 adresses e-mail de la ligue. Le
// navigateur envoie donc son jeton de session, le serveur vérifie qui il est,
// puis vérifie que profiles.is_admin est vrai pour cette personne.

function reponse(res: VercelResponse, statut: number, corps: Record<string, unknown>) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(statut).json(corps);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return reponse(res, 405, { erreur: "methode" });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return reponse(res, 503, { erreur: "non-configure" });
  }

  const entete = String(req.headers.authorization || "");
  const jeton = entete.toLowerCase().startsWith("bearer ") ? entete.slice(7).trim() : "";
  if (!jeton) {
    return reponse(res, 401, { erreur: "non-authentifie" });
  }

  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Qui appelle ?
    const { data: auteur, error: erreurJeton } = await admin.auth.getUser(jeton);
    if (erreurJeton || !auteur?.user?.id) {
      return reponse(res, 401, { erreur: "session-invalide" });
    }

    // 2) Est-il admin ? La question est posée à la base, jamais au navigateur.
    const { data: profil } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", auteur.user.id)
      .maybeSingle();

    if (!profil?.is_admin) {
      return reponse(res, 403, { erreur: "reserve-admin" });
    }

    // 3) Les adresses. 1000 par page : largement au-dessus d'une ligue entre
    //    amis, mais on pagine quand même plutôt que de tronquer en silence.
    const emails: Record<string, string> = {};
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      (data?.users ?? []).forEach((utilisateur) => {
        if (!utilisateur.id) return;
        if (utilisateur.email) emails[utilisateur.id] = utilisateur.email;
      });
      if (!data?.users || data.users.length < 1000) break;
      page += 1;
    }

    // Qui peut REELLEMENT recevoir une notification. La table
    // push_subscriptions n'est lisible que par son proprietaire (politique
    // RLS existante) : sans cette route, l'admin ne pouvait pas le savoir
    // avant d'avoir clique et lu le bilan d'envoi.
    const avecNotifications: string[] = [];
    try {
      const { data: abonnements } = await admin.from("push_subscriptions").select("user_id");
      const vus = new Set<string>();
      (abonnements ?? []).forEach((ligne: any) => {
        const id = String(ligne?.user_id ?? "");
        if (id && !vus.has(id)) {
          vus.add(id);
          avecNotifications.push(id);
        }
      });
    } catch {
      // Table absente ou illisible : on renvoie une liste vide, l'appelant
      // se contente alors de ne rien afficher de particulier.
    }

    return reponse(res, 200, { emails, avecNotifications });
  } catch {
    return reponse(res, 500, { erreur: "erreur-serveur" });
  }
}
