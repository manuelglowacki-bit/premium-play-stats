-- ============================================================
-- VÉRIFIER UNE JOURNÉE APRÈS LES MATCHS
-- ============================================================
-- Recalcule le classement d'une journée EN SQL, avec exactement le même
-- barème que le site, pour pouvoir comparer les deux.
--
--   match de Ligue 1 ordinaire : bon résultat            1 pt
--   match du club de cœur      : score exact 2, résultat 1
--   match bonus                : score exact 3, résultat 2
--
-- Si le site affiche autre chose que cette requête, c'est qu'il y a un
-- problème — et l'écart dira lequel.
--
-- ⚠️ CHANGE LE NUMÉRO DE JOURNÉE juste en dessous.
-- ============================================================

with parametres as (
  select 2 as journee            -- <<<<<< LE NUMÉRO À VÉRIFIER
),

-- La journée de Ligue 1 concernée (les 4 championnats bonus ont leurs
-- propres journées portant les mêmes numéros : il faut filtrer).
journee_l1 as (
  select md.id, md.number
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where md.number = p.journee and c.name = 'Ligue 1'
),

-- Le match bonus retenu pour chaque joueur : celui de la ligne d'option
-- ACTIVE de cette journée, et le pronostic le plus récent s'il y en a
-- plusieurs. Même règle que le site.
candidats as (
  select bo.match_id
  from bonus_options bo
  join journee_l1 j on j.id = bo.matchday_id
  where bo.is_active = true
),
bonus_retenu as (
  select distinct on (p.user_id)
    p.user_id, p.match_id, p.home_prediction, p.away_prediction
  from predictions p
  join candidats c on c.match_id = p.match_id
  order by p.user_id, p.created_at desc
),

-- Points du match bonus.
points_bonus as (
  select
    br.user_id,
    case
      when mt.home_score is null or not mt.finished then 0
      when mt.home_score = br.home_prediction and mt.away_score = br.away_prediction then 3
      when sign(mt.home_score - mt.away_score) = sign(br.home_prediction - br.away_prediction) then 2
      else 0
    end as pts
  from bonus_retenu br
  join matches mt on mt.id = br.match_id
),

-- Points des matchs de Ligue 1, club de cœur compris.
points_l1 as (
  select
    p.user_id,
    sum(
      case
        when mt.home_score is null or not mt.finished then 0
        -- Club de cœur : le match implique l'équipe favorite du joueur
        when pr.favorite_team_id is not null
         and pr.favorite_team_id in (mt.home_team_id, mt.away_team_id) then
          case
            when mt.home_score = p.home_prediction and mt.away_score = p.away_prediction then 2
            when sign(mt.home_score - mt.away_score) = sign(p.home_prediction - p.away_prediction) then 1
            else 0
          end
        -- Match ordinaire
        when sign(mt.home_score - mt.away_score) = sign(p.home_prediction - p.away_prediction) then 1
        else 0
      end
    ) as pts
  from predictions p
  join matches mt   on mt.id = p.match_id
  join journee_l1 j on j.id = mt.matchday_id
  join profiles pr  on pr.id = p.user_id
  where mt.is_bonus = false
  group by p.user_id
)

select
  trim(pr.pseudo)                                   as joueur,
  coalesce(l1.pts, 0)                               as points_ligue1_et_coeur,
  coalesce(b.pts, 0)                                as points_bonus,
  coalesce(l1.pts, 0) + coalesce(b.pts, 0)          as total_journee,
  case when b.user_id is null then 'pas de bonus joue' else '' end as remarque
from profiles pr
left join points_l1    l1 on l1.user_id = pr.id
left join points_bonus b  on b.user_id  = pr.id
order by total_journee desc, joueur;

-- ------------------------------------------------------------
-- NOTE SUR LE CLUB DE CŒUR
-- ------------------------------------------------------------
-- Cette requête utilise le club de cœur ACTUEL du joueur
-- (profiles.favorite_team_id). Le site, lui, sait retrouver le club de cœur
-- de l'époque pour les saisons passées. Sur la saison en cours les deux sont
-- identiques ; l'écart ne pourrait apparaître que si un joueur a change de
-- club de cœur en cours de saison.
