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
  $$
    select net.http_post(
      url := 'https://azgksiwcgvbertzzzhvq.supabase.co/functions/v1/send-prono-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '479f0902b9fc476f91d0a12a7e1fefc2-f024a1dcb0984c0bbe4e93a273b243d7'
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron'
      )
    );
  $$
);

-- Vérification immédiate.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prono-ligue1-reminders-every-minute';
