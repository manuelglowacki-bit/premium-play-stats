-- ============================================================
-- Correction : matchs Ligue 1 rattachés à la mauvaise matchday
-- ============================================================
-- Diagnostic (voir conversation) : les 34 matchdays FL1 (J1..J34) existent
-- bien, une seule fois chacune, correctement scoping par competition_id —
-- ce n'est PAS un problème de doublons dans matchdays. Le vrai bug : les
-- 306 matchs match_type = 'LIGUE1' (34 journées × 9 matchs) étaient TOUS
-- rattachés aux matchdays de Serie A portant le même numéro (ex. les 9
-- matchs de la vraie journée 1 de Ligue 1 avaient matchday_id pointant sur
-- la matchday "J1" de Serie A), laissant les matchdays FL1 elles-mêmes
-- vides (0 match).
--
-- Cause : dans syncLigue1Matches (src/services/adminService.ts), la
-- recherche de la matchday existante se faisait uniquement par `code`
-- ("J{n}") sur TOUTES les matchdays de la base, sans filtrer par
-- competition_id/season_id — contrairement à syncCompetitionMatches (même
-- fichier) qui scope correctement par compétition. Comme plusieurs
-- compétitions utilisent le même format de code ("J1", "J2", ...), la
-- correspondance code -> matchday retenue était celle de la DERNIÈRE
-- compétition synchronisée partageant ce code (Serie A dans les faits),
-- pas celle de Ligue 1. Corrigé dans le même commit (adminService.ts).
--
-- Cette migration corrige les données déjà en base : aucune ligne
-- supprimée, seul le pointeur matchday_id des matchs LIGUE1 est réaligné
-- sur la bonne matchday FL1 pour leur numéro de journée (match_day). Les
-- matchs eux-mêmes gardent leur id (aucun impact sur d'éventuels
-- predictions.match_id — à la date de cette migration, 0 prediction en
-- base). Idempotent : ré-exécutable sans effet si déjà appliquée.
update public.matches m
set matchday_id = correct_md.id
from public.matchdays correct_md
join public.competitions comp on comp.id = correct_md.competition_id
where comp.external_code = 'FL1'
  and m.match_type = 'LIGUE1'
  and correct_md.number = m.match_day
  and m.matchday_id is distinct from correct_md.id;
