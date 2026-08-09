-- ============================================================
-- Page Réglages complète : extension de app_settings
-- ============================================================
-- `app_settings` était limité à season/entry_fee/bonus_exact_score/
-- closing_delay_minutes. La page Réglages doit couvrir le barème de
-- points, l'équipe de cœur, le bonus et un mode maintenance — tout doit
-- être une vraie colonne persistée, pas du state local ni un faux
-- key/value bricolé (voir l'ancien code mort de SettingsTab qui lisait
-- `app_settings.key`/`value`, des colonnes qui n'ont jamais existé).

alter table public.app_settings
  -- Barème de points : seul `bonus_exact_score` (points score exact)
  -- existait déjà. Aucun moteur de calcul de points n'existe encore dans
  -- le code ni en base (vérifié : aucune fonction/trigger ne les lit) —
  -- ces colonnes sont prêtes pour quand ce moteur sera écrit.
  add column if not exists points_correct_result numeric not null default 1,
  add column if not exists points_goal_diff_bonus numeric not null default 0,

  -- Équipe de cœur : remplace l'ancien bricolage non fonctionnel
  -- (SettingsTab lisait app_settings.key/value, colonnes inexistantes).
  add column if not exists favorite_team_deadline timestamptz,
  add column if not exists favorite_team_auto_lock boolean not null default true,
  add column if not exists favorite_team_bonus_points numeric not null default 0,

  -- Bonus (sélection premium 4 championnats) : nombre de tirages par
  -- période, et barème spécifique optionnel (NULL = barème standard).
  add column if not exists bonus_draws_per_period integer not null default 1,
  add column if not exists bonus_match_points numeric,

  -- Autres pistes validées avec l'admin (voir résumé de fin de tâche) :
  -- inscription/modification profil, fuseau horaire, gel d'urgence.
  add column if not exists registration_deadline timestamptz,
  add column if not exists timezone text not null default 'Europe/Paris',
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists maintenance_message text;
