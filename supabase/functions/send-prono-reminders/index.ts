import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const cronSecret = Deno.env.get("PRONO_REMINDER_CRON_SECRET")!;

// Client "service_role" : bypass RLS, réservé aux opérations serveur
// (lecture des abonnements Push de n'importe quel joueur, nettoyage des
// abonnements morts...). Ne jamais renvoyer ce client ni sa clé au
// navigateur.
const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type MatchRow = {
  id: string | number;
  home_team?: string | null;
  away_team?: string | null;
  kickoff?: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ManualReminderBody = {
  type?: string;
  user_id?: string;
  matchday_id?: string | null;
  title?: string;
  body?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Lit le corps JSON de la requête sans jamais lever d'exception — un corps
 * vide (cas de l'appel cron actuel, qui n'envoie qu'un header) ou invalide
 * ne doit pas faire échouer la fonction avant même le routage cron/manuel. */
async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function matchTeam(match: MatchRow, side: "home" | "away") {
  return side === "home"
    ? match.home_team ?? "Équipe domicile"
    : match.away_team ?? "Équipe extérieure";
}

function targetWindow(now: Date) {
  // Fonction appelée toutes les minutes.
  // On accepte une fenêtre de ±5 minutes autour de T-1h
  // pour éviter de rater le rappel si le cron prend quelques minutes de retard.
  const target = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    from: new Date(target.getTime() - 5 * 60 * 1000),
    to: new Date(target.getTime() + 5 * 60 * 1000),
  };
}

// ============================================================
// MODE AUTOMATIQUE (cron) — inchangé fonctionnellement par rapport à
// l'existant : rappelle, pour chaque match démarrant dans ~1h, les joueurs
// qui n'ont pas encore pronostiqué CE match précis. Protégé par
// `prono_reminder_sent` (unique user_id+match_id) pour ne jamais relancer
// deux fois le même joueur pour le même match.
// ============================================================
async function handleAutomaticReminders() {
  try {
    const now = new Date();
    const { from, to } = targetWindow(now);

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id,home_team,away_team,kickoff")
      .gte("kickoff", from.toISOString())
      .lte("kickoff", to.toISOString())
      .order("kickoff", { ascending: true });

    if (matchesError) throw matchesError;

    if (!matches?.length) {
      return json({ ok: true, sent: 0, message: "Aucun match à rappeler." });
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:manuelglowacki@gmail.com";

    if (!vapidPublic || !vapidPrivate) {
      return json({ ok: false, error: "Clés VAPID absentes dans Supabase." }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const match of matches as MatchRow[]) {
      const matchId = String(match.id);

      // Joueurs ayant déjà fait leur prono.
      const { data: predictions, error: predictionsError } = await supabase
        .from("predictions")
        .select("user_id")
        .eq("match_id", match.id);

      if (predictionsError) {
        console.error("predictions", matchId, predictionsError);
        continue;
      }

      const done = new Set(
        (predictions ?? [])
          .map((row) => row.user_id)
          .filter(Boolean),
      );

      // Réutilisation de l'ancien abonnement push du Vestiaire.
      const { data: subscriptions, error: subscriptionsError } =
        await supabase
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")

      if (subscriptionsError) {
        console.error("push subscriptions", subscriptionsError);
        continue;
      }

      for (const row of (subscriptions ?? []) as PushSubscriptionRow[]) {
        if (!row.user_id || done.has(row.user_id)) {
          skipped++;
          continue;
        }

        // Anti-double notification par joueur et par match.
        const { data: alreadySent, error: sentLookupError } = await supabase
          .from("prono_reminder_sent")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("match_id", matchId)
          .maybeSingle();

        if (sentLookupError) {
          console.error("reminder lookup", sentLookupError);
          continue;
        }

        if (alreadySent) {
          skipped++;
          continue;
        }

        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        };

        if (!subscription) {
          skipped++;
          continue;
        }

        const home = matchTeam(match, "home");
        const away = matchTeam(match, "away");

        const payload = JSON.stringify({
          title: "Prono Ligue 1 LM",
          body: `${home} - ${away} commence dans 1 heure. Tu n'as pas encore fait ton pronostic.`,
          url: "/pronostics",
          icon: "/pwa-192.png",
          badge: "/notification-badge.png",
          tag: `prono-reminder-${matchId}`,
          data: {
            url: "/pronostics",
            matchId,
            type: "prono-reminder",
          },
        });

        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 3600,
            urgency: "high",
          });

          const { error: insertError } = await supabase
            .from("prono_reminder_sent")
            .insert({
              user_id: row.user_id,
              match_id: matchId,
            });

          if (insertError) {
            // Une contrainte unique protège aussi contre un double envoi
            // lors de deux exécutions simultanées.
            console.warn("reminder insert", insertError);
          }

          sent++;
        } catch (pushError) {
          const statusCode = Number(
            (pushError as { statusCode?: number; status?: number })?.statusCode ??
              (pushError as { statusCode?: number; status?: number })?.status ??
              0,
          );

          // 404/410 = abonnement mort : on le supprime pour ne plus retenter.
          if (statusCode === 404 || statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", row.user_id)

          }

          failed++;
          console.error("web push", row.user_id, matchId, pushError);
        }
      }
    }

    return json({
      ok: true,
      sent,
      skipped,
      failed,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("send-prono-reminders", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

// ============================================================
// MODE MANUEL (Admin → bouton "Rappeler" / "Rappeler tous", Phase 2) —
// s'ajoute au système automatique ci-dessus sans le remplacer. Cible
// TOUJOURS un seul `user_id` explicite fourni par l'appelant (jamais tous
// les joueurs) : c'est admin.tsx (Phase 1) qui décide, par joueur, s'il est
// "incomplete"/"none" et donc éligible à un rappel — cette fonction ne
// refait pas ce calcul, elle se contente d'envoyer.
// ============================================================
async function handleManualReminder(req: Request, body: ManualReminderBody) {
  // Logs de diagnostic temporaires (Phase 2, correction notification) —
  // volontairement dépourvus de tout secret (jamais de clé VAPID privée, de
  // service_role, de JWT complet ou de endpoint/p256dh/auth d'abonnement).
  // Consultables dans Supabase Dashboard > Edge Functions > send-prono-
  // reminders > Logs après un clic réel sur "Rappeler".
  console.log("[manual_reminder] requête reçue, user_id demandé :", body.user_id ?? "(absent)");

  const targetUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!targetUserId) {
    console.log("[manual_reminder] rejeté : user_id manquant/invalide dans le payload.");
    return json({ ok: false, error: "user_id manquant." }, 400);
  }

  // Authentification : seul un administrateur connecté peut déclencher un
  // rappel manuel. On vérifie via le JWT de l'appelant (jamais la clé
  // service_role pour cette vérification) et on relit `profiles.is_admin`
  // exactement comme le fait déjà AuthContext côté client (src/context/
  // AuthContext.tsx) — même définition d'admin partout, pas de logique
  // dupliquée.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader || !anonKey) {
    console.log("[manual_reminder] rejeté : en-tête Authorization absent (anonKey présent :", Boolean(anonKey), ").");
    return json({ ok: false, error: "Authentification manquante." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData?.user) {
    console.log("[manual_reminder] rejeté : session appelant invalide.", authError?.message ?? "");
    return json({ ok: false, error: "Session administrateur invalide." }, 401);
  }

  console.log("[manual_reminder] appelant authentifié, id :", authData.user.id);

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !callerProfile?.is_admin) {
    console.log(
      "[manual_reminder] rejeté : appelant non-admin.",
      profileError?.message ?? `is_admin=${callerProfile?.is_admin}`,
    );
    return json({ ok: false, error: "Action réservée aux administrateurs." }, 403);
  }

  console.log("[manual_reminder] appelant confirmé admin — cible :", targetUserId);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") || "mailto:manuelglowacki@gmail.com";

  // Ne jamais logger les valeurs elles-mêmes — seulement leur présence et,
  // pour la clé publique, sa longueur (87 attendu) : suffisant pour
  // diagnostiquer une clé absente/tronquée sans exposer aucun secret.
  console.log(
    "[manual_reminder] VAPID configurées :",
    "public=", Boolean(vapidPublic), vapidPublic ? `(len ${vapidPublic.length})` : "",
    "private=", Boolean(vapidPrivate),
  );

  if (!vapidPublic || !vapidPrivate) {
    console.log("[manual_reminder] échec : clés VAPID absentes côté Edge Function.");
    return json({ ok: false, error: "Clés VAPID absentes dans Supabase." }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Prono Ligue 1 LM";
  const messageBody =
    typeof body.body === "string" && body.body.trim()
      ? body.body.trim().slice(0, 500)
      : "🔔 N'oublie pas de terminer tes pronostics avant la deadline.";
  const matchdayId = typeof body.matchday_id === "string" ? body.matchday_id : null;

  // Lecture des abonnements Push de CE joueur uniquement, avec la clé
  // service_role : la policy RLS de push_subscriptions n'autorise que le
  // propriétaire à lire ses propres lignes (voir supabase/prono-
  // notifications.sql), un admin ne peut donc pas les lire depuis le
  // navigateur — volontairement, c'est pour ça que l'envoi doit passer par
  // cette Edge Function plutôt que par un appel Supabase direct côté client.
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", targetUserId);

  if (subscriptionsError) {
    console.error("[manual_reminder] erreur Supabase lecture push_subscriptions :", subscriptionsError.message);
    return json({ ok: false, error: "Erreur Supabase lors de la lecture des abonnements." }, 500);
  }

  console.log(
    "[manual_reminder] subscriptions trouvées pour",
    targetUserId, ":", (subscriptions ?? []).length,
  );

  // Déduplication défensive par endpoint (section 5, Phase 2) : la
  // contrainte unique(user_id, endpoint) empêche déjà les doublons en base,
  // mais on ne fait jamais dépendre la correction du code d'une seule
  // contrainte SQL — un même endpoint ne doit jamais recevoir deux envois
  // à cause d'une boucle buguée. Deux appareils différents (téléphone + PC)
  // ont deux endpoints distincts et reçoivent chacun leur notification,
  // ce qui est le comportement normal et attendu.
  const seenEndpoints = new Set<string>();
  const uniqueSubscriptions = ((subscriptions ?? []) as PushSubscriptionRow[]).filter((row) => {
    if (!row.endpoint || seenEndpoints.has(row.endpoint)) return false;
    seenEndpoints.add(row.endpoint);
    return true;
  });

  console.log(
    "[manual_reminder] subscriptions uniques (après dédup par endpoint) :",
    uniqueSubscriptions.length,
  );

  if (uniqueSubscriptions.length === 0) {
    // Pas une erreur : le joueur n'a simplement jamais activé les
    // notifications Push. admin.tsx doit afficher un message clair
    // ("abonnement Push absent"), jamais un faux succès.
    console.log("[manual_reminder] aucune subscription active — rien à envoyer, ce n'est pas un échec.");
    return json({ ok: true, sent: 0, failed: 0, subscriptionsFound: 0 });
  }

  const payload = JSON.stringify({
    title,
    body: messageBody,
    url: "/pronostics",
    icon: "/pwa-192.png",
    badge: "/notification-badge.png",
    tag: matchdayId ? `prono-manual-${matchdayId}-${targetUserId}` : `prono-manual-${targetUserId}`,
    data: {
      url: "/pronostics",
      matchdayId,
      type: "manual_reminder",
    },
  });

  let sent = 0;
  let failed = 0;
  const invalidIds: string[] = [];

  for (const sub of uniqueSubscriptions) {
    // Identifiant court non sensible (host de l'endpoint) pour distinguer
    // les abonnements dans les logs sans jamais imprimer l'endpoint complet
    // ni p256dh/auth (identifiants d'abonnement Push, sensibles).
    let endpointHost = "endpoint invalide";
    try {
      endpointHost = new URL(sub.endpoint).host;
    } catch {
      // ignore — restera "endpoint invalide" dans le log
    }

    console.log("[manual_reminder] tentative d'envoi vers subscription", sub.id, "(", endpointHost, ")");

    try {
      const result = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 3600, urgency: "high" },
      );
      sent++;
      console.log("[manual_reminder] envoi OK, statusCode du service Push :", result.statusCode);
    } catch (pushError) {
      failed++;
      const statusCode = Number(
        (pushError as { statusCode?: number; status?: number })?.statusCode ??
          (pushError as { statusCode?: number; status?: number })?.status ??
          0,
      );
      const errBody = (pushError as { body?: string })?.body;

      // 404/410 = abonnement mort (désinstallé, permission révoquée...) :
      // on le supprime pour ne plus jamais retenter dessus, sans faire
      // échouer l'envoi aux autres abonnements du même joueur.
      if (statusCode === 404 || statusCode === 410) {
        invalidIds.push(sub.id);
        console.log(
          "[manual_reminder] abonnement mort (",
          statusCode,
          ") — sera supprimé :",
          sub.id,
          errBody ?? "",
        );
      } else if (statusCode === 401 || statusCode === 403) {
        // Signature VAPID invalide/rejetée par le service Push : symptôme
        // typique d'un désaccord entre la clé publique côté navigateur et
        // la clé privée utilisée ici pour signer — PAS un abonnement mort,
        // ne pas le supprimer.
        console.error(
          "[manual_reminder] ERREUR VAPID/AUTH (",
          statusCode,
          ") en envoyant à",
          sub.id,
          ":",
          errBody ?? (pushError as Error)?.message,
        );
      } else {
        console.error(
          "[manual_reminder] échec web-push (",
          statusCode || "pas de statusCode",
          ") vers",
          sub.id,
          ":",
          errBody ?? (pushError as Error)?.message,
        );
      }
    }
  }

  if (invalidIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", invalidIds);
    console.log("[manual_reminder] abonnements morts supprimés :", invalidIds.length);
  }

  console.log(
    "[manual_reminder] terminé — tentées:", uniqueSubscriptions.length,
    "envoyées:", sent,
    "échouées:", failed,
  );

  return json({
    ok: true,
    sent,
    failed,
    subscriptionsFound: uniqueSubscriptions.length,
    removedInvalid: invalidIds.length,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const body = (await readJsonBody(req)) as ManualReminderBody;

  // Deux modes d'appel distincts, jamais confondus :
  //  - cron (automatique, toutes les minutes, header x-cron-secret) ;
  //  - manuel (admin.tsx, bouton Rappeler/Rappeler tous, JWT de l'admin
  //    connecté + body.type === "manual_reminder").
  // Le secret cron n'est JAMAIS accessible depuis le navigateur (il ne vit
  // que dans Supabase Vault côté serveur), donc le navigateur ne peut
  // emprunter que le chemin manuel, authentifié différemment.
  const suppliedCronSecret = req.headers.get("x-cron-secret");
  const isCronCall = Boolean(cronSecret) && suppliedCronSecret === cronSecret;

  if (isCronCall) {
    return await handleAutomaticReminders();
  }

  if (body?.type === "manual_reminder") {
    return await handleManualReminder(req, body);
  }

  return json({ ok: false, error: "Unauthorized" }, 401);
});
