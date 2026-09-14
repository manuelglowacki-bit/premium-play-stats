-- ============================================================
-- DIAGNOSTIC — POURQUOI LE DEBRIEF NE PASSE PAS A LA JOURNEE SUIVANTE
-- ============================================================
-- Le Debrief ne raconte une journee que lorsque TOUS ses matchs sont
-- termines, match bonus compris. S'il reste sur la J3 alors que la J4 est
-- jouee, c'est qu'un match de la J4 n'est pas vu comme termine.
--
-- Cette requete ne modifie RIEN. Elle liste, journee par journee, chaque
-- match avec son verdict :
--
--   ok       -> ce match ne bloque rien
--   BLOQUE   -> c'est lui qui empeche la journee d'etre racontee
--
-- La colonne `pourquoi` dit quoi corriger : score manquant, match a venir,
-- date de coup d'envoi fausse...
--
-- COMMENT L'UTILISER
--   Supabase -> SQL Editor -> coller -> Run.
--   Regarde les lignes « BLOQUE » de la journee qui devrait etre racontee.
-- ============================================================

with parametres as (
  select 3::int as depuis_la_journee   -- <<< a partir de quelle journee regarder
),

journees_l1 as (
  select md.id, md.number
  from matchdays md
  join competitions c on c.id = md.competition_id
  join parametres p on true
  where (c.external_code = 'FL1' or c.code = 'FL1' or c.name = 'Ligue 1')
    and md.number >= p.depuis_la_journee
),

-- LE TIRAGE BONUS EN VIGUEUR, un seul par journee : la ligne active la plus
-- recente. Les anciennes lignes gardent leurs points mais ne bloquent plus.
bonus_en_vigueur as (
  select distinct on (bo.matchday_id)
    bo.matchday_id, bo.match_id
  from bonus_options bo
  join journees_l1 j on j.id = bo.matchday_id
  order by bo.matchday_id,
           (bo.is_active is true) desc,
           bo.created_at desc nulls last,
           bo.match_id asc
),

-- Tous les matchs qui comptent pour une journee : la Ligue 1 + le bonus.
matchs_de_la_journee as (
  select j.number as journee, 'Ligue 1'::text as role, m.*
  from journees_l1 j
  join matches m on m.matchday_id = j.id
  where coalesce(m.match_type, 'LIGUE1') = 'LIGUE1'

  union all

  select j.number as journee, 'BONUS'::text as role, m.*
  from journees_l1 j
  join bonus_en_vigueur b on b.matchday_id = j.id
  join matches m on m.id = b.match_id
)

select
  journee,
  role,
  home_team || ' - ' || away_team as match,
  coalesce(home_score::text, '?') || ' - ' || coalesce(away_score::text, '?') as score,
  coalesce(status, '(aucun)') as statut,
  kickoff,
  case
    when home_score is null or away_score is null then 'BLOQUE'
    when kickoff is not null and kickoff > now()  then 'BLOQUE'
    when upper(coalesce(status, '')) in
         ('POSTPONED','CANCELLED','CANCELED','SUSPENDED')  then 'BLOQUE'
    else 'ok'
  end as verdict,
  case
    when home_score is null or away_score is null
      then 'Score manquant -> Admin, saisir le score de ce match'
    when kickoff is not null and kickoff > now()
      then 'Coup d''envoi dans le futur -> corriger la date du match dans Admin'
    when upper(coalesce(status, '')) in
         ('POSTPONED','CANCELLED','CANCELED','SUSPENDED')
      then 'Match reporte ou annule -> il bloquera tant qu''il ne sera pas joue'
    else ''
  end as pourquoi
from matchs_de_la_journee
order by journee, role desc, kickoff nulls last;
