-- ============================================================
-- LES REACTIONS DES JOUEURS SUR LE DEBRIEF
-- ============================================================
-- Le Debrief se lit, mais ne se commente pas. Cette table permet a chaque
-- joueur de reagir d'un emoji a chacun des articles de la page — comme sous
-- un message.
--
-- CE QUI EST STOCKE, et rien de plus : qui, sur quelle journee, quel
-- article, quel emoji. Aucun texte libre : rien a moderer, et un joueur ne
-- peut pas se servir du Debrief pour ecrire ce qu'il veut.
--
-- POURQUOI UNE CLEF D'ARTICLE ET NON SON TITRE : le titre contient un pseudo
-- et change d'une journee a l'autre (« FCS, de l'ombre a la lumiere »). La
-- clef (`leader`, `chiffre`, `conclusion`...) ne bouge pas, elle.
--
-- A EXECUTER dans Supabase -> SQL Editor. Rejouable : on peut le relancer
-- sans rien casser.
-- ============================================================

-- ---------- 1. La table ----------
create table if not exists public.debrief_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- La journee racontee par le Debrief au moment de la reaction.
  journee integer not null,
  -- La clef de l'article : voir SectionRecit.cle (src/lib/recitDebrief.ts).
  article text not null,
  emoji text not null,
  created_at timestamptz not null default now(),

  -- La liste des emojis autorises vit AUSSI en base. L'interface n'en propose
  -- que six, mais rien n'empeche d'appeler l'API directement : sans cette
  -- contrainte, n'importe quel texte pourrait etre enregistre comme « emoji »
  -- et s'afficher sur la page lue par les vingt-trois joueurs.
  constraint debrief_reactions_emoji_valide check (
    emoji in ('👏', '🔥', '😮', '😂', '😢', '💪')
  ),

  constraint debrief_reactions_article_valide check (
    char_length(btrim(article)) between 1 and 40
  ),

  constraint debrief_reactions_journee_valide check (journee between 1 and 60)
);

comment on table public.debrief_reactions is
  'Reactions emoji des joueurs sur les articles du Debrief. Un joueur, un article, un emoji.';

-- ---------- 2. Un joueur ne reagit qu'une fois par article ----------
-- Changer d'avis remplace la reaction precedente au lieu d'en ajouter une :
-- sans cet index, un clic repete gonflerait les compteurs.
create unique index if not exists debrief_reactions_une_par_joueur
  on public.debrief_reactions (user_id, journee, article);

-- Lecture de la page : toutes les reactions d'une journee, d'un coup.
create index if not exists debrief_reactions_par_journee
  on public.debrief_reactions (journee, article);

-- ---------- 3. Les droits ----------
alter table public.debrief_reactions enable row level security;

-- Tout joueur connecte VOIT les reactions : c'est le principe, les
-- compteurs sont publics dans la ligue.
drop policy if exists "debrief_reactions_lecture" on public.debrief_reactions;
create policy "debrief_reactions_lecture"
  on public.debrief_reactions
  for select
  to authenticated
  using (true);

-- Mais chacun n'ecrit que POUR LUI. `auth.uid() = user_id` est verifie par la
-- base, pas par le site : meme en appelant l'API a la main, un joueur ne peut
-- pas reagir a la place d'un autre, ni supprimer la reaction de quelqu'un.
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
