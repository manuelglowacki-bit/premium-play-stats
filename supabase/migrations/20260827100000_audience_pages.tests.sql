-- ============================================================
-- AUDIENCE — TESTS DE SÉCURITÉ ET DE COMPTAGE
-- ============================================================
-- Ce fichier ne sert pas au déploiement : il rejoue la migration sur un
-- PostgreSQL neuf et vérifie, avec de vrais rôles et la RLS réellement
-- active, ce que chacun peut faire. Les règles écrites dans la migration ne
-- valent que si on les a vues refuser quelque chose.
-- ============================================================

\set ON_ERROR_STOP on

create schema if not exists auth;

-- Le strict nécessaire pour rejouer la migration hors de Supabase.
create table if not exists auth.users (id uuid primary key);
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text,
  is_admin boolean not null default false
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

grant usage on schema public, auth to anon, authenticated;

\ir 20260827100000_audience_pages.sql

-- ---------- Jeu d'essai ----------
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

insert into public.profiles (id, pseudo, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'Red Evils', true),
  ('22222222-2222-2222-2222-222222222222', 'Mel11', false),
  ('33333333-3333-3333-3333-333333333333', 'Joueur 12', false);

create table resultats (nom text, ok boolean, detail text);

create or replace function verifier(p_nom text, p_ok boolean, p_detail text default '')
returns void language sql as $$
  insert into resultats values (p_nom, p_ok, p_detail);
$$;

create or replace function devient(p_user text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user, false);
end $$;

-- ============================================================
-- 1. COMPTAGE
-- ============================================================
set role authenticated;
select devient('22222222-2222-2222-2222-222222222222');

select public.enregistrer_vue_page('/pronostics');
select public.enregistrer_vue_page('/pronostics');
select public.enregistrer_vue_page('/classement');

reset role;
select verifier(
  'Deux vues de la meme page le meme jour : une seule ligne, compteur a 2',
  (select vues from public.page_stats
    where user_id = '22222222-2222-2222-2222-222222222222' and page = '/pronostics') = 2,
  (select coalesce(vues::text, 'aucune ligne') from public.page_stats
    where user_id = '22222222-2222-2222-2222-222222222222' and page = '/pronostics')
);

select verifier(
  'Deux pages differentes : deux lignes',
  (select count(*) from public.page_stats
    where user_id = '22222222-2222-2222-2222-222222222222') = 2
);

-- ============================================================
-- 2. NORMALISATION ET REFUS SILENCIEUX
-- ============================================================
set role authenticated;
select devient('33333333-3333-3333-3333-333333333333');

select public.enregistrer_vue_page('/Classement');          -- majuscules
select public.enregistrer_vue_page('/classement/');         -- barre finale
select public.enregistrer_vue_page('/classement?journee=3'); -- parametre
select public.enregistrer_vue_page('/classement#haut');      -- ancre

reset role;
select verifier(
  'Majuscules, barre finale, parametre et ancre : une seule et meme page',
  (select vues from public.page_stats
    where user_id = '33333333-3333-3333-3333-333333333333' and page = '/classement') = 4,
  (select coalesce(vues::text, 'aucune ligne') from public.page_stats
    where user_id = '33333333-3333-3333-3333-333333333333' and page = '/classement')
);

set role authenticated;
select devient('33333333-3333-3333-3333-333333333333');

-- Aucun de ces appels ne doit rien enregistrer, ni lever d'erreur.
select public.enregistrer_vue_page('Red Evils a triche');
select public.enregistrer_vue_page('/profil/<script>alert(1)</script>');
select public.enregistrer_vue_page(null);
select public.enregistrer_vue_page('/' || repeat('a', 60));
select public.enregistrer_vue_page('https://exemple.fr/espion');

reset role;
select verifier(
  'Texte libre, balise, valeur nulle, chemin demesure, adresse complete : rien enregistre',
  (select count(*) from public.page_stats
    where user_id = '33333333-3333-3333-3333-333333333333') = 1,
  (select string_agg(page, ' | ') from public.page_stats
    where user_id = '33333333-3333-3333-3333-333333333333')
);

