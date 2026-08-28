-- ============================================================
-- AUDIENCE — QUELLES PAGES LES JOUEURS UTILISENT
-- ============================================================
-- Question posée : « est-ce que je peux savoir quelle page les joueurs
-- utilisent le plus ». Et derrière, la vraie : « si je bloque la Gazette et
-- les Stats pour le groupe du travail, qu'est-ce que je perds ». Un compteur
-- anonyme répondrait « la Gazette : 41 vues » ; ce qu'il faut savoir, c'est si
-- ces 41 vues viennent de 3 joueurs ou de 20.
--
-- CE QU'ON N'ENREGISTRE PAS, et c'est délibéré :
--   * aucune adresse IP, aucun user-agent, aucun identifiant de navigateur ;
--   * aucun paramètre d'URL (jamais de contenu, jamais d'identifiant de match
--     ou de joueur consulté) ;
--   * rien pour les visiteurs non connectés.
-- Un joueur, une page, un jour, un compteur. Rien de plus.
--
-- PAS UNE LIGNE PAR VUE : une ligne par (joueur, page, jour), incrémentée.
-- À 23 joueurs cela fait au plus ~5 500 lignes par mois au lieu de dizaines de
-- milliers, et l'Admin lit un tableau déjà agrégé plutôt que de compter
-- lui-même. Le stockage reste sous le mégaoctet par mois.
--
-- À EXÉCUTER dans Supabase → SQL Editor. Le script est rejouable.
-- ============================================================

-- ---------- 1. La table ----------
create table if not exists public.page_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Chemin de la page, normalisé côté fonction ci-dessous. Jamais de
  -- paramètres : « /pronostics », pas « /pronostics?journee=3 ».
  page text not null,
  -- Jour civil français : c'est ainsi que l'admin lit ses chiffres, et cela
  -- évite qu'une soirée de pronostics soit coupée en deux par le passage à
  -- minuit UTC.
  jour date not null,
  vues integer not null default 0,

  primary key (user_id, page, jour),

  -- Même règle qu'une expression régulière ancrée aux deux bouts, mais écrite
  -- sans le caractère dollar : l'éditeur SQL de Supabase découpe le script en
  -- instructions avant de l'envoyer, et un dollar isolé dans un texte lui fait
  -- perdre le compte des délimiteurs de corps de fonction. Le script échouait
  -- donc chez lui alors qu'il passait sur un PostgreSQL normal.
  constraint page_stats_page_check check (
    page like '/%'
    and char_length(page) <= 39
    and page !~ '[^a-z0-9/-]'
  ),
  constraint page_stats_vues_check check (vues >= 0)
);

-- L'Admin interroge toujours « depuis telle date » : c'est le seul index utile.
create index if not exists page_stats_jour_idx on public.page_stats (jour desc);

-- ---------- 2. Verrouillage ----------
alter table public.page_stats enable row level security;
-- `force` vaut aussi pour le propriétaire de la table : sans lui, une requête
-- exécutée avec ce rôle contournerait silencieusement les règles ci-dessous.
alter table public.page_stats force row level security;

revoke all on public.page_stats from anon, authenticated;
-- Lecture seule, et pour les admins uniquement (la règle RLS ci-dessous
-- restreint encore) : un joueur n'a aucune raison de savoir ce que les autres
-- consultent.
grant select on public.page_stats to authenticated;

drop policy if exists "page_stats_select_admin" on public.page_stats;
create policy "page_stats_select_admin"
  on public.page_stats
  for select
  to authenticated
  using (public.is_admin());

-- AUCUNE politique d'écriture, volontairement. Personne n'écrit dans cette
-- table directement — ni un joueur, ni un admin. Le seul chemin est la
-- fonction ci-dessous, qui s'exécute avec les droits de son propriétaire et ne
-- peut incrémenter que la ligne du joueur connecté.

-- ---------- 3. Le seul chemin d'écriture ----------
create or replace function public.enregistrer_vue_page(p_page text)
returns void
language plpgsql
security definer
-- search_path figé : sans cela, un schéma placé devant `public` pourrait
-- détourner les appels faits à l'intérieur d'une fonction security definer.
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_page text;
begin
  -- Visiteur non connecté : on ne compte rien, et surtout on ne lève pas
  -- d'erreur — l'application ne doit jamais casser à cause d'une statistique.
  if v_user is null then
    return;
  end if;

  -- Normalisation : minuscules, sans paramètres, sans barre oblique finale.
  v_page := lower(btrim(coalesce(p_page, '')));
  v_page := split_part(v_page, '?', 1);
  v_page := split_part(v_page, '#', 1);
  if length(v_page) > 1 then
    v_page := rtrim(v_page, '/');
  end if;
  -- Vide après nettoyage (appel nul, chaîne vide, ou une adresse qui n'était
  -- qu'un paramètre) : on ignore. Le repli vers '/' que contenait la première
  -- version d'ici comptait une visite sur l'accueil à chaque appel malformé —
  -- c'est le test « valeur nulle » qui l'a montré, pas une relecture.
  if v_page = '' then
    return;
  end if;

  -- Tout ce qui n'est pas un chemin simple est ignoré en silence. C'est ce qui
  -- garantit qu'aucun contenu (pseudo, identifiant, texte libre) ne peut
  -- atterrir dans cette table par un appel malformé. Écrit sans le caractère
  -- dollar, pour la même raison que la contrainte plus haut.
  if v_page not like '/%'
     or char_length(v_page) > 39
     or v_page ~ '[^a-z0-9/-]' then
    return;
  end if;

  insert into public.page_stats as s (user_id, page, jour, vues)
  values (v_user, v_page, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (user_id, page, jour)
  do update set vues = s.vues + 1;
end;
$$;

revoke all on function public.enregistrer_vue_page(text) from public, anon;
grant execute on function public.enregistrer_vue_page(text) to authenticated;

-- ---------- 4. Lecture agrégée, côté base ----------
-- L'Admin ne télécharge jamais les lignes brutes : il demande le résumé, la
-- base le calcule. Une dizaine de lignes au lieu de plusieurs milliers — même
-- raisonnement que pour le reste du site, la donnée qui ne transite pas est
-- celle qui ne coûte rien.
create or replace function public.audience_par_page(p_depuis date)
returns table (page text, vues bigint, joueurs bigint)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.page, sum(s.vues)::bigint, count(distinct s.user_id)::bigint
  from public.page_stats s
  where public.is_admin() and s.jour >= p_depuis
  group by s.page
  order by sum(s.vues) desc;
$$;

revoke all on function public.audience_par_page(date) from public, anon;
grant execute on function public.audience_par_page(date) to authenticated;

-- Le détail qui répond vraiment à la question « qui utilise quoi ».
create or replace function public.audience_par_joueur(p_depuis date)
returns table (user_id uuid, page text, vues bigint)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.user_id, s.page, sum(s.vues)::bigint
  from public.page_stats s
  where public.is_admin() and s.jour >= p_depuis
  group by s.user_id, s.page;
$$;

revoke all on function public.audience_par_joueur(date) from public, anon;
grant execute on function public.audience_par_joueur(date) to authenticated;

-- ---------- 5. Purge automatique ----------
-- Trois mois suffisent largement pour une tendance, et cela empêche la table
-- de grossir indéfiniment sur plusieurs saisons.
create or replace function public.purger_audience()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.page_stats where jour < current_date - interval '90 days';
$$;

revoke all on function public.purger_audience() from public, anon, authenticated;
