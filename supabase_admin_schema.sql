-- ============================================================
-- Prono Ligue 1 — Schéma pour la page Admin complète
-- À exécuter une seule fois dans Supabase (SQL Editor)
-- ============================================================

-- Nécessaire pour gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PROFILES — on s'assure que les colonnes utilisées par
--    l'admin existent (ne touche pas aux données existantes)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists pseudo text;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists favorite_team text;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ------------------------------------------------------------
-- 2. PAYMENTS — un paiement par joueur
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null default 0,
  paid boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (player_id)
);

-- ------------------------------------------------------------
-- 3. MATCHDAYS (journées)
-- ------------------------------------------------------------
create table if not exists public.matchdays (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- ex: "J1"
  label text not null,              -- ex: "Journée 1"
  season text not null default '2026-2027',
  is_open boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. MATCHES
-- ------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  matchday_code text references public.matchdays(code) on delete set null,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null default now(),
  status text not null default 'scheduled', -- scheduled | live | finished
  home_score int,
  away_score int,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. APP_SETTINGS (réglages — une seule ligne, id = 1)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1,
  season text not null default '2026-2027',
  entry_fee numeric not null default 10,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, season, entry_fee)
values (1, '2026-2027', 10)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6. RLS — lecture publique (authentifiés), écriture admin only
-- ------------------------------------------------------------
alter table public.payments enable row level security;
alter table public.matchdays enable row level security;
alter table public.matches enable row level security;
alter table public.app_settings enable row level security;

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- PAYMENTS
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select using (auth.role() = 'authenticated');

drop policy if exists "payments_admin_write" on public.payments;
create policy "payments_admin_write" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- MATCHDAYS
drop policy if exists "matchdays_select" on public.matchdays;
create policy "matchdays_select" on public.matchdays
  for select using (true);

drop policy if exists "matchdays_admin_write" on public.matchdays;
create policy "matchdays_admin_write" on public.matchdays
  for all using (public.is_admin()) with check (public.is_admin());

-- MATCHES
drop policy if exists "matches_select" on public.matches;
create policy "matches_select" on public.matches
  for select using (true);

drop policy if exists "matches_admin_write" on public.matches;
create policy "matches_admin_write" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- APP_SETTINGS
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select using (true);

drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- PROFILES: autoriser un admin à supprimer/modifier n'importe quel profil
drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
