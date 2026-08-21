import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MatchRow = {
  id: string | number;
  home_team?: string | null;
  away_team?: string | null;
  kickoff?: string | null;
  home_name?: string | null;
  away_name?: string | null;
};

function matchId(value: MatchRow["id"]) {
  return String(value);
}

function teamName(match: MatchRow, side: "home" | "away") {
  return side === "home"
    ? match.home_team ?? match.home_name ?? "Ã‰quipe domicile"
    : match.away_team ?? match.away_name ?? "Ã‰quipe extÃ©rieure";
}

function oneHourWindow(now: Date) {
  const target = new Date(now.getTime() + 60 * 60 * 1000);
  const from = new Date(target.getTime() - 90 * 1000);
  const to = new Date(target.getTime() + 90 * 1000);
  return { from, to };
}

async function sendWebPush(subscription: Record<string, unknown>, payload: Record<string, unknown>) {
  /*
   * Cette fonction attend une intÃ©gration Web Push cÃ´tÃ© serveur.
   * Si ton ancien systÃ¨me utilise dÃ©jÃ  web-push/VAPID, branche son
   * implÃ©mentation ici. La fonction prÃ©pare dÃ©jÃ  les notifications,
   * filtre les joueurs et Ã©vite les doublons.
   */
  console.log("PUSH_READY", JSON.stringify({ subscription, payload }));
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const { from, to } = oneHourWindow(now);

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .gte("kickoff", from.toISOString())
      .lte("kickoff", to.toISOString())
      .order("kickoff", { ascending: true });

    if (matchesError) throw matchesError;

    if (!matches?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "Aucun match dans la fenÃªtre de rappel." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0;
    let skipped = 0;

    for (const match of matches as MatchRow[]) {
      const id = matchId(match.id);

      // Joueurs ayant dÃ©jÃ  un prono pour ce match.
      const { data: predictions, error: predictionsError } = await supabase
        .from("predictions")
        .select("user_id")
        .eq("match_id", match.id);

      if (predictionsError) {
        console.error("prediction lookup", id, predictionsError);
        continue;
      }

      const completed = new Set(
        (predictions ?? [])
          .map((row) => row.user_id)
          .filter(Boolean),
      );

      // Tous les joueurs avec un abonnement push.
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth");

      if (subscriptionsError) {
        console.error("subscription lookup", subscriptionsError);
        continue;
      }

      const home = teamName(match, "home");
      const away = teamName(match, "away");

      for (const subscription of subscriptions ?? []) {
        const userId = subscription.user_id;

        if (!userId || completed.has(userId)) {
          skipped++;
          continue;
        }

        const { data: alreadySent, error: sentLookupError } = await supabase
          .from("prono_reminder_sent")
          .select("id")
          .eq("user_id", userId)
          .eq("match_id", id)
          .maybeSingle();

        if (sentLookupError) {
          console.error("sent lookup", userId, id, sentLookupError);
          continue;
        }

        if (alreadySent) {
          skipped++;
          continue;
        }

        const payload = {
          title: "Prono Ligue 1 LM",
          body: `âš½ ${home} â€“ ${away} commence dans environ 1 heure. Tu n'as pas encore fait ton pronostic.`,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: `prono-reminder-${id}`,
          data: {
            url: "/pronostics",
            matchId: id,
          },
        };

        try {
          await sendWebPush(subscription, payload);

          await supabase
            .from("prono_reminder_sent")
            .insert({
              user_id: userId,
              match_id: id,
            });

          sent++;
        } catch (pushError) {
          console.error("push error", userId, id, pushError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        skipped,
        checkedAt: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-prono-reminders", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
