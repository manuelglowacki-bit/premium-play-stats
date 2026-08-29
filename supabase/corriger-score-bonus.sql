-- ============================================================
-- SAISIR LE SCORE D'UN MATCH BONUS
-- ============================================================
-- À n'utiliser que si tu ne veux pas passer par l'Admin
-- (Admin → onglet Bonus → « Modifier le bonus »), qui fait exactement
-- la même chose.
--
-- Elle ne touche QU'AU match bonus ACTIF du championnat indiqué, sur la
-- journée indiquée. Aucun pronostic n'est modifié : les points de tous
-- les joueurs se recalculent ensuite tout seuls à partir de ce score.
--
-- ⚠️ METS LE VRAI SCORE FINAL. Un score faux fausse le classement de
--    TOUS les joueurs, pas seulement celui que tu as en tête.
-- ============================================================

with parametres as (
  select
    2    as journee,        -- <<< le numéro de journée
    'PL' as championnat,    -- <<< PL, PD, SA ou BL1
    1    as score_domicile, -- <<< buts de l'équipe qui reçoit
    2    as score_exterieur -- <<< buts de l'équipe qui se déplace
),

journee_l1 as (
  select md.id
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where c.name = 'Ligue 1' and md.number = p.journee
),

-- Le match bonus ACTIF de ce championnat sur cette journée. Les lignes
-- désactivées (l'historique des tirages) sont volontairement ignorées.
cible as (
  select bo.match_id
  from bonus_options bo
  join journee_l1 j on j.id = bo.matchday_id
  join parametres p on true
  where bo.is_active = true
    and bo.competition_code = p.championnat
),

maj as (
  update matches mt
     set home_score = p.score_domicile,
         away_score = p.score_exterieur,
         finished   = true
    from parametres p
   where mt.id in (select match_id from cible)
  returning mt.id, mt.home_team, mt.away_team, mt.home_score, mt.away_score, mt.finished
)

select
  m.home_team || ' – ' || m.away_team as match_corrige,
  m.home_score || ' - ' || m.away_score as nouveau_score,
  m.finished as marque_termine
from maj m;
