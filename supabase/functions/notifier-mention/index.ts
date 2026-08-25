import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// NOTIFIER LES JOUEURS CITÉS DANS UN MESSAGE DU VESTIAIRE
// ============================================================
// Appelée par le navigateur juste après l'envoi d'un message contenant une
// ou plusieurs mentions. Elle envoie une notification UNIQUEMENT aux joueurs
// nommément cités.
//
// POURQUOI PAS UNE NOTIFICATION À CHAQUE MESSAGE : à 23 joueurs, un soir
// d'après-match, ce serait des dizaines d'alertes par personne. Au bout de
// deux soirs, tout le monde les coupe — et les rappels de pronostics, qui
// comptent vraiment, sautent avec. Ne notifier que les mentions garde
// l'alerte rare, donc lue.
//
// CE QU'ELLE NE CROIT PAS SUR PAROLE. Le navigateur n'envoie qu'un
// identifiant de message. La fonction relit le message EN BASE et en extrait
// elle-même les mentions : personne ne peut donc s'en servir pour envoyer une
// notification arbitraire à toute la ligue. Elle vérifie aussi que l'appelant
// est bien l'auteur du message, et refuse de notifier l'auteur lui-même.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Les identifiants cités, lus dans le message tel qu'il est en base. */
function lireMentions(contenu: string): { mentions: string[]; texte: string } {
  try {
    const paquet = JSON.parse(contenu);
    if (paquet && typeof paquet === "object") {
      const mentions = Array.isArray(paquet.mentions)
        ? paquet.mentions.filter((id: unknown) => typeof id === "string" && id.length > 0)
        : [];
      const texte = typeof paquet.text === "string" ? paquet.text : "";
      return { mentions: [...new Set(mentions)] as string[], texte };
    }
  } catch {
    // Message en texte brut : aucune mention possible.
  }
  return { mentions: [], texte: contenu };
}

function apercu(texte: string): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (!propre) return "t'a cité dans le Vestiaire.";
  return propre.length > 120 ? `${propre.slice(0, 117)}…` : propre;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:manuelglowacki@gmail.com";

  if (!vapidPublic || !vapidPrivate) {
    return json({ ok: false, error: "Clés VAPID absentes dans Supabase." }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // ---------- Qui appelle ? ----------
  const entete = req.headers.get("Authorization") ?? "";
  const jeton = entete.toLowerCase().startsWith("bearer ") ? entete.slice(7).trim() : "";
  if (!jeton) return json({ ok: false, error: "non-authentifie" }, 401);

  const { data: auteurAuth, error: erreurJeton } = await supabase.auth.getUser(jeton);
  const auteurId = auteurAuth?.user?.id;
  if (erreurJeton || !auteurId) return json({ ok: false, error: "session-invalide" }, 401);

  // ---------- Quel message ? ----------
  let messageId = "";
  try {
    const corps = await req.json();
    messageId = String(corps?.messageId ?? "");
  } catch {
    return json({ ok: false, error: "corps-invalide" }, 400);
  }
  if (!messageId) return json({ ok: false, error: "messageId manquant" }, 400);

  const { data: message, error: erreurMessage } = await supabase
    .from("chat_messages")
    .select("id, user_id, content, created_at")
    .eq("id", messageId)
    .maybeSingle();

  if (erreurMessage || !message) return json({ ok: false, error: "message introuvable" }, 404);

  // On ne notifie que pour SON propre message : sinon n'importe qui pourrait
  // rejouer l'appel sur le message d'un autre pour renvoyer ses alertes.
  if (String(message.user_id) !== auteurId) {
    return json({ ok: false, error: "message d'un autre joueur" }, 403);
  }

  // Un message ancien ne doit pas pouvoir être rejoué indéfiniment pour
  // harceler les personnes citées. Cinq minutes couvrent largement un envoi
  // normal, réseau lent compris.
  const age = Date.now() - new Date(String(message.created_at)).getTime();
  if (Number.isFinite(age) && age > 5 * 60 * 1000) {
    return json({ ok: true, envoyees: 0, message: "message trop ancien, rien envoyé" });
  }

  // ---------- Les mentions, lues EN BASE ----------
  const { mentions, texte } = lireMentions(String(message.content ?? ""));
  const cibles = mentions.filter((id) => id !== auteurId);
  if (!cibles.length) return json({ ok: true, envoyees: 0, message: "aucune mention" });

  const { data: auteurProfil } = await supabase
    .from("profiles")
    .select("pseudo")
    .eq("id", auteurId)
    .maybeSingle();
  const nomAuteur = (auteurProfil?.pseudo ?? "").trim() || "Un joueur";

  const { data: abonnements, error: erreurAbonnements } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", cibles);

  if (erreurAbonnements) return json({ ok: false, error: erreurAbonnements.message }, 500);
  if (!abonnements?.length) {
    return json({ ok: true, envoyees: 0, message: "les joueurs cités n'ont pas activé les notifications" });
  }

  const payload = JSON.stringify({
    title: `${nomAuteur} t'a cité dans le Vestiaire`,
    body: apercu(texte),
    url: "/trophees",
    icon: "/pwa-192.png",
    badge: "/notification-badge.png",
    // Un `tag` unique par message : deux mentions successives font DEUX
    // notifications, au lieu que la seconde remplace la première en silence.
    tag: `vestiaire-mention-${message.id}`,
    data: { url: "/trophees", type: "vestiaire-mention", messageId: message.id },
  });

  let envoyees = 0;
  let echecs = 0;

  for (const abonnement of abonnements) {
    try {
      await webpush.sendNotification(
        {
          endpoint: abonnement.endpoint,
          keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
        },
        payload,
        { TTL: 3600, urgency: "high" },
      );
      envoyees += 1;
    } catch (erreur) {
      echecs += 1;
      const statut = Number(
        (erreur as { statusCode?: number; status?: number })?.statusCode ??
          (erreur as { statusCode?: number; status?: number })?.status ??
          0,
      );
      // 404/410 : l'abonnement n'existe plus (application desinstallee,
      // notifications coupees). On le retire, sinon il fera echouer chaque
      // envoi suivant indefiniment.
      if (statut === 404 || statut === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", abonnement.endpoint);
      } else {
        console.error("[mention] envoi impossible :", statut, (erreur as Error)?.message);
      }
    }
  }

  return json({ ok: true, envoyees, echecs, cites: cibles.length });
});
