-- ============================================================
-- LES MATCHS BONUS SONT-ILS RATTACHÉS À LA BONNE JOURNÉE ?
-- ============================================================
-- Piste ouverte par le relevé précédent : Atlético–Villarreal et
-- Liverpool–Nottingham, qui ne sont manifestement pas des matchs de Ligue 1,
-- ressortaient comme « pas des matchs bonus ».
--
-- Ce que fait l'application (src/lib/leaderboardStats.ts) :
--   * un match compte comme bonus s'il existe une ligne bonus_options pour
--     lui — le matchday_id du match lui-même n'entre pas en compte ;
--   * le bonus est ensuite attribué à la journée indiquée par
--     bonus_options.matchday_id.
--
-- Si ces deux journées divergent, le bonus est compté sur une journée et le
-- match affiché sur une autre. Les points partent alors sur la mauvaise
-- journée, sans que rien n'ait été effacé.
--
-- QUE DES SELECT : rien n'est modifié.
-- ============================================================

-- ------------------------------------------------------------
-- 1) LE POINT DÉCISIF — chaque ligne bonus_options et ses deux journées
-- ------------------------------------------------------------
select
  jo.number                             as journee_de_l_option,
  jm.number                             as journee_du_match,
  case when bo.matchday_id = mt.matchday_id then 'ok' else '>>> DIVERGENCE <<<' end as verdict,
  mt.home_team || ' – ' || mt.away_team as match_bonus,
  bo.competition_code,
  mt.finished,
  mt.home_score || ' - ' || mt.away_score as score,
  (select count(*) from predictions p where p.match_id = mt.id) as joueurs_ayant_joue
from bonus_options bo
join matches mt         on mt.id = bo.match_id
left join matchdays jo  on jo.id = bo.matchday_id
left join matchdays jm  on jm.id = mt.matchday_id
order by jo.number nulls first, jm.number, joueurs_ayant_joue desc;

-- ------------------------------------------------------------
-- 2) COMBIEN D'OPTIONS PAR JOURNÉE ?
-- ------------------------------------------------------------
-- Il devrait y en avoir 4 par journée (les 4 candidats du tirage). Beaucoup
-- plus = d'anciens tirages jamais nettoyés, et autant d'occasions pour le
-- site de se tromper de bonus.
select
  jo.number  as journee,
  count(*)   as nombre_d_options
from bonus_options bo
left join matchdays jo on jo.id = bo.matchday_id
group by jo.number
order by jo.number nulls first;

-- ------------------------------------------------------------
-- 3) QUI A JOUÉ QUEL BONUS, PAR JOURNÉE
-- ------------------------------------------------------------
-- La journée retenue est celle de bonus_options — exactement la règle
-- qu'applique le calcul des points.
select
  jo.number                             as journee_bonus,
  trim(pr.pseudo)                       as joueur,
  mt.home_team || ' – ' || mt.away_team as son_bonus,
  mt.finished,
  mt.home_score || ' - ' || mt.away_score          as score_reel,
  p.home_prediction || ' - ' || p.away_prediction  as son_prono
from predictions p
join bonus_options bo  on bo.match_id = p.match_id
join matches mt        on mt.id = p.match_id
join profiles pr       on pr.id = p.user_id
left join matchdays jo on jo.id = bo.matchday_id
order by jo.number nulls first, joueur;

-- ------------------------------------------------------------
-- 4) QUI N'A AUCUN BONUS SUR UNE JOURNÉE OÙ IL A POURTANT JOUÉ
-- ------------------------------------------------------------
-- Les victimes probables de la suppression. Un joueur qui pronostique la
-- Ligue 1 sans jouer le bonus, c'est très inhabituel.
with journees_jouees as (
  select distinct p.user_id, mt.matchday_id
  from predictions p
  join matches mt on mt.id = p.match_id
  where mt.matchday_id is not null
),
bonus_joues as (
  select distinct p.user_id, bo.matchday_id
  from predictions p
  join bonus_options bo on bo.match_id = p.match_id
)
select
  md.number       as journee,
  trim(pr.pseudo) as joueur_sans_bonus
from journees_jouees jj
join matchdays md on md.id = jj.matchday_id
join profiles pr  on pr.id = jj.user_id
where not exists (
  select 1 from bonus_joues bj
  where bj.user_id = jj.user_id and bj.matchday_id = jj.matchday_id
)
order by md.number, joueur_sans_bonus;
