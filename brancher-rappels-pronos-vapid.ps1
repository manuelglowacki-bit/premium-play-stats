$ErrorActionPreference = "Stop"

$root = Get-Location
$fnDir = Join-Path $root "supabase\functions\send-prono-reminders"
$fnPath = Join-Path $fnDir "index.ts"
$sqlDir = Join-Path $root "supabase\migrations"
New-Item -ItemType Directory -Force -Path $fnDir | Out-Null
New-Item -ItemType Directory -Force -Path $sqlDir | Out-Null

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " BRANCHEMENT PUSH VAPID -> RAPPELS PRONOSTICS" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Sauvegarde
# ------------------------------------------------------------
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root "backup-push-prono-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

foreach ($relative in @(
  "supabase\functions\send-prono-reminders\index.ts",
  "supabase\prono-notifications.sql"
)) {
  $source = Join-Path $root $relative
  if (Test-Path $source) {
    $dest = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Copy-Item $source $dest -Force
  }
}

Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

# ------------------------------------------------------------
# Edge Function : réutilise user_prono_storage + VAPID existants
# ------------------------------------------------------------
$function = @'
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("PRONO_REMINDER_CRON_SECRET")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type MatchRow = {
  id: string | number;
  home_team?: string | null;
  away_team?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff?: string | null;
};

type PushStorageRow = {
  user_id: string;
  storage_value: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function matchTeam(match: MatchRow, side: "home" | "away") {
  return side === "home"
    ? match.home_team ?? match.home_name ?? "Équipe domicile"
    : match.away_team ?? match.away_name ?? "Équipe extérieure";
}

function parsePushSubscription(value: unknown) {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const subscription = parsed?.subscription ?? parsed;

    if (!subscription?.endpoint) return null;

    return subscription;
  } catch {
    return null;
  }
}

