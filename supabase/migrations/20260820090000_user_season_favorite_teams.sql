-- Lot 4 — historisation de l'équipe favorite par saison.
--
-- Pourquoi : profiles.favorite_team_id n'a qu'une seule valeur COURANTE,
-- sans historique. Une fois qu'un joueur change de club favori (par ex. à
-- l'ouverture d'une nouvelle saison), tout recalcul futur des pronostics
-- d'UNE ANCIENNE saison utiliserait à tort le nouveau favori (barème
-- favori 2/1/0 au lieu du barème classique 1/0, ou l'inverse). Voir audit
-- Lot 3 : faille reproduite avec isFavoriteMatch()/scoreLigue1Prediction()
-- (écart réel de 1 pt sur un cas simulé).
--
-- Cette table ne stocke QUE la donnée qui ne peut être dérivée de nulle
-- part ailleurs (l'équipe favorite au moment d'une saison donnée). Elle ne
-- stocke jamais de points/scores — ceux-ci restent calculés à la volée par
-- computeLeagueStats(), jamais mis en cache (même principe que le reste du
-- projet, où `predictions.points` mis en cache s'est justement révélé être
-- un bug permanent).

create table if not exists public.user_season_favorite_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  favorite_team_id uuid not null references public.teams(id),
  updated_at timestamptz not null default now(),
  unique (user_id, season_id)
);
-- Pas d'index supplémentaire : la contrainte unique (user_id, season_id)
-- fournit déjà l'index nécessaire au lookup utilisé par computeLeagueStats().

alter table public.user_season_favorite_teams enable row level security;

-- Lecture : nécessaire au calcul du classement de TOUS les joueurs (comme
-- predictions_select_all_authenticated) — restreint aux utilisateurs
-- connectés, jamais aux anonymes (contrairement à `profiles` qui autorise
-- `public` pour l'affichage pseudo/avatar, ce dont cette table n'a pas
-- besoin).
create policy "user_season_favorite_teams_select_authenticated"
  on public.user_season_favorite_teams
  for select
  to authenticated
  using (true);

-- Écriture : un joueur ne peut créer/modifier que SA PROPRE ligne (même
-- pattern que predictions_insert/predictions_update).
create policy "user_season_favorite_teams_insert_own"
  on public.user_season_favorite_teams
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_season_favorite_teams_update_own"
  on public.user_season_favorite_teams
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin : même pattern que bonus_options_admin_write/profiles_admin_write
-- (is_admin() renvoie false pour un utilisateur anonyme ou non-admin — la
-- fonction elle-même protège déjà ce `to public`, cf. définition existante
-- vérifiée avant migration : coalesce((select is_admin from profiles
-- where id = auth.uid()), false)).
create policy "user_season_favorite_teams_admin_write"
  on public.user_season_favorite_teams
  for all
  to public
  using (is_admin())
  with check (is_admin());
