alter table public.app_settings
  add column if not exists debrief_texte text,
  add column if not exists debrief_journee integer,
  add column if not exists debrief_maj timestamptz;

create table if not exists public.debrief_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  journee integer not null,
  article text not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_emoji_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_emoji_valide check (
    char_length(emoji) between 1 and 8
    and emoji !~ '[[:alpha:]]'
    and emoji !~ '[[:digit:]]'
    and emoji !~ '[[:space:]]'
  );

alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_article_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_article_valide
  check (char_length(btrim(article)) between 1 and 40);

alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_journee_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_journee_valide
  check (journee between 1 and 60);

create unique index if not exists debrief_reactions_une_par_joueur
  on public.debrief_reactions (user_id, journee, article);

create index if not exists debrief_reactions_par_journee
  on public.debrief_reactions (journee, article);

alter table public.debrief_reactions enable row level security;

drop policy if exists "debrief_reactions_lecture" on public.debrief_reactions;
create policy "debrief_reactions_lecture"
  on public.debrief_reactions for select to authenticated using (true);

drop policy if exists "debrief_reactions_ajout" on public.debrief_reactions;
create policy "debrief_reactions_ajout"
  on public.debrief_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "debrief_reactions_modification" on public.debrief_reactions;
create policy "debrief_reactions_modification"
  on public.debrief_reactions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "debrief_reactions_retrait" on public.debrief_reactions;
create policy "debrief_reactions_retrait"
  on public.debrief_reactions for delete to authenticated
  using (auth.uid() = user_id);

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'app_settings'
       and column_name in ('debrief_texte', 'debrief_journee', 'debrief_maj')) as colonnes_debrief,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'debrief_reactions') as policies_reactions,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'debrief_reactions'
       and indexname like 'debrief_reactions_%') as index_reactions,
  (select count(*) from pg_constraint
     where conrelid = 'public.debrief_reactions'::regclass
       and contype = 'c') as controles_reactions,
  (select count(*) from public.debrief_reactions) as reactions_deja_posees;
