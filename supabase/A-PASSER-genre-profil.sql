alter table public.profiles
  add column if not exists genre text;

alter table public.profiles
  drop constraint if exists profiles_genre_valide;

alter table public.profiles
  add constraint profiles_genre_valide
  check (genre is null or genre in ('feminin', 'masculin'));

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'genre') as colonne_genre,
  (select count(*) from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_genre_valide') as controle_genre;
