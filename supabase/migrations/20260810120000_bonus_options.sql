-- ============================================================
-- Persistance de la sélection bonus (admin → onglet Bonus)
-- ============================================================
-- `generateBonusForDay`/`replaceBonusForDay`/`removeBonusDraw` (admin.tsx)
-- n'écrivaient jusqu'ici que dans un useState local — jamais en base. La
-- page /pronostics a déjà toute son UI de lecture branchée sur une table
-- `bonus_options` (src/services/bonusOptionsService.ts, jamais appelé
-- jusqu'à présent). Cette migration est idempotente : aucune migration
-- trackée ne crée cette table, et son état réel en base n'a pas pu être
-- vérifié dans cet environnement (Docker indisponible pour `supabase db
-- dump`), donc `if not exists` partout pour rester sûr peu importe l'état
-- actuel.

create table if not exists public.bonus_options (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  competition_code text not null check (competition_code in ('PL', 'PD', 'SA', 'BL1')),
  match_id uuid not null references public.matches(id) on delete cascade,
  selection_score int not null default 0,
  prestige_score int not null default 0,
  balance_score int not null default 0,
  rivalry_score int not null default 0,
  schedule_score int not null default 0,
  reasons text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Au plus une sélection ACTIVE par journée/championnat (index partiel, pas
-- une contrainte unique classique : l'historique désactivé doit pouvoir
-- contenir plusieurs lignes pour le même couple matchday_id/competition_code
-- — voir le commentaire de saveBonusSelections dans bonusOptionsService.ts).
create unique index if not exists bonus_options_active_unique
  on public.bonus_options (matchday_id, competition_code)
  where is_active;

alter table public.bonus_options enable row level security;

-- Même convention que matchdays/matches (supabase_admin_schema.sql) :
-- lecture publique (le joueur non-admin doit voir ses matchs bonus sur
-- /pronostics), écriture réservée aux admins.
drop policy if exists "bonus_options_select" on public.bonus_options;
create policy "bonus_options_select" on public.bonus_options
  for select using (true);

drop policy if exists "bonus_options_admin_write" on public.bonus_options;
create policy "bonus_options_admin_write" on public.bonus_options
  for all using (public.is_admin()) with check (public.is_admin());