-- ============================================================
-- 3. UN JOUEUR NE PEUT COMPTER QUE POUR LUI
-- ============================================================
set role authenticated;
select devient('22222222-2222-2222-2222-222222222222');

do $$
declare avant integer; apres integer;
begin
  select count(*) into avant from public.page_stats;
  begin
    insert into public.page_stats (user_id, page, jour, vues)
    values ('33333333-3333-3333-3333-333333333333', '/stats', current_date, 999);
  exception when others then null;
  end;
  select count(*) into apres from public.page_stats;
  perform set_config('tests.insert_direct', (avant = apres)::text, false);
end $$;

reset role;
select verifier(
  'Un joueur ne peut pas ecrire directement dans la table',
  current_setting('tests.insert_direct')::boolean
);

-- ============================================================
-- 4. LECTURE : ADMIN SEULEMENT
-- ============================================================
set role authenticated;
select devient('22222222-2222-2222-2222-222222222222');
select count(*) as vu_par_un_joueur from public.page_stats \gset
reset role;

select verifier(
  'Un joueur ne voit AUCUNE ligne de la table',
  :vu_par_un_joueur = 0,
  :vu_par_un_joueur || ' ligne(s) visible(s)'
);

set role authenticated;
select devient('11111111-1111-1111-1111-111111111111');
select count(*) as vu_par_admin from public.page_stats \gset
reset role;

select verifier(
  'L''admin voit toutes les lignes',
  :vu_par_admin = 3,
  :vu_par_admin || ' ligne(s) visible(s)'
);

-- ============================================================
-- 5. LES RESUMES SUIVENT LA MEME REGLE
-- ============================================================
set role authenticated;
select devient('22222222-2222-2222-2222-222222222222');
select count(*) as resume_joueur from public.audience_par_page(current_date - 30) \gset
select count(*) as detail_joueur from public.audience_par_joueur(current_date - 30) \gset
reset role;

select verifier(
  'Un joueur qui appelle le resume n''obtient rien',
  :resume_joueur = 0 and :detail_joueur = 0,
  'resume=' || :resume_joueur || ' detail=' || :detail_joueur
);

set role authenticated;
select devient('11111111-1111-1111-1111-111111111111');
select vues as vues_pronostics from public.audience_par_page(current_date - 30) where page = '/pronostics' \gset
select joueurs as joueurs_classement from public.audience_par_page(current_date - 30) where page = '/classement' \gset
reset role;

select verifier(
  'Resume admin : 2 vues sur /pronostics',
  :vues_pronostics = 2, :vues_pronostics::text
);

select verifier(
  'Resume admin : /classement compte DEUX joueurs distincts',
  :joueurs_classement = 2, :joueurs_classement::text
);

-- ============================================================
-- 6. LA PERIODE EST RESPECTEE
-- ============================================================
insert into public.page_stats (user_id, page, jour, vues)
values ('22222222-2222-2222-2222-222222222222', '/gazette', current_date - 200, 50);

set role authenticated;
select devient('11111111-1111-1111-1111-111111111111');
select count(*) as gazette_recente from public.audience_par_page(current_date - 30) where page = '/gazette' \gset
reset role;

select verifier(
  'Une vue d''il y a 200 jours n''apparait pas sur 30 jours',
  :gazette_recente = 0
);

-- ============================================================
-- 7. PURGE
-- ============================================================
select public.purger_audience();
select verifier(
  'La purge supprime au-dela de 90 jours, et rien d''autre',
  (select count(*) from public.page_stats) = 3
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

-- Fait echouer le script si une seule verification est tombee : la division
-- devient 1/0 des qu'il y a un echec. (Ecrit ainsi, et non avec un CASE
-- contenant 1/0, parce que PostgreSQL evalue une division constante des la
-- planification et leverait l'erreur meme quand tout passe.)
select 1 / (count(*) filter (where not ok) = 0)::int as tous_verts from resultats;
