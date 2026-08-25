-- ============================================================
-- QUI A PERDU SON PRONOSTIC BONUS ?
-- ============================================================
-- Cause : en validant un bonus, le site nettoyait les autres candidats de la
-- journée. Ce nettoyage épargnait les matchs « déjà commencés », mais se
-- fiait pour cela à la DATE LIMITE de la journée — laquelle peut ne pas
-- exister sur les journées créées avant que le verrouillage automatique ne
-- devienne le réglage par défaut. Sans date limite, un match TERMINÉ passait
-- pour « pas encore commencé », et son pronostic était effacé.
--
-- Le correctif regarde désormais l'état réel du match (terminé, score saisi,
-- coup d'envoi passé). Reste à savoir qui a déjà perdu quelque chose.
--
-- RIEN ICI NE MODIFIE QUOI QUE CE SOIT : que des SELECT.
-- ============================================================

-- ------------------------------------------------------------
-- 1) LES JOURNÉES À RISQUE
-- ------------------------------------------------------------
-- Celles sans verrouillage automatique NI date limite : ce sont exactement
-- celles où le garde-fou ne fonctionnait pas.
select
  m.number            as journee,
  m.deadline_mode,
  m.deadline,
  case
    when m.deadline_mode = 'auto_minus_1' then 'protégée'
    when m.deadline is not null           then 'protégée'
    else 'À RISQUE — aucun verrouillage'
  end as etat
from matchdays m
order by m.number;

-- ------------------------------------------------------------
-- 2) QUI A UN PRONOSTIC BONUS, ET QUI N'EN A PAS
-- ------------------------------------------------------------
-- Un joueur qui a pronostiqué la Ligue 1 d'une journée mais n'a AUCUN
-- pronostic sur les matchs bonus de cette même journée est un candidat
-- sérieux : il est très improbable de jouer la Ligue 1 sans jouer le bonus.
with bonus_de_la_journee as (
  select bo.matchday_id, bo.match_id
  from bonus_options bo
),
joueurs_actifs as (
  select distinct
    p.user_id,
    mt.matchday_id
  from predictions p
  join matches mt on mt.id = p.match_id
  where mt.matchday_id is not null
)
select
  md.number                                  as journee,
  trim(pr.pseudo)                            as joueur,
  count(pb.match_id) filter (where pb.match_id is not null) as pronos_bonus
from joueurs_actifs ja
join matchdays md on md.id = ja.matchday_id
join profiles pr  on pr.id = ja.user_id
left join bonus_de_la_journee bj on bj.matchday_id = ja.matchday_id
left join predictions pb
       on pb.user_id  = ja.user_id
      and pb.match_id = bj.match_id
group by md.number, trim(pr.pseudo)
having count(pb.match_id) filter (where pb.match_id is not null) = 0
order by md.number, joueur;

-- ------------------------------------------------------------
-- 3) LES MATCHS BONUS TERMINÉS, ET COMBIEN DE JOUEURS LES ONT JOUÉS
-- ------------------------------------------------------------
-- Sert de point de comparaison : si 22 joueurs sur 23 ont un pronostic sur un
-- match bonus donné et qu'un seul n'en a pas, ce n'est pas un hasard.
select
  md.number                        as journee,
  mt.home_team || ' – ' || mt.away_team as match_bonus,
  mt.finished,
  mt.home_score,
  mt.away_score,
  count(p.user_id)                 as joueurs_avec_prono
from bonus_options bo
join matches   mt on mt.id = bo.match_id
join matchdays md on md.id = bo.matchday_id
left join predictions p on p.match_id = mt.id
group by md.number, mt.home_team, mt.away_team, mt.finished, mt.home_score, mt.away_score
order by md.number, joueurs_avec_prono;

-- ------------------------------------------------------------
-- 4) TON CAS PRÉCIS
-- ------------------------------------------------------------
-- Remplace le pseudo si besoin. Liste TOUS tes pronostics par journée, pour
-- voir d'un coup d'œil ce qui manque.
select
  md.number                             as journee,
  mt.home_team || ' – ' || mt.away_team as match,
  mt.finished,
  mt.home_score || ' - ' || mt.away_score as score_reel,
  p.home_score  || ' - ' || p.away_score  as ton_prono,
  (bo.match_id is not null)             as est_un_match_bonus
from predictions p
join matches   mt on mt.id = p.match_id
join matchdays md on md.id = mt.matchday_id
join profiles  pr on pr.id = p.user_id
left join bonus_options bo on bo.match_id = mt.id and bo.matchday_id = md.id
where trim(pr.pseudo) = 'Mel11'
order by md.number, est_un_match_bonus, mt.kickoff;