function targetWindow(now: Date) {
  // Fonction appelée toutes les minutes.
  // On accepte une fenêtre de ±90 secondes autour de T-1h
  // pour ne jamais rater le rappel à cause du cron.
  const target = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    from: new Date(target.getTime() - 90 * 1000),
    to: new Date(target.getTime() + 90 * 1000),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const suppliedSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || suppliedSecret !== cronSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const now = new Date();
    const { from, to } = targetWindow(now);

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id,home_team,away_team,home_name,away_name,kickoff")
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
          .from("user_prono_storage")
          .select("user_id, storage_value")
          .eq("storage_key", "push_subscription_v1");

      if (subscriptionsError) {
        console.error("push subscriptions", subscriptionsError);
        continue;
      }

      for (const row of (subscriptions ?? []) as PushStorageRow[]) {
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

        const subscription = parsePushSubscription(row.storage_value);

        if (!subscription) {
          skipped++;
          continue;
        }

        const home = matchTeam(match, "home");
        const away = matchTeam(match, "away");

        const payload = JSON.stringify({
          title: "⚽ Prono Ligue 1 LM",
          body: `${home} – ${away} commence dans 1 heure. Tu n'as pas encore fait ton pronostic.`,
          url: "/pronostics",
          icon: "/prono-icon-192.png",
          badge: "/prono-icon-192.png",
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
            pushError?.statusCode ?? pushError?.status ?? 0,
          );

          // 404/410 = abonnement mort : on le supprime pour ne plus retenter.
          if (statusCode === 404 || statusCode === 410) {
            await supabase
              .from("user_prono_storage")
              .delete()
              .eq("user_id", row.user_id)
              .eq("storage_key", "push_subscription_v1");
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
});
'@

Set-Content -Path $fnPath -Value $function -Encoding UTF8
Write-Host "OK : Edge Function VAPID branchée." -ForegroundColor Green

# ------------------------------------------------------------
# Migration SQL : cron toutes les minutes + anti-double
# ------------------------------------------------------------
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$migrationPath = Join-Path $sqlDir "${timestamp}_prono_reminders_push.sql"

$sql = @'
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

-- Supabase Cron / pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Les anciennes tâches de rappel portant ce nom sont remplacées.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';

-- L'URL et le secret sont stockés dans Vault par le script d'installation.
select cron.schedule(
  'prono-ligue1-reminders-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $job$
);
'@

Set-Content -Path $migrationPath -Value $sql -Encoding UTF8
Write-Host "OK : migration cron créée." -ForegroundColor Green

# ------------------------------------------------------------
# Détection Supabase
# ------------------------------------------------------------
$envText = ""
foreach ($envFile in @(".env.local", ".env")) {
  $path = Join-Path $root $envFile
  if (Test-Path $path) {
    $envText += "`n" + [System.IO.File]::ReadAllText($path)
  }
}

$m = [regex]::Match($envText, 'https://([a-zA-Z0-9-]+)\.supabase\.co')
if (-not $m.Success) {
  throw "Impossible de trouver l'URL Supabase dans .env.local/.env."
}

$projectRef = $m.Groups[1].Value
$supabaseUrl = "https://$projectRef.supabase.co"

$anonMatch = [regex]::Match($envText, '(?m)^\s*(?:VITE_)?SUPABASE_ANON_KEY\s*=\s*([^\r\n]+)')
$anonKey = if ($anonMatch.Success) { $anonMatch.Groups[1].Value.Trim().Trim('"').Trim("'") } else { "" }

if (-not $anonKey) {
  Write-Host "ATTENTION : clé anon non trouvée dans .env. Le cron devra être configuré manuellement." -ForegroundColor Yellow
}

Write-Host "Projet Supabase : $projectRef" -ForegroundColor Cyan

# ------------------------------------------------------------
# Vérification CLI / link
# ------------------------------------------------------------
Push-Location $root
try {
  Write-Host ""
  Write-Host "Connexion au projet Supabase..." -ForegroundColor Cyan

  & npx --yes supabase@latest link --project-ref $projectRef
  if ($LASTEXITCODE -ne 0) {
    throw "Impossible de lier le projet Supabase."
  }

  # Secret aléatoire pour que seul le cron puisse appeler la fonction.
  $cronSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

  Write-Host ""
  Write-Host "Enregistrement du secret cron..." -ForegroundColor Cyan

  & npx --yes supabase@latest secrets set `
    "PRONO_REMINDER_CRON_SECRET=$cronSecret" `
    --project-ref $projectRef

  if ($LASTEXITCODE -ne 0) {
    throw "Impossible d'enregistrer PRONO_REMINDER_CRON_SECRET."
  }

  # Les clés VAPID existent déjà dans ton ancien système.
  # On les remet également à jour depuis .push-vapid.local.json si présent.
  $vapidPath = Join-Path $root ".push-vapid.local.json"

  if (Test-Path $vapidPath) {
    $vapid = Get-Content $vapidPath -Raw | ConvertFrom-Json

    if ($vapid.publicKey -and $vapid.privateKey) {
      & npx --yes supabase@latest secrets set `
        "VAPID_PUBLIC_KEY=$([string]$vapid.publicKey)" `
        "VAPID_PRIVATE_KEY=$([string]$vapid.privateKey)" `
        "VAPID_SUBJECT=mailto:manuelglowacki@gmail.com" `
        --project-ref $projectRef

      if ($LASTEXITCODE -ne 0) {
        throw "Impossible d'enregistrer les clés VAPID."
      }

      Write-Host "OK : clés VAPID trouvées et enregistrées." -ForegroundColor Green
    }
  }
  else {
    Write-Host "ATTENTION : .push-vapid.local.json absent. Les clés VAPID doivent déjà exister dans Supabase." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "Déploiement de la fonction..." -ForegroundColor Cyan

  & npx --yes supabase@latest functions deploy send-prono-reminders --project-ref $projectRef --no-verify-jwt

  if ($LASTEXITCODE -ne 0) {
    throw "Déploiement de send-prono-reminders impossible."
  }

  # Vault : URL + secret pour le cron.
  $functionUrl = "$supabaseUrl/functions/v1/send-prono-reminders"

  $vaultSql = @"
create extension if not exists vault;

select vault.create_secret('$functionUrl', 'prono_reminder_function_url')
where not exists (
  select 1 from vault.decrypted_secrets where name = 'prono_reminder_function_url'
);

select vault.create_secret('$cronSecret', 'prono_reminder_cron_secret')
where not exists (
  select 1 from vault.decrypted_secrets where name = 'prono_reminder_cron_secret'
);
"@

  $vaultPath = Join-Path $root "supabase\prono-reminder-vault.sql"
  Set-Content -Path $vaultPath -Value $vaultSql -Encoding UTF8

  Write-Host ""
  Write-Host "IMPORTANT : exécute maintenant ce SQL dans Supabase SQL Editor :" -ForegroundColor Yellow
  Write-Host "supabase\prono-reminder-vault.sql" -ForegroundColor White
  Write-Host ""
  Write-Host "Puis exécute :" -ForegroundColor Cyan
  Write-Host "supabase db push" -ForegroundColor White
  Write-Host ""

  Write-Host "Le build local n'est pas relancé automatiquement." -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "====================================================" -ForegroundColor Green
  Write-Host " BRANCHEMENT PREPARE" -ForegroundColor Green
  Write-Host "====================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "Le système réutilise user_prono_storage / push_subscription_v1." -ForegroundColor White
  Write-Host "Le rappel est prévu à T-1h et vérifie predictions avant l'envoi." -ForegroundColor White
  Write-Host "Le cron est prévu toutes les minutes." -ForegroundColor White
  Write-Host ""
}
finally {
  Pop-Location
}
