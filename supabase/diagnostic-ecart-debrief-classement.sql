-- ============================================================
-- DIAGNOSTIC — POURQUOI LE DEBRIEF N'AVAIT PAS LES MEMES POINTS
-- ============================================================
-- Le Debrief affichait 51 points a un joueur que le Classement donnait a 25.
-- Deux causes possibles, et cette requete dit laquelle (ou les deux).
--
-- Elle ne modifie RIEN, elle ne fait que lire. Supabase -> SQL Editor ->
-- coller -> Run. Trois tableaux sortent a la suite.
-- ============================================================

-- 1. Y A-T-IL PLUSIEURS SAISONS EN BASE ?
--    Si oui, les « journees 1 » de chaque saison portent le meme numero et
--    leurs points s'additionnaient.
select
  '1. SAISONS' as controle,
  coalesce(md.season, '(vide)') as saison,
  count(*)                     as nb_journees,
  min(md.number)               as premiere,
  max(md.number)               as derniere
from matchdays md
group by md.season
order by md.season nulls first;

-- 2. DES MATCHS BONUS SONT-ILS RATTACHES A UNE JOURNEE DE LIGUE 1 ?
--    Si oui, l'ancien filtre du Debrief les comptait DEUX fois : une fois
--    comme match de championnat, une fois comme match bonus.
select
  '2. BONUS DANS UNE JOURNEE L1' as controle,
  md.number                      as journee,
  m.home_team || ' - ' || m.away_team as match,
  m.is_bonus,
  m.match_type
from matches m
join matchdays md   on md.id = m.matchday_id
join competitions c on c.id = md.competition_id
where m.is_bonus is true
  and (c.external_code = 'FL1' or c.code = 'FL1' or c.name = 'Ligue 1')
order by md.number;

-- 3. LE TOTAL PAR JOUEUR, SAISON PAR SAISON.
--    Comparer la ligne de la saison en cours avec ce qu'affiche le
--    Classement : les deux doivent coincider. Le barème officiel est
--    applique ici (score exact 3, bon resultat 2, sinon 0) — hors bonus
--    club favori, qui ne se calcule pas en SQL.
select
  '3. POINTS PAR SAISON' as controle,
  coalesce(md.season, '(vide)') as saison,
  pr.pseudo,
  sum(
    case
      when m.home_score is null or m.away_score is null then 0
      when p.home_prediction = m.home_score and p.away_prediction = m.away_score then 3
      when sign(p.home_prediction - p.away_prediction) = sign(m.home_score - m.away_score) then 2
      else 0
    end
  ) as points
from predictions p
join matches m    on m.id = p.match_id
join matchdays md on md.id = m.matchday_id
join profiles pr  on pr.id = p.user_id
where m.is_bonus is not true
group by md.season, pr.pseudo
order by md.season nulls first, points desc;
