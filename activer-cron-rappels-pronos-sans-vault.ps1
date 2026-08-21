$ErrorActionPreference = "Stop"

$root = Get-Location
$projectRef = "azgksiwcgvbertzzzhvq"
$supabaseUrl = "https://$projectRef.supabase.co"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " CRON RAPPELS PRONOSTICS - SANS VAULT" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Génère un secret compatible avec Windows PowerShell 5.1.
$cronSecret = "$([guid]::NewGuid().ToString('N'))-$([guid]::NewGuid().ToString('N'))"

Write-Host "Mise a jour du secret de la Edge Function..." -ForegroundColor Cyan

& npx --yes supabase@latest secrets set `
  "PRONO_REMINDER_CRON_SECRET=$cronSecret" `
  --project-ref $projectRef

if ($LASTEXITCODE -ne 0) {
    throw "Impossible de mettre a jour PRONO_REMINDER_CRON_SECRET."
}

Write-Host "OK : secret Edge Function mis a jour." -ForegroundColor Green

# Sauvegarde locale du SQL.
$sqlDir = Join-Path $root "supabase"
New-Item -ItemType Directory -Force -Path $sqlDir | Out-Null

$sqlPath = Join-Path $sqlDir "activer-cron-rappels-pronos-sans-vault.sql"

$sql = @"
-- =========================================================
-- PRONO LIGUE 1 LM
-- CRON RAPPELS PRONOSTICS TOUTES LES MINUTES
-- VERSION SANS VAULT
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Table anti-double notification.
create table if not exists public.prono_reminder_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  sent_at timestamptz not null default now(),

  constraint prono_reminder_sent_user_match_unique
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

-- Supprime l'ancien job s'il existe.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';

-- Appelle l'Edge Function chaque minute.
-- Le secret ci-dessous est celui qui vient d'être enregistré
-- dans PRONO_REMINDER_CRON_SECRET.
select cron.schedule(
  'prono-ligue1-reminders-every-minute',
  '* * * * *',
  \$job\$
    select net.http_post(
      url := '$supabaseUrl/functions/v1/send-prono-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '$cronSecret'
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron'
      )
    );
  \$job\$
);

-- Vérification immédiate.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';
"@

Set-Content -Path $sqlPath -Value $sql -Encoding UTF8

Write-Host ""
Write-Host "OK : $sqlPath" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT :" -ForegroundColor Yellow
Write-Host "Le secret est inscrit dans ce fichier SQL." -ForegroundColor Yellow
Write-Host "Ne partage pas ce fichier publiquement." -ForegroundColor Yellow
Write-Host ""
Write-Host "ETAPE SUIVANTE :" -ForegroundColor Cyan
Write-Host "1. Ouvre Supabase -> SQL Editor -> New query." -ForegroundColor White
Write-Host "2. Ouvre : supabase\activer-cron-rappels-pronos-sans-vault.sql" -ForegroundColor White
Write-Host "3. Copie tout le contenu dans SQL Editor." -ForegroundColor White
Write-Host "4. Clique sur Run." -ForegroundColor White
Write-Host ""
Write-Host "La derniere ligne doit retourner active = true." -ForegroundColor Cyan
Write-Host ""
