-- ============================================================
-- Synchronisation Ligue 1 depuis football-data.org
-- Ajoute les colonnes/table nécessaires à l'Edge Function
-- `sync-ligue1-matches` pour retrouver/upserter les bonnes lignes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Clé d'idempotence sur les matchs : permet à la fonction de
--    savoir "ce match a déjà été synchronisé" et de faire un
--    upsert au lieu de dupliquer une ligne à chaque exécution.
-- ------------------------------------------------------------
alter table public.matches
  add column if not exists external_id bigint unique;

-- ------------------------------------------------------------
-- 2. Code externe sur les compétitions : permet à la fonction de
--    retrouver quelle ligne `competitions` correspond au "FL1"
--    de football-data.org, sans deviner par ressemblance de nom.
--    ⚠️ Après avoir appliqué cette migration, lie manuellement ta
--    ligne Ligue 1 existante :
--      select id, name, country from public.competitions;
--      update public.competitions set external_code = 'FL1' where id = '<id trouvé>';
-- ------------------------------------------------------------
alter table public.competitions
  add column if not exists external_code text unique;

-- ------------------------------------------------------------
-- 3. Table de correspondance équipe API -> équipe interne.
--    Clé de recherche réelle : external_id (id numérique stable
--    football-data.org). external_name n'est qu'une étiquette
--    lisible, mise à jour à chaque synchronisation.
-- ------------------------------------------------------------
create table if not exists public.team_api_mapping (
  id uuid primary key default gen_random_uuid(),
  external_id bigint not null unique,
  external_name text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.team_api_mapping enable row level security;

-- Fonction utilitaire déjà utilisée par les autres politiques admin de ce
-- projet (voir supabase_admin_schema.sql) : "create or replace" pour rester
-- sûr même si elle existe déjà avec une définition identique.
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

-- Lecture/écriture réservées aux admins : cette table n'a pas de
-- consommateur public (l'Edge Function la lit avec la clé service_role,
-- qui contourne de toute façon la RLS), donc pas de politique de select
-- publique ici, contrairement à `matches`/`matchdays`.
drop policy if exists "team_api_mapping_admin_all" on public.team_api_mapping;
create policy "team_api_mapping_admin_all" on public.team_api_mapping
  for all using (public.is_admin()) with check (public.is_admin());
