-- ============================================================
-- SYNCHRONISATION AUTOMATIQUE — TESTS DE LA FENÊTRE
-- ============================================================
-- Ce fichier ne sert pas au déploiement. Il rejoue la migration sur un
-- PostgreSQL neuf (avec de faux Vault / pg_cron / pg_net) et vérifie la seule
-- chose qui décide vraiment quelque chose : QUAND la synchronisation part.
--
-- Deux erreurs possibles, aussi graves l'une que l'autre :
--   * partir tout le temps — on brûle le quota football-data.org pour rien ;
--   * ne pas partir quand il faut — les points ne tombent pas.
-- ============================================================

\set ON_ERROR_STOP on

create table resultats (nom text, ok boolean, detail text);

create or replace function verifier(p_nom text, p_ok boolean, p_detail text default '')
returns void language sql as $$ insert into resultats values (p_nom, p_ok, p_detail); $$;

-- Repart d'un calendrier vide avant chaque scenario.
create or replace function vider() returns void language sql as $$ delete from public.matches; $$;

create or replace function match_a(p_decalage interval, p_score boolean, p_ligue1 boolean default true)
returns void language sql as $$
  insert into public.matches (matchday_id, kickoff, home_score, away_score)
  values (
    case when p_ligue1 then 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
         else 'bbbbbbbb-0000-0000-0000-000000000001'::uuid end,
    now() + p_decalage,
    case when p_score then 2 else null end,
    case when p_score then 1 else null end
  );
$$;

-- ============================================================
-- 1. PENDANT UN MATCH
-- ============================================================
select vider();
select match_a(interval '-30 minutes', false);
select verifier('Match commence il y a 30 min, sans score : on synchronise', public.sync_resultats_necessaire());

select vider();
select match_a(interval '-2 hours', true);
select verifier('Match fini il y a 2 h, score deja la : on synchronise quand meme (il peut etre corrige)', public.sync_resultats_necessaire());

select vider();
select match_a(interval '-2 minutes', false);
select verifier('Coup d''envoi il y a 2 min : on synchronise', public.sync_resultats_necessaire());

select vider();
select match_a(interval '4 minutes', false);
select verifier('Coup d''envoi dans 4 min : on synchronise deja', public.sync_resultats_necessaire());

-- ============================================================
-- 2. QUAND IL N'Y A RIEN A CHERCHER
-- ============================================================
select vider();
select verifier('Aucun match en base : on n''appelle personne', not public.sync_resultats_necessaire());

select vider();
select match_a(interval '3 days', false);
select verifier('Prochain match dans 3 jours : on n''appelle personne', not public.sync_resultats_necessaire());

select vider();
select match_a(interval '20 minutes', false);
select verifier('Coup d''envoi dans 20 min : trop tot, on attend', not public.sync_resultats_necessaire());

select vider();
select match_a(interval '-5 hours', true);
select verifier('Match fini il y a 5 h avec son score : plus rien a faire', not public.sync_resultats_necessaire());

select vider();
select match_a(interval '-30 days', true);
select match_a(interval '-60 days', true);
select verifier('Saison passee entierement renseignee : silence', not public.sync_resultats_necessaire());

-- ============================================================
-- 3. LE FILET DE SECURITE : UN RESULTAT QUI MANQUE
-- ============================================================
select vider();
select match_a(interval '-14 hours', false);
select verifier(
  'Match d''hier soir SANS score : on reessaie tout seul (le cas LOSC-PSG)',
  public.sync_resultats_necessaire()
);

select vider();
select match_a(interval '-2 days', false);
select verifier('Match d''avant-hier sans score : on reessaie encore', public.sync_resultats_necessaire());

select vider();
select match_a(interval '-4 days', false);
select verifier(
  'Match sans score depuis 4 jours : on abandonne, sinon la tache tourne a vide pour toujours',
  not public.sync_resultats_necessaire()
);

select vider();
select match_a(interval '-14 hours', false);
select match_a(interval '-14 hours', true);
select verifier(
  'Un seul match sans score parmi plusieurs suffit a declencher',
  public.sync_resultats_necessaire()
);

-- Un score a moitie saisi compte comme manquant.
select vider();
insert into public.matches (matchday_id, kickoff, home_score, away_score)
values ('aaaaaaaa-0000-0000-0000-000000000001', now() - interval '10 hours', 1, null);
select verifier('Score a moitie saisi : traite comme manquant', public.sync_resultats_necessaire());

