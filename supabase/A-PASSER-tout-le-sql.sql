-- ============================================================
-- TOUT LE SQL RESTANT — A COLLER EN UNE FOIS
-- ============================================================
-- Ce fichier couvre les deux choses qui attendent encore :
--
--   1. LE CHAMP « TON ARTICLE » dans Admin (le Debrief ecrit a la main)
--   2. LES REACTIONS EMOJI sur les articles du Debrief
--
-- Il est REJOUABLE et SANS PERTE. Que tu aies deja passe une partie des
-- migrations precedentes ou aucune, colle-le tel quel : rien n'est efface,
-- aucune reaction ni aucun texte deja enregistre n'est touche.
--
-- COMMENT FAIRE
--   Supabase -> SQL Editor -> coller -> Run.
--   A la fin, un tableau te dit ce qui est en place. Si un chiffre ne
--   correspond pas a ce qui est annonce, ne deploie pas et envoie-le-moi.
-- ============================================================


-- ============================================================
-- PARTIE 1 — LE DEBRIEF ECRIT A LA MAIN
-- ============================================================
-- Trois colonnes sur la ligne de reglages qui existe deja. Quand
-- `debrief_texte` est vide, la page redige elle-meme son article : il n'y a
-- donc jamais de page blanche, meme si tu n'ecris rien.
--
-- Aucun droit a ajouter : `app_settings` est deja reserve a l'organisateur
-- en ecriture et lisible par les joueurs connectes. Ces colonnes heritent de
-- cette regle.
alter table public.app_settings
  add column if not exists debrief_texte text,
  add column if not exists debrief_journee integer,
  add column if not exists debrief_maj timestamptz;

comment on column public.app_settings.debrief_texte is
  'Article du Debrief ecrit par l''organisateur. Vide = la page redige elle-meme.';
comment on column public.app_settings.debrief_journee is
  'Numero de journee que raconte debrief_texte, pour l''annonce sur l''Accueil.';
comment on column public.app_settings.debrief_maj is
  'Date du dernier enregistrement de debrief_texte.';


-- ============================================================
-- PARTIE 2 — LES REACTIONS DU DEBRIEF
-- ============================================================

-- ---------- 2.1 La table ----------
-- Ce qui est stocke, et rien de plus : qui, quelle journee, quel article,
-- quel emoji. AUCUN texte libre — rien a moderer, et le Debrief ne peut pas
-- servir a ecrire ce qu'on veut sur une page que tous les joueurs lisent.
create table if not exists public.debrief_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- La journee racontee par le Debrief au moment de la reaction.
  journee integer not null,
  -- La clef de l'article : `leader`, `chiffre`, `conclusion`... et non son
  -- titre, qui contient un pseudo et change d'une journee a l'autre.
  article text not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

comment on table public.debrief_reactions is
  'Reactions emoji des joueurs sur les articles du Debrief. Un joueur, un article, un emoji.';


-- ---------- 2.2 Ce qu'on accepte dans la colonne `emoji` ----------
-- LA CONTRAINTE LA PLUS IMPORTANTE DU FICHIER.
--
-- Le selecteur propose des centaines d'emojis : on ne peut plus les
-- enumerer. La regle dit donc « un symbole court, pas du texte » :
--
--   1 a 8 caracteres  -> assez pour un drapeau, une teinte de peau ou une
--                        famille ; trop court pour une phrase
--   aucune lettre     -> « arnaque » ne passe pas
--   aucun chiffre     -> « 42 » non plus
--   aucun espace      -> ni « 🔥 nul », ni un saut de ligne
--
-- Sans elle, `emoji` serait un champ de TEXTE LIBRE affiche sur une page lue
-- par tous les joueurs, sans moderation possible et sans que l'interface le
-- montre. Cette regle tient meme si quelqu'un appelle l'API directement,
-- sans passer par le site.
--
-- `drop` puis `add` : c'est ce qui rend le fichier rejouable, et ce qui
-- remplace proprement les anciennes listes fermees (six, puis douze emojis).
alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_emoji_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_emoji_valide check (
    char_length(emoji) between 1 and 8
    and emoji !~ '[[:alpha:]]'
    and emoji !~ '[[:digit:]]'
    and emoji !~ '[[:space:]]'
  );

comment on constraint debrief_reactions_emoji_valide on public.debrief_reactions is
  'Un symbole court, jamais du texte. Empeche la colonne emoji de devenir un champ libre.';

-- Garde-fous secondaires, ajoutes seulement s'ils manquent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'debrief_reactions_article_valide'
      and conrelid = 'public.debrief_reactions'::regclass
  ) then
    alter table public.debrief_reactions
      add constraint debrief_reactions_article_valide
      check (char_length(btrim(article)) between 1 and 40);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'debrief_reactions_journee_valide'
      and conrelid = 'public.debrief_reactions'::regclass
  ) then
    alter table public.debrief_reactions
      add constraint debrief_reactions_journee_valide
      check (journee between 1 and 60);
  end if;
end $$;


-- ---------- 2.3 Un joueur ne reagit qu'une fois par article ----------
-- Changer d'avis REMPLACE la reaction precedente au lieu d'en ajouter une.
-- Sans cet index, un double clic gonflerait le compteur : la garantie est
-- ici, dans la base, et non dans une verification du site qu'un reseau lent
-- suffirait a contourner.
create unique index if not exists debrief_reactions_une_par_joueur
  on public.debrief_reactions (user_id, journee, article);

-- Lecture de la page : toutes les reactions d'une journee, d'un coup.
create index if not exists debrief_reactions_par_journee
  on public.debrief_reactions (journee, article);


-- ---------- 2.4 Les droits ----------
alter table public.debrief_reactions enable row level security;

-- Tout joueur connecte VOIT les reactions : les compteurs sont publics dans
-- la ligue, c'est le principe.
drop policy if exists "debrief_reactions_lecture" on public.debrief_reactions;
create policy "debrief_reactions_lecture"
  on public.debrief_reactions
  for select
  to authenticated
  using (true);

-- Mais chacun n'ecrit que POUR LUI. `auth.uid() = user_id` est verifie par la
-- base : meme en appelant l'API a la main, un joueur ne peut pas reagir a la
-- place d'un autre, ni supprimer la reaction de quelqu'un.
drop policy if exists "debrief_reactions_ajout" on public.debrief_reactions;
create policy "debrief_reactions_ajout"
  on public.debrief_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "debrief_reactions_modification" on public.debrief_reactions;
create policy "debrief_reactions_modification"
  on public.debrief_reactions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "debrief_reactions_retrait" on public.debrief_reactions;
create policy "debrief_reactions_retrait"
  on public.debrief_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================
-- VERIFICATION — ce que tu dois voir
-- ============================================================
--   colonnes_debrief        3   (debrief_texte, debrief_journee, debrief_maj)
--   policies_reactions      4
--   index_reactions         3   (dont la clef primaire)
--   controles_reactions     3
--   reactions_deja_posees   0, ou plus si des joueurs ont deja reagi
--
-- Si un chiffre ne correspond pas, ne deploie pas et envoie-moi ce tableau.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'app_settings'
       and column_name in ('debrief_texte', 'debrief_journee', 'debrief_maj'))  as colonnes_debrief,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'debrief_reactions')           as policies_reactions,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'debrief_reactions'
       and indexname like 'debrief_reactions_%')                                as index_reactions,
  (select count(*) from pg_constraint
     where conrelid = 'public.debrief_reactions'::regclass
       and contype = 'c')                                                       as controles_reactions,
  (select count(*) from public.debrief_reactions)                               as reactions_deja_posees;
