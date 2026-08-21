-- =========================================================
-- PRONO LIGUE 1 LM
-- CRON RAPPELS PRONOSTICS TOUTES LES MINUTES
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

-- Remplace les éventuelles anciennes entrées.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';

-- URL de la Edge Function.
select vault.create_secret(
  'https://azgksiwcgvbertzzzhvq.supabase.co/functions/v1/send-prono-reminders',
  'prono_reminder_function_url'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'prono_reminder_function_url'
);

-- Secret partagé avec la Edge Function.
select vault.create_secret(
  '691696a1d9ca4f709a2df823a0e5a161-f84ed476eabf4c6a80b66181783d71d8',
  'prono_reminder_cron_secret'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'prono_reminder_cron_secret'
);

-- Vérifie que les secrets sont présents.
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
  $
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
  $
);

-- Vérification du job.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';
