-- ============================================================
-- Gazette Phase 3 — cache des actualités externes
-- ============================================================
-- Stocke les articles réels (Ligue 1) récupérés depuis des flux RSS publics
-- (voir api/gazette-news.ts) après normalisation + reformulation éditoriale
-- (Google Gemini, palier gratuit, côté serveur uniquement). Objectif du
-- cache : ne jamais renvoyer le même article à l'IA une deuxième fois
-- (latence, quota gratuit), et permettre
-- à la Gazette de rester alimentée même si une source RSS est temporairement
-- indisponible.
--
-- `id` = hash stable de l'URL source (voir hashId() côté serveur) : un même
-- article, même vu par plusieurs sources ou rechargé plusieurs fois, garde
-- toujours le même id → upsert idempotent.
create table if not exists public.gazette_news_cache (
  id text primary key,
  source text not null,
  source_url text not null,
  category text not null default 'general', -- 'mercato' | 'resultat' | 'club' | 'stat' | 'general'
  news_type text, -- 'officiel' | 'rumeur' | 'en_discussion' | null (uniquement pertinent pour category = 'mercato')
  club text, -- id de club officiel détecté (voir src/lib/team-identity.ts), ou null
  title_original text not null,
  summary_original text,
  title_ai text,
  summary_ai text,
  reformulated boolean not null default false,
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists gazette_news_cache_published_at_idx
  on public.gazette_news_cache (published_at desc);

alter table public.gazette_news_cache enable row level security;

-- Contenu éditorial public (aucune donnée utilisateur) : lecture ouverte à
-- quiconque utilise l'app, comme le reste du contenu de la Gazette.
drop policy if exists "gazette_news_cache_select" on public.gazette_news_cache;
create policy "gazette_news_cache_select"
  on public.gazette_news_cache for select
  using (true);

-- Écriture réservée aux utilisateurs connectés de l'app (même frontière de
-- confiance que le reste du projet — pas de clé service_role configurée ici,
-- voir api/gazette-news.ts qui ne fait que lire ce cache ; c'est le client
-- déjà authentifié (src/services/gazetteNewsService.ts) qui y écrit).
drop policy if exists "gazette_news_cache_upsert" on public.gazette_news_cache;
create policy "gazette_news_cache_upsert"
  on public.gazette_news_cache for insert
  to authenticated
  with check (true);

drop policy if exists "gazette_news_cache_update" on public.gazette_news_cache;
create policy "gazette_news_cache_update"
  on public.gazette_news_cache for update
  to authenticated
  using (true)
  with check (true);
