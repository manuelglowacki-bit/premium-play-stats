import { supabase } from "@/lib/supabase";

// ============================================================
// GAZETTE — client des actualités externes
// ============================================================
// Appelle l'endpoint serverless api/gazette-news.ts (qui fait tout le
// travail : RSS multi-sources, normalisation, dédoublonnage, reformulation
// Gemini côté serveur — jamais de clé API ici). Ce service, lui, tourne
// dans le navigateur : il ne voit jamais OPENAI_API_KEY, seulement le
// résultat éditorial déjà propre.
//
// Il se charge ensuite d'écrire le résultat dans le cache Supabase
// (gazette_news_cache) via le client déjà authentifié de l'app — c'est la
// seule façon d'écrire dans cette table (RLS : insert/update réservés à
// `authenticated`, voir la migration). Ça permet au serveur de relire ce
// cache la prochaine fois et de ne pas repayer une reformulation déjà faite.

export type GazetteArticleCategory = "mercato" | "resultat" | "club" | "general";
export type GazetteNewsType = "officiel" | "rumeur" | "en_discussion" | null;

export type GazetteArticle = {
  id: string;
  title: string;
  summary: string;
  titleOriginal: string;
  summaryOriginal: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  imageUrl: string | null;
  category: GazetteArticleCategory;
  newsType: GazetteNewsType;
  club: string | null;
  clubLabel: string | null;
  reformulated: boolean;
};

type GazetteNewsResponse = {
  ok: boolean;
  articles?: GazetteArticle[];
  message?: string;
};

/**
 * Récupère les actualités Ligue 1 externes déjà normalisées/reformulées.
 * Ne lève jamais d'exception : en cas d'échec (réseau, endpoint absent en
 * local sans `vercel dev`, etc.), retourne un tableau vide — c'est à
 * l'appelant (gazette.tsx) de retomber sur son moteur éditorial interne.
 */
export async function fetchExternalGazetteNews(): Promise<{
  ok: boolean;
  articles: GazetteArticle[];
}> {
  try {
    const res = await fetch("/api/gazette-news", { method: "GET" });
    if (!res.ok) return { ok: false, articles: [] };

    const data = (await res.json()) as GazetteNewsResponse;
    const articles = Array.isArray(data.articles) ? data.articles : [];

    if (articles.length > 0) {
      // Écriture best-effort dans le cache : on n'attend pas le résultat et
      // on ignore les erreurs (RLS, hors-ligne...) — jamais bloquant pour
      // l'affichage, qui a déjà tout ce qu'il lui faut dans `articles`.
      void upsertCache(articles);
    }

    return { ok: Boolean(data.ok), articles };
  } catch {
    return { ok: false, articles: [] };
  }
}

async function upsertCache(articles: GazetteArticle[]): Promise<void> {
  try {
    const rows = articles.map((a) => ({
      id: a.id,
      source: a.source,
      source_url: a.sourceUrl,
      category: a.category,
      news_type: a.newsType,
      club: a.club,
      title_original: a.titleOriginal,
      summary_original: a.summaryOriginal,
      title_ai: a.reformulated ? a.title : null,
      summary_ai: a.reformulated ? a.summary : null,
      reformulated: a.reformulated,
      image_url: a.imageUrl,
      published_at: a.publishedAt,
      fetched_at: new Date().toISOString(),
    }));
    await supabase.from("gazette_news_cache").upsert(rows, { onConflict: "id" });
  } catch {
    // Best-effort — une écriture de cache ratée ne doit jamais impacter l'UI.
  }
}
