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
