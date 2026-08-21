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

-- Table de prÃ©fÃ©rences / abonnement push.
-- La fonction utilise la table si elle existe dÃ©jÃ .
-- Si ton ancien systÃ¨me push possÃ¨de dÃ©jÃ  une table diffÃ©rente,
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