-- ============================================================
-- 4. LIGUE 1 UNIQUEMENT
-- ============================================================
select vider();
select match_a(interval '-30 minutes', false, false);
select verifier(
  'Match de Premier League en cours : ne declenche PAS (la fonction ne synchronise que la Ligue 1)',
  not public.sync_resultats_necessaire()
);

select vider();
select match_a(interval '-2 days', false, false);
select verifier('Match etranger sans score : ne declenche pas non plus', not public.sync_resultats_necessaire());

select vider();
select match_a(interval '-30 minutes', false, false);
select match_a(interval '-30 minutes', false, true);
select verifier('Un match de Ligue 1 au milieu : declenche', public.sync_resultats_necessaire());

-- Un match orphelin (sans journee) ne doit pas faire planter la jointure.
select vider();
insert into public.matches (matchday_id, kickoff, home_score, away_score)
values (null, now() - interval '30 minutes', null, null);
select verifier('Match sans journee rattachee : ignore, aucune erreur', not public.sync_resultats_necessaire());

select vider();
insert into public.matches (matchday_id, kickoff, home_score, away_score)
values ('aaaaaaaa-0000-0000-0000-000000000001', null, null, null);
select verifier('Match sans date : ignore', not public.sync_resultats_necessaire());

-- ============================================================
-- 5. LA TACHE ELLE-MEME APPELLE, OU N'APPELLE PAS
-- ============================================================
-- On execute la vraie commande enregistree dans cron.job, et on compte les
-- appels reellement partis vers la fonction.
create or replace function jouer_la_tache() returns void language plpgsql as $$
declare v_command text;
begin
  select command into v_command from cron.job where jobname = 'prono-ligue1-sync-resultats';
  execute v_command;
end $$;

select vider();
delete from cron.appels;
select match_a(interval '-30 minutes', false);
select jouer_la_tache();
select verifier(
  'Pendant un match, la tache appelle bien la fonction',
  (select count(*) from cron.appels) = 1,
  (select count(*)::text from cron.appels)
);

select vider();
delete from cron.appels;
select match_a(interval '3 days', false);
select jouer_la_tache();
select verifier(
  'Un mardi sans match, la tache se reveille mais N''APPELLE PAS',
  (select count(*) from cron.appels) = 0,
  (select count(*)::text from cron.appels)
);


-- ============================================================
-- 6. LA TACHE EST BIEN RECOPIEE DEPUIS LES RAPPELS
-- ============================================================
-- Le script ne lit plus aucun secret : il recopie la commande qui marche
-- deja. Ce qui doit etre vrai quelle que soit la facon dont l'adresse et le
-- secret y sont ecrits.

select verifier(
  'La commande de synchro appelle bien sync-ligue1-matches',
  (select position('sync-ligue1-matches' in command) > 0
   from cron.job where jobname = 'prono-ligue1-sync-resultats')
);

select verifier(
  'Elle n''appelle plus send-prono-reminders',
  (select position('send-prono-reminders' in command) = 0
   from cron.job where jobname = 'prono-ligue1-sync-resultats')
);

select verifier(
  'Elle porte la condition qui evite les appels inutiles',
  (select position('sync_resultats_necessaire' in command) > 0
   from cron.job where jobname = 'prono-ligue1-sync-resultats')
);

select verifier(
  'Le secret des rappels est transmis tel quel, sans que le script l''ait lu',
  (select position('x-cron-secret' in command) > 0
   from cron.job where jobname = 'prono-ligue1-sync-resultats')
);

select verifier(
  'Une seule tache de synchronisation, meme apres plusieurs passages',
  (select count(*) from cron.job where jobname like 'prono-ligue1-sync%') = 1,
  (select count(*)::text from cron.job where jobname like 'prono-ligue1-sync%')
);

-- ============================================================
-- RESULTAT
-- ============================================================
\echo ''
select case when ok then '  ok    ' else '  ECHEC ' end || nom ||
       case when ok or detail = '' then '' else ' — ' || detail end as resultat
from resultats;

\echo ''
select case
  when count(*) filter (where not ok) = 0
    then count(*) || '/' || count(*) || ' verifications passees.'
  else count(*) filter (where not ok) || ' ECHEC(S) sur ' || count(*) || '.'
end as bilan
from resultats;

select 1 / (count(*) filter (where not ok) = 0)::int as tous_verts from resultats;
