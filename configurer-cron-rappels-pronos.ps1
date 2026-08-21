$ErrorActionPreference = "Stop"

$root = Get-Location
$projectRef = "azgksiwcgvbertzzzhvq"
$supabaseUrl = "https://$projectRef.supabase.co"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " CONFIGURATION CRON RAPPELS PRONOSTICS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Secret fort pour les appels Cron -> Edge Function.
$cronSecret = "$([guid]::NewGuid().ToString("N"))-$([guid]::NewGuid().ToString("N"))"

Write-Host "Mise Ã  jour du secret de la Edge Function..." -ForegroundColor Cyan

& npx --yes supabase@latest secrets set `
  "PRONO_REMINDER_CRON_SECRET=$cronSecret" `
  --project-ref $projectRef

if ($LASTEXITCODE -ne 0) {
    throw "Impossible de mettre Ã  jour PRONO_REMINDER_CRON_SECRET."
}

Write-Host "OK : secret mis Ã  jour." -ForegroundColor Green

# SQL prÃªt Ã  coller dans Supabase SQL Editor.
$sql = @"
-- =========================================================
-- PRONO LIGUE 1 LM
-- CRON RAPPELS PRONOSTICS TOUTES LES MINUTES
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

-- Remplace les Ã©ventuelles anciennes entrÃ©es.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';

-- URL de la Edge Function.
select vault.create_secret(
  '$supabaseUrl/functions/v1/send-prono-reminders',
  'prono_reminder_function_url'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'prono_reminder_function_url'
);

-- Secret partagÃ© avec la Edge Function.
select vault.create_secret(
  '$cronSecret',
  'prono_reminder_cron_secret'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'prono_reminder_cron_secret'
);

-- VÃ©rifie que les secrets sont prÃ©sents.
select name
from vault.decrypted_secrets
where name in (
  'prono_reminder_function_url',
  'prono_reminder_cron_secret'
);

-- Appel automatique chaque minute.
select cron.schedule(
  'prono-ligue1-reminders-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'prono_reminder_function_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'prono_reminder_cron_secret'
          limit 1
        )
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron'
      )
    );
  $job$
);

-- VÃ©rification du job.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';
"@

$out = Join-Path $root "supabase\activer-cron-rappels-pronos.sql"
Set-Content -Path $out -Value $sql -Encoding UTF8

Write-Host ""
Write-Host "OK : $out" -ForegroundColor Green
Write-Host ""
Write-Host "Ã‰TAPE SUIVANTE :" -ForegroundColor Yellow
Write-Host "1. Ouvre Supabase -> SQL Editor -> New query." -ForegroundColor White
Write-Host "2. Ouvre le fichier supabase\activer-cron-rappels-pronos.sql" -ForegroundColor White
Write-Host "3. Copie tout son contenu dans SQL Editor." -ForegroundColor White
Write-Host "4. Clique sur Run." -ForegroundColor White
Write-Host ""
Write-Host "Ã€ la fin, la derniÃ¨re requÃªte doit afficher le job" -ForegroundColor Cyan
Write-Host "prono-ligue1-reminders-every-minute avec active = true." -ForegroundColor Cyan
Write-Host ""
Write-Host "NE partage pas le contenu du secret avec quelqu'un." -ForegroundColor DarkGray
Write-Host ""

