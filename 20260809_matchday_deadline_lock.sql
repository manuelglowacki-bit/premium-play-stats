-- ============================================================
-- VERROUILLAGE DES PRONOSTICS PAR JOURNÉE
-- manual       = deadline définie manuellement dans matchdays.deadline
-- auto_minus_1 = chaque match se verrouille 1 minute avant kickoff
-- ============================================================

ALTER TABLE public.matchdays
  ADD COLUMN IF NOT EXISTS deadline_mode text NOT NULL DEFAULT 'manual';

ALTER TABLE public.matchdays
  DROP CONSTRAINT IF EXISTS matchdays_deadline_mode_check;

ALTER TABLE public.matchdays
  ADD CONSTRAINT matchdays_deadline_mode_check
  CHECK (deadline_mode IN ('manual', 'auto_minus_1'));

COMMENT ON COLUMN public.matchdays.deadline_mode IS
  'Mode de verrouillage des pronostics : manual ou auto_minus_1.';

-- Compatibilité : les journées existantes restent en mode manuel.
UPDATE public.matchdays
SET deadline_mode = 'manual'
WHERE deadline_mode IS NULL;
