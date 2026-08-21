$ErrorActionPreference = "Stop"

$root = Get-Location

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " INSTALLATION RAPPELS PRONOSTICS - PRONO L1 LM" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$src = Join-Path $root "src"
$supabase = Join-Path $root "supabase"
$functions = Join-Path $supabase "functions"
$functionDir = Join-Path $functions "send-prono-reminders"

New-Item -ItemType Directory -Force -Path $src | Out-Null
New-Item -ItemType Directory -Force -Path $supabase | Out-Null
New-Item -ItemType Directory -Force -Path $functionDir | Out-Null

# ------------------------------------------------------------
# 1. SQL
# ------------------------------------------------------------
$sql = @'
-- ==========================================================
-- PRONO LIGUE 1 LM - RAPPELS DE PRONOSTICS
-- ==========================================================

create table if not exists public.prono_reminder_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table public.prono_reminder_sent enable row level security;

drop policy if exists "Users can read own reminder records"
on public.prono_reminder_sent;

create policy "Users can read own reminder records"
on public.prono_reminder_sent
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_prono_reminder_sent_user_match
on public.prono_reminder_sent(user_id, match_id);

create index if not exists idx_prono_reminder_sent_sent_at
on public.prono_reminder_sent(sent_at);

-- Table de préférences / abonnement push.
-- La fonction utilise la table si elle existe déjà.
-- Si ton ancien système push possède déjà une table différente,
-- ne supprime rien : nous l'adapterons au test.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions"
on public.push_subscriptions;

create policy "Users manage own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_push_subscriptions_user
on public.push_subscriptions(user_id);
'@

$sqlPath = Join-Path $supabase "prono-notifications.sql"
Set-Content -Path $sqlPath -Value $sql -Encoding UTF8

Write-Host "OK : supabase\prono-notifications.sql" -ForegroundColor Green

# ------------------------------------------------------------
# 2. Edge Function
# ------------------------------------------------------------
$function = @'
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
    ? match.home_team ?? match.home_name ?? "Équipe domicile"
    : match.away_team ?? match.away_name ?? "Équipe extérieure";
}

function oneHourWindow(now: Date) {
  const target = new Date(now.getTime() + 60 * 60 * 1000);
  const from = new Date(target.getTime() - 90 * 1000);
  const to = new Date(target.getTime() + 90 * 1000);
  return { from, to };
}

async function sendWebPush(subscription: Record<string, unknown>, payload: Record<string, unknown>) {
  /*
   * Cette fonction attend une intégration Web Push côté serveur.
   * Si ton ancien système utilise déjà web-push/VAPID, branche son
   * implémentation ici. La fonction prépare déjà les notifications,
   * filtre les joueurs et évite les doublons.
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
        JSON.stringify({ ok: true, sent: 0, message: "Aucun match dans la fenêtre de rappel." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0;
    let skipped = 0;

    for (const match of matches as MatchRow[]) {
      const id = matchId(match.id);

      // Joueurs ayant déjà un prono pour ce match.
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
          body: `⚽ ${home} – ${away} commence dans environ 1 heure. Tu n'as pas encore fait ton pronostic.`,
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
'@

$functionPath = Join-Path $functionDir "index.ts"
Set-Content -Path $functionPath -Value $function -Encoding UTF8

Write-Host "OK : supabase\functions\send-prono-reminders\index.ts" -ForegroundColor Green

# ------------------------------------------------------------
# 3. React helper
# ------------------------------------------------------------
$component = @'
import { useEffect, useState } from "react";

const STORAGE_KEY = "prono-ligue1-prono-reminders-enabled";

export function PronoReminderNotifications() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Les notifications ne sont pas disponibles sur ce navigateur.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Les notifications sont désactivées dans les réglages du navigateur.");
      return;
    }

    localStorage.setItem(STORAGE_KEY, "1");
    setEnabled(true);
  }

  function disableNotifications() {
    localStorage.removeItem(STORAGE_KEY);
    setEnabled(false);
  }

  return (
    <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">
            🔔 Rappels de pronostics
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            Reçois un rappel environ 1 heure avant un match si tu n'as pas
            encore fait ton pronostic.
          </div>
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={disableNotifications}
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300"
          >
            ACTIVÉ
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-[#06101c]"
          >
            ACTIVER
          </button>
        )}
      </div>
    </div>
  );
}
'@

$componentPath = Join-Path $src "PronoReminderNotifications.tsx"
Set-Content -Path $componentPath -Value $component -Encoding UTF8

Write-Host "OK : src\PronoReminderNotifications.tsx" -ForegroundColor Green

# ------------------------------------------------------------
# 4. Instructions
# ------------------------------------------------------------
$readme = @'
# RAPPELS PRONOSTICS

Fichiers créés :

- supabase/prono-notifications.sql
- supabase/functions/send-prono-reminders/index.ts
- src/PronoReminderNotifications.tsx

IMPORTANT :
La fonction Edge prépare le ciblage et l'anti-double notification.
La fonction sendWebPush est volontairement isolée car ton ancien système
Vestiaire possède déjà une infrastructure Web Push/VAPID.

Avant le déploiement, il faut brancher sendWebPush sur ton système VAPID
existant afin que les notifications arrivent réellement sur les téléphones.

Le composant React doit être placé dans la page Profil pour permettre
au joueur d'activer les rappels.

Après cela, il faudra programmer l'Edge Function toutes les minutes
ou utiliser un cron Supabase pour déclencher la vérification.
'@

$readmePath = Join-Path $root "RAPPELS-PRONOS-README.md"
Set-Content -Path $readmePath -Value $readme -Encoding UTF8

Write-Host "OK : RAPPELS-PRONOS-README.md" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " INSTALLATION DES FICHIERS TERMINEE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichiers créés :" -ForegroundColor White
Write-Host "  supabase\prono-notifications.sql"
Write-Host "  supabase\functions\send-prono-reminders\index.ts"
Write-Host "  src\PronoReminderNotifications.tsx"
Write-Host "  RAPPELS-PRONOS-README.md"
Write-Host ""
Write-Host "IMPORTANT : ne lance pas encore le déploiement." -ForegroundColor Yellow
Write-Host "On doit d'abord raccorder la fonction au système VAPID/Web Push existant." -ForegroundColor Yellow
Write-Host ""
Write-Host "Fais maintenant :" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor White
Write-Host ""
