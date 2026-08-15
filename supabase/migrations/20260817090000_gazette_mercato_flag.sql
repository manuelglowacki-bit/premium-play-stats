-- ============================================================
-- Gazette Phase 3 — bascule Mercato / Rubrique du moment
-- ============================================================
-- La Gazette ne doit afficher "Mercato" que lorsque la période de mercato
-- est réellement active. Aucune date de fenêtre de mercato n'est fiable à
-- calculer automatiquement ici (dates officielles fixées chaque saison par
-- la LFP/FFF, non stockées dans ce projet) — plutôt que d'inventer des
-- dates, l'admin bascule ce réglage manuellement, exactement comme
-- maintenance_mode déjà en place. Quand il est à false, la Gazette affiche
-- une "Rubrique du moment" calculée à partir des données réelles de
-- l'application (voir src/routes/gazette.tsx) à la place.
alter table public.app_settings
  add column if not exists mercato_active boolean not null default false;
