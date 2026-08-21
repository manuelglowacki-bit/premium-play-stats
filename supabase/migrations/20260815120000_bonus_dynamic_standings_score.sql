-- ============================================================
-- Barème dynamique de sélection bonus — classement en direct
-- ============================================================
-- Le moteur de sélection (src/services/bonusSelectionService.ts) calcule
-- désormais 6 sous-scores au lieu de 4 : équilibre selon le classement
-- ACTUEL (nouveau, poids dominant) et écart de points/forme de niveau
-- (nouveau) s'ajoutent à la forme récente, au prestige (désormais
-- secondaire), à la rivalité et à l'horaire. `bonus_options` n'avait de
-- colonne que pour les 4 anciens sous-scores (prestige_score, balance_score,
-- rivalry_score, schedule_score — balance_score est repris pour "écart de
-- classement"/levelGap). Ajoute les 2 colonnes manquantes.
--
-- Idempotent (`if not exists`), `not null default 0` : n'affecte aucune
-- ligne existante, aucune donnée fictive introduite.

alter table public.bonus_options
  add column if not exists standings_balance_score int not null default 0,
  add column if not exists form_score int not null default 0;
