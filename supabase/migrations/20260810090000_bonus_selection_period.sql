-- ============================================================
-- Onglet Bonus : période de sélection des matchs bonus
-- ============================================================
-- Fenêtre temporelle (début/fin) dans laquelle un match doit avoir son
-- coup d'envoi pour être éligible au tirage de la sélection premium
-- (generateBonusForDay, admin.tsx). Absente jusqu'ici (vérifié : aucune
-- trace en base ni dans le code, ni dans l'historique git) — ajoutée ici
-- en toute sécurité (colonnes nullables, NULL = pas de filtre, comportement
-- inchangé tant que l'admin ne les renseigne pas).

alter table public.app_settings
  add column if not exists bonus_period_start timestamptz,
  add column if not exists bonus_period_end timestamptz;
