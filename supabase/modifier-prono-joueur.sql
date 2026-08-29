-- ============================================================
-- MODIFIER LE PRONOSTIC D'UN JOUEUR SUR LE MATCH BONUS
-- ============================================================
-- ⚠️ À LIRE AVANT DE LANCER
-- Cette requête RÉÉCRIT le pronostic d'un joueur. Après elle, le site
-- affichera partout — page Pronos comprise, que tous les joueurs
-- consultent — un pronostic que ce joueur n'a pas posé. Les
-- pourcentages 1/N/2 du match changeront aussi.
--
-- Elle ne touche qu'UNE ligne : le pronostic du joueur nommé, sur le
-- match bonus ACTIF du championnat et de la journée indiqués. Personne
-- d'autre n'est modifié.
--
-- L'ancien pronostic est affiché avant/après pour pouvoir revenir en
-- arrière : il suffit de relancer la requête avec les anciennes valeurs.
-- ============================================================

with parametres as (
  select
    2       as journee,           -- <<< le numéro de journée
    'PL'    as championnat,       -- <<< PL, PD, SA ou BL1
    'sanji' as pseudo,            -- <<< morceau du pseudo du joueur
    0       as nouveau_domicile,  -- <<< nouveau pronostic (domicile)
    2       as nouveau_exterieur  -- <<< nouveau pronostic (extérieur)
),

journee_l1 as (
  select md.id
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where c.name = 'Ligue 1' and md.number = p.journee
),

-- `distinct` : une même rencontre a plusieurs lignes bonus_options
-- (l'historique des tirages), on ne veut la cibler qu'une fois.
cible as (
  select distinct bo.match_id
  from bonus_options bo
  join journee_l1 j on j.id = bo.matchday_id
  join parametres p on true
  where bo.is_active = true
    and bo.competition_code = p.championnat
),

joueur as (
  select pr.id, trim(pr.pseudo) as pseudo
  from profiles pr
  join parametres p on true
  where pr.pseudo ilike '%' || p.pseudo || '%'
),

-- Photo de l'ancien pronostic, prise AVANT la modification.
avant as (
  select pd.user_id, pd.match_id,
         pd.home_prediction as ancien_domicile,
         pd.away_prediction as ancien_exterieur
  from predictions pd
  join joueur jo on jo.id = pd.user_id
  join cible  c  on c.match_id = pd.match_id
),

maj as (
  update predictions pd
     set home_prediction = p.nouveau_domicile,
         away_prediction = p.nouveau_exterieur
    from parametres p
   where pd.user_id  in (select id from joueur)
     and pd.match_id in (select match_id from cible)
  returning pd.user_id, pd.match_id, pd.home_prediction, pd.away_prediction
)

select
  jo.pseudo                                                   as joueur,
  mt.home_team || ' – ' || mt.away_team                       as match_bonus,
  av.ancien_domicile || ' - ' || av.ancien_exterieur          as ancien_prono,
  m.home_prediction  || ' - ' || m.away_prediction            as nouveau_prono,
  coalesce(mt.home_score::text, 'vide') || '-' || coalesce(mt.away_score::text, 'vide')
                                                              as score_du_match
from maj m
join joueur  jo on jo.id = m.user_id
join avant   av on av.user_id = m.user_id and av.match_id = m.match_id
join matches mt on mt.id = m.match_id;
