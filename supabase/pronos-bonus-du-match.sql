-- ============================================================
-- QUI A PRONOSTIQUÉ QUOI SUR UN MATCH BONUS
-- ============================================================
-- Liste TOUS les joueurs qui ont joué le match bonus d'une journée, avec
-- leur pronostic, et ce que chacun gagnerait si le score final était
-- celui que tu simules en haut.
--
-- Sert à voir l'effet d'un score AVANT de l'enregistrer : changer le
-- score d'un match bonus ne touche jamais un seul joueur, il touche tous
-- ceux qui l'ont joué.
--
-- Barème officiel : score exact 3, bon résultat 2, sinon 0.
--
-- RIEN N'EST MODIFIÉ ICI : que de la lecture.
-- ============================================================

with parametres as (
  select
    2    as journee,        -- <<< le numéro de journée
    'PL' as championnat,    -- <<< PL, PD, SA ou BL1
    1    as score_domicile, -- <<< le score que tu veux simuler (domicile)
    2    as score_exterieur -- <<< le score que tu veux simuler (extérieur)
),

journee_l1 as (
  select md.id
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where c.name = 'Ligue 1' and md.number = p.journee
),

-- `distinct` volontaire : une même rencontre apparaît souvent en
-- plusieurs lignes bonus_options (l'historique des tirages). Sans lui,
-- chaque joueur ressortirait plusieurs fois.
cible as (
  select distinct bo.match_id
  from bonus_options bo
  join journee_l1 j on j.id = bo.matchday_id
  join parametres p on true
  where bo.is_active = true
    and bo.competition_code = p.championnat
),

rencontre as (
  select mt.id, mt.home_team, mt.away_team, mt.home_score, mt.away_score, mt.finished
  from matches mt
  join cible c on c.match_id = mt.id
),

-- Un seul pronostic par joueur : le plus récent, comme le site.
pronos as (
  select distinct on (pd.user_id)
    pd.user_id, pd.home_prediction, pd.away_prediction, pd.created_at
  from predictions pd
  join rencontre r on r.id = pd.match_id
  order by pd.user_id, pd.created_at desc
)

select
  trim(pr.pseudo)                                          as joueur,
  pn.home_prediction || ' - ' || pn.away_prediction        as son_prono,
  case
    when p.score_domicile = pn.home_prediction
     and p.score_exterieur = pn.away_prediction then 3
    when sign(p.score_domicile - p.score_exterieur)
       = sign(pn.home_prediction - pn.away_prediction) then 2
    else 0
  end                                                      as points_avec_ce_score,
  r.home_team || ' – ' || r.away_team                      as match_bonus,
  coalesce(r.home_score::text, 'vide') || '-' || coalesce(r.away_score::text, 'vide')
                                                           as score_actuel_en_base
from pronos pn
join profiles  pr on pr.id = pn.user_id
join rencontre r  on true
join parametres p on true
order by points_avec_ce_score desc, joueur;
