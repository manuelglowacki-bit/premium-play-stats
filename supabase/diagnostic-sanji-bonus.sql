-- ============================================================
-- DIAGNOSTIC — LE MATCH BONUS D'UN JOUEUR SUR UNE JOURNÉE
-- ============================================================
-- À quoi ça sert : comprendre pourquoi un joueur n'a pas eu ses points
-- de match bonus, AVANT de corriger quoi que ce soit. Cette requête ne
-- modifie RIEN, elle ne fait que lire.
--
-- Elle répond à trois questions, dans l'ordre :
--   1. quel match était le bonus de cette journée (et si un autre match
--      a été mis en bonus puis désactivé) ;
--   2. quel(s) prono(s) le joueur a posé dessus, et lequel le site
--      retient (le plus récent, comme dans le calcul du classement) ;
--   3. combien de points ça donne, avec le barème officiel
--      (score exact 3, bon résultat 2, sinon 0).
--
-- Par défaut elle prend LA DERNIÈRE JOURNÉE TERMINÉE. Pour forcer une
-- journée précise, remplace `null` par son numéro ci-dessous.
-- ============================================================

with parametres as (
  select
    null::int as journee,      -- <<< null = dernière journée terminée, sinon 2, 3...
    'sanji'   as pseudo        -- <<< morceau du pseudo, sans tenir compte des majuscules
),

-- La journée de Ligue 1 concernée. Les championnats bonus (PL, PD, SA,
-- BL1) ont leurs propres journées portant les mêmes numéros : on filtre
-- donc bien sur la Ligue 1.
journee_l1 as (
  select md.id, md.number
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where c.name = 'Ligue 1'
    and (
      (p.journee is not null and md.number = p.journee)
      or (p.journee is null and exists (
            select 1 from matches m where m.matchday_id = md.id and m.finished
          ))
    )
  order by md.number desc
  limit 1
),

joueur as (
  select pr.id, trim(pr.pseudo) as pseudo
  from profiles pr
  join parametres p on true
  where pr.pseudo ilike '%' || p.pseudo || '%'
),

-- Toutes les lignes bonus de cette journée, actives ET désactivées :
-- une ligne désactivée qui traîne explique souvent le problème.
options as (
  select
    bo.match_id, bo.competition_code, bo.is_active, bo.created_at,
    mt.home_team, mt.away_team, mt.home_score, mt.away_score, mt.finished
  from bonus_options bo
  join journee_l1 j on j.id = bo.matchday_id
  join matches mt   on mt.id = bo.match_id
),

-- Les pronos du joueur sur ces matchs. `rang = 1` est celui que le site
-- retient : le plus récent parmi les matchs bonus ACTIFS de la journée.
pronos as (
  select
    o.home_team, o.away_team, o.home_score, o.away_score, o.finished,
    o.is_active, pd.home_prediction, pd.away_prediction, pd.created_at,
    row_number() over (
      partition by o.is_active
      order by pd.created_at desc
    ) as rang
  from predictions pd
  join joueur  jo on jo.id = pd.user_id
  join options o  on o.match_id = pd.match_id
),

points as (
  select
    pr.*,
    case
      when pr.home_score is null or not pr.finished then 0
      when pr.home_score = pr.home_prediction
       and pr.away_score = pr.away_prediction then 3
      when sign(pr.home_score - pr.away_score)
         = sign(pr.home_prediction - pr.away_prediction) then 2
      else 0
    end as pts
  from pronos pr
)

select 1 as ordre, 'JOURNÉE' as section,
       'Journée ' || j.number || ' de Ligue 1' as detail
from journee_l1 j
union all
select 1, 'JOURNÉE', 'AUCUNE journée trouvée — vérifie le numéro'
where not exists (select 1 from journee_l1)

union all
select 2, 'MATCH BONUS',
       case when o.is_active then 'ACTIF' else 'désactivé' end
       || ' · ' || o.competition_code
       || ' · ' || o.home_team || ' – ' || o.away_team
       || ' · score en base : '
       || coalesce(o.home_score::text, '?') || '-' || coalesce(o.away_score::text, '?')
       || case when o.finished then ' (terminé)' else ' (PAS marqué terminé)' end
from options o
union all
select 2, 'MATCH BONUS', 'AUCUN match bonus enregistré sur cette journée'
where not exists (select 1 from options)

union all
select 3, 'JOUEUR', 'Trouvé : ' || jo.pseudo from joueur jo
union all
select 3, 'JOUEUR', 'AUCUN joueur ne correspond à ce pseudo'
where not exists (select 1 from joueur)

union all
select 4, 'SON PRONO',
       case when pt.is_active and pt.rang = 1 then '>>> RETENU PAR LE SITE'
            when pt.is_active then 'ignoré (un prono plus récent existe)'
            else 'sur un match bonus DÉSACTIVÉ — ne compte pas' end
       || ' · ' || pt.home_team || ' – ' || pt.away_team
       || ' · il a mis ' || pt.home_prediction || '-' || pt.away_prediction
       || ' · posé le ' || to_char(pt.created_at, 'DD/MM à HH24:MI')
       || ' · ' || pt.pts || ' pt(s)'
from points pt
union all
select 4, 'SON PRONO', 'AUCUN prono de ce joueur sur le match bonus'
where not exists (select 1 from points)

union all
select 5, 'RÉSULTAT',
       'Points bonus comptés aujourd''hui pour lui : '
       || coalesce((select pt.pts from points pt where pt.is_active and pt.rang = 1), 0) || ' pt(s)'

order by ordre;
