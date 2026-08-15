import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// GAZETTE — ACTUALITÉS EXTERNES (RSS multi-sources → Gemini)
// ============================================================
// Endpoint serverless (jamais appelé depuis le navigateur pour la partie
// IA : GEMINI_API_KEY ne sort jamais d'ici, même schéma que
// FOOTBALL_DATA_API_TOKEN dans api/standings.ts et api/competitions.ts).
//
// Reformulation : Google Gemini API, palier gratuit (aucune carte bancaire,
// aucune facturation — voir reformulateWithGemini plus bas). Modèle et
// limites vérifiés manuellement le 15/08/2026 sur ai.google.dev avant
// d'écrire ce code : gemini-2.5-flash est gratuit sur le palier Free (clé
// générée sur aistudio.google.com/apikey, PAS Vertex AI/Cloud Console — ce
// dernier chemin peut demander une facturation). En secours automatique,
// gemini-2.5-flash-lite (limites gratuites encore plus généreuses) si le
// modèle principal échoue.
//
// Pipeline : RSS (plusieurs sources) → parsing XML → normalisation →
// filtrage Ligue 1 → dédoublonnage → classement par pertinence → lecture du
// cache Supabase (pour ne pas repayer une reformulation déjà faite) →
// reformulation Gemini UNIQUEMENT pour les nouveaux articles → réponse.
//
// Aucune étape n'est bloquante pour les autres : une source RSS en panne,
// une erreur Gemini ou une clé absente ne doivent jamais vider la réponse
// (voir sourcesStatus / aiUsed dans la réponse — le front (gazette.tsx)
// retombe sur son moteur éditorial interne si articles.length === 0).

// ---------- Sources (multi-sources, vérifiées manuellement le 15/08/2026) ----------
// Chaque source a été testée en direct (curl) avant d'être ajoutée : flux
// RSS 2.0 valides, contenu réel et daté, éditeurs légitimes (presse
// sportive de référence / service public). Structure volontairement
// tabulaire pour pouvoir en ajouter d'autres sans toucher au reste du
// pipeline.
type NewsSource = {
  name: string;
  sourceUrl: string;
  category: "general" | "club" | "mercato";
  priority: number; // plus haut = plus fiable, gagne en cas de doublon
  enabled: boolean;
};

const SOURCES: NewsSource[] = [
  {
    name: "L'Équipe",
    sourceUrl: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/Ligue-1/",
    category: "general",
    priority: 3,
    enabled: true,
  },
  {
    name: "franceinfo",
    sourceUrl: "https://www.franceinfo.fr/sports/foot/ligue-1.rss",
    category: "general",
    priority: 2,
    enabled: true,
  },
  {
    name: "France 3 Régions",
    sourceUrl: "https://france3-regions.franceinfo.fr/sport/football/ligue-1/rss",
    category: "club",
    priority: 1,
    enabled: true,
  },
];

const MAX_CANDIDATES = 14; // taille du pool après tri/pertinence
const MAX_FOR_AI = 10; // borne dure sur ce qu'on envoie à Gemini par requête
const FETCH_TIMEOUT_MS = 10000;
const GEMINI_TIMEOUT_MS = 20000;
// Testé en conditions réelles le 15/08/2026 avec une vraie clé : les noms de
// modèles datés/pinnés (ex. "gemini-2.5-flash") renvoient HTTP 404 "no
// longer available to new users" sur un compte tout juste créé — Google a
// déjà avancé sur des versions plus récentes (confirmé via /v1beta/models :
// gemini-3.5-flash-lite / gemini-3.7-flash sont bien listés et répondent).
// On utilise donc les ALIAS "-latest" officiels, qui suivent automatiquement
// le modèle gratuit courant sans jamais se figer sur une version qui finira
// par être retirée. gemini-flash-lite-latest est pris en principal : dans le
// test réel, gemini-flash-latest ("full" Flash) consomme des tokens de
// "thinking" invisibles même pour une réponse triviale (117 tokens pour
// répondre "OK"), donc plus lent et plus vite consommateur de quota gratuit
// pour un simple travail de reformulation courte.
const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_FALLBACK_MODEL = "gemini-flash-latest";

// ---------- Clubs réels Ligue 1 (mêmes ids que src/lib/team-identity.ts) ----------
// Dupliqué volontairement ici (l'API Vercel a un contexte de build séparé de
// src/) : garder synchronisé avec src/lib/team-identity.ts si un club change.
const CLUB_KEYWORDS: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: "psg", label: "PSG", keywords: ["psg", "paris saint-germain", "paris sg"] },
  { id: "om", label: "OM", keywords: ["marseille", "om "] },
  { id: "ol", label: "OL", keywords: ["lyon", "ol "] },
  { id: "lens", label: "Lens", keywords: ["lens", "rc lens"] },
  { id: "lille", label: "Lille", keywords: ["lille", "losc"] },
  { id: "monaco", label: "Monaco", keywords: ["monaco", "asm"] },
  { id: "rennes", label: "Rennes", keywords: ["rennes", "rennais"] },
  { id: "nice", label: "Nice", keywords: ["nice", "ogc nice"] },
  { id: "brest", label: "Brest", keywords: ["brest", "sb29"] },
  { id: "tfc", label: "Toulouse", keywords: ["toulouse", "tfc"] },
  { id: "strasbourg", label: "Strasbourg", keywords: ["strasbourg", "rcsa"] },
  { id: "troyes", label: "Troyes", keywords: ["troyes", "estac"] },
  { id: "lorient", label: "Lorient", keywords: ["lorient", "fc lorient"] },
  { id: "angers", label: "Angers", keywords: ["angers", "sco"] },
  { id: "auxerre", label: "Auxerre", keywords: ["auxerre", "aja"] },
  { id: "lehavre", label: "Le Havre", keywords: ["le havre", "hac"] },
  { id: "lemans", label: "Le Mans", keywords: ["le mans"] },
  { id: "parisfc", label: "Paris FC", keywords: ["paris fc"] },
];

const LIGUE1_GENERIC_KEYWORDS = ["ligue 1", "ligue1", "championnat de france", "l1 "];

// Attention : "prêt" seul est ambigu en français ("être prêt" = ready, "un
// prêt" = un transfert en prêt) — on n'utilise que des tournures assez
// précises pour ne pas classer une citation d'avant-match en mercato (bug
// réel constaté lors des tests, voir scripts/gazette-news-test3-temp.ts).
const MERCATO_KEYWORDS = [
  "mercato",
  "transfert",
  "s'engage",
  "s'engager",
  "signe un contrat",
  "signe pour",
  "recrue",
  "recrute",
  "en prêt",
  "prêté par",
  "prêté à",
  "prêt sans option d'achat",
  "prêt avec option d'achat",
  "arrive en provenance",
  "quitte le club",
  "rejoint le",
  "rejoint l'",
  "officiel :",
];

const RUMEUR_KEYWORDS = [
  "pisté",
  "piste",
  "dans le viseur",
  "intéressé",
  "interesse",
  "souhaite recruter",
  "selon",
  "d'après",
  "envisage",
  "rumeur",
  "tente",
  "vise",
  "cible",
  "sonde",
];

const DISCUSSION_KEYWORDS = ["discussions", "négociations", "negociations", "en pourparlers", "proche d'un accord"];

// ---------- Utils ----------
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Les flux RSS placent souvent leur <title>/<description> dans du CDATA
// (ex. L'Équipe) : le contenu CDATA n'est PAS ré-interprété par un parseur
// XML (c'est le principe du CDATA), donc des entités HTML comme "&#039;"
// ou "&eacute;" restent littéralement telles quelles dans le texte reçu.
// On les décode nous-mêmes avant tout affichage.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  ouml: "ö",
  ucirc: "û",
  ugrave: "ù",
  uuml: "ü",
  icirc: "î",
  iuml: "ï",
  oelig: "œ",
  laquo: "«",
  raquo: "»",
  rsquo: "’",
  lsquo: "‘",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

function stripHtml(input: string | undefined | null): string {
  if (!input) return "";
  return decodeHtmlEntities(
    input
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function hashId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function detectClub(text: string): { id: string; label: string } | null {
  const normalized = normalizeText(text);
  for (const club of CLUB_KEYWORDS) {
    if (club.keywords.some((k) => normalized.includes(normalizeText(k)))) {
      return { id: club.id, label: club.label };
    }
  }
  return null;
}

function isLigue1Relevant(text: string, club: { id: string } | null): boolean {
  if (club) return true;
  const normalized = normalizeText(text);
  return LIGUE1_GENERIC_KEYWORDS.some((k) => normalized.includes(normalizeText(k)));
}

function classifyCategory(text: string): "mercato" | "resultat" | "club" | "general" {
  const normalized = normalizeText(text);
  if (MERCATO_KEYWORDS.some((k) => normalized.includes(normalizeText(k)))) return "mercato";
  if (/\b\d\s?-\s?\d\b/.test(normalized) || normalized.includes("victoire") || normalized.includes("défaite") || normalized.includes("nul ")) {
    return "resultat";
  }
  return "general";
}

function classifyMercatoType(text: string): "officiel" | "rumeur" | "en_discussion" | null {
  const normalized = normalizeText(text);
  if (DISCUSSION_KEYWORDS.some((k) => normalized.includes(normalizeText(k)))) return "en_discussion";
  if (RUMEUR_KEYWORDS.some((k) => normalized.includes(normalizeText(k)))) return "rumeur";
  if (MERCATO_KEYWORDS.some((k) => normalized.includes(normalizeText(k)))) return "officiel";
  return null;
}

function parsePubDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------- Normalisation d'un item RSS brut vers notre structure interne ----------
type NormalizedArticle = {
  id: string;
  title: string;
  summaryOriginal: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  imageUrl: string | null;
  category: "mercato" | "resultat" | "club" | "general";
  newsType: "officiel" | "rumeur" | "en_discussion" | null;
  club: string | null;
  clubLabel: string | null;
};

function extractImageUrl(item: any): string | null {
  const enclosure = item?.enclosure;
  if (enclosure?.["@_url"]) return String(enclosure["@_url"]);
  const media = item?.["media:content"];
  if (media?.["@_url"]) return String(media["@_url"]);
  // Certaines descriptions embarquent une balise <img src="..."> — dernier recours.
  const desc = typeof item?.description === "string" ? item.description : item?.description?.__cdata;
  if (typeof desc === "string") {
    const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }
  return null;
}

function normalizeItems(rawItems: any[], source: NewsSource): NormalizedArticle[] {
  return rawItems
    .map((item): NormalizedArticle | null => {
      const link = typeof item?.link === "string" ? item.link : item?.link?.["#text"] || item?.guid?.["#text"] || item?.guid;
      const title = stripHtml(typeof item?.title === "string" ? item.title : item?.title?.__cdata);
      const descriptionRaw =
        typeof item?.description === "string" ? item.description : item?.description?.__cdata || item?.["content:encoded"];
      const summaryOriginal = stripHtml(descriptionRaw).slice(0, 600);

      if (!link || typeof link !== "string" || !title) return null;

      const combinedText = `${title} ${summaryOriginal}`;
      const club = detectClub(combinedText);
      if (!isLigue1Relevant(combinedText, club)) return null;

      const category = classifyCategory(combinedText);
      const newsType = category === "mercato" ? classifyMercatoType(combinedText) : null;

      return {
        id: hashId(link),
        title,
        summaryOriginal,
        source: source.name,
        sourceUrl: link,
        publishedAt: parsePubDate(item?.pubDate),
        imageUrl: extractImageUrl(item),
        category,
        newsType,
        club: club?.id ?? null,
        clubLabel: club?.label ?? null,
      };
    })
    .filter((a): a is NormalizedArticle => a !== null);
}

// ---------- Récupération + parsing d'une source (jamais bloquant pour les autres) ----------
type SourceStatus = { name: string; ok: boolean; count: number; error?: string };

async function fetchSource(source: NewsSource): Promise<{ articles: NormalizedArticle[]; status: SourceStatus }> {
  if (!source.enabled) {
    return { articles: [], status: { name: source.name, ok: false, count: 0, error: "désactivée" } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(source.sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PronoLigue1Gazette/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { articles: [], status: { name: source.name, ok: false, count: 0, error: `HTTP ${res.status}` } };
    }
    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
      trimValues: true,
    });
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item;
    const items: any[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const articles = normalizeItems(items, source);
    return { articles, status: { name: source.name, ok: true, count: articles.length } };
  } catch (error) {
    return {
      articles: [],
      status: {
        name: source.name,
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- Dédoublonnage (URL identique, puis titres très similaires) ----------
function titleTokens(title: string): Set<string> {
  const stopwords = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "à", "au", "aux", "en", "pour", "avec", "sur"]);
  return new Set(
    normalizeText(title)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function dedupeArticles(articles: NormalizedArticle[], sourcePriority: Map<string, number>): NormalizedArticle[] {
  // 1) URL strictement identique.
  const byUrl = new Map<string, NormalizedArticle>();
  for (const article of articles) {
    if (!byUrl.has(article.sourceUrl)) byUrl.set(article.sourceUrl, article);
  }
  const unique = [...byUrl.values()];

  // 2) Titres très similaires (même information reprise par plusieurs sources)
  // — on garde la version de la source la plus fiable (priority la plus haute).
  const kept: NormalizedArticle[] = [];
  const keptTokens: Array<{ tokens: Set<string>; article: NormalizedArticle }> = [];

  for (const article of unique.sort((a, b) => (sourcePriority.get(b.source) ?? 0) - (sourcePriority.get(a.source) ?? 0))) {
    const tokens = titleTokens(article.title);
    const isDuplicate = keptTokens.some((k) => jaccardSimilarity(k.tokens, tokens) >= 0.55);
    if (!isDuplicate) {
      kept.push(article);
      keptTokens.push({ tokens, article });
    }
  }
  return kept;
}

// ---------- Classement par pertinence ----------
const CATEGORY_WEIGHT: Record<NormalizedArticle["category"], number> = {
  resultat: 4,
  club: 3,
  mercato: 2,
  general: 1,
};

function rankArticles(articles: NormalizedArticle[]): NormalizedArticle[] {
  return [...articles].sort((a, b) => {
    const weightDiff = CATEGORY_WEIGHT[b.category] - CATEGORY_WEIGHT[a.category];
    if (weightDiff !== 0) return weightDiff;
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });
}

// ---------- Cache Supabase (lecture seule ici — l'écriture se fait côté
// client déjà authentifié, voir src/services/gazetteNewsService.ts) ----------
function getSupabaseReadClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

type CacheRow = {
  id: string;
  title_ai: string | null;
  summary_ai: string | null;
  reformulated: boolean;
};

async function readCache(ids: string[]): Promise<Map<string, CacheRow>> {
  const map = new Map<string, CacheRow>();
  if (ids.length === 0) return map;
  const client = getSupabaseReadClient();
  if (!client) return map;
  try {
    const { data, error } = await client
      .from("gazette_news_cache")
      .select("id, title_ai, summary_ai, reformulated")
      .in("id", ids);
    if (error) return map;
    (data ?? []).forEach((row: any) => map.set(row.id, row as CacheRow));
  } catch {
    // Cache indisponible : on continue sans, jamais bloquant.
  }
  return map;
}

// ---------- Reformulation Gemini (côté serveur uniquement, palier gratuit) ----------
type AiResult = { id: string; title: string; summary: string };

const REFORMULATION_SYSTEM_PROMPT = [
  "Tu es rédacteur pour une gazette Ligue 1. Tu reformules des dépêches d'actualité",
  "footballistique en un texte COURT et original, sans jamais rien inventer.",
  "",
  "Règles strictes, non négociables :",
  "- N'ajoute AUCUNE information absente du texte source.",
  "- Ne modifie JAMAIS un chiffre, un score, une date ou un nom.",
  "- Ne transforme jamais une rumeur en information confirmée (conserve le statut tel quel).",
  "- Si le texte source est trop vague pour être reformulé sans risque, renvoie-le quasiment tel quel plutôt que d'extrapoler.",
  "- Style journalistique sportif, français naturel, ton dynamique mais factuel.",
  "- \"title\" : titre court et percutant (max ~60 caractères).",
  "- \"summary\" : 1 à 2 phrases (max ~220 caractères).",
  "",
  "Réponds STRICTEMENT en JSON avec ce format, sans texte autour :",
  '{ "articles": [ { "id": "...", "title": "...", "summary": "..." } ] }',
].join("\n");

/** Un seul appel Gemini, pour un modèle donné. Ne catch rien : l'appelant
 * (reformulateWithGemini) décide de la stratégie de secours. */
async function callGemini(
  model: string,
  apiKey: string,
  userPayload: Array<{ id: string; title: string; source: string; text: string }>
): Promise<{ results: Map<string, AiResult> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: REFORMULATION_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: JSON.stringify({ articles: userPayload }) }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini (${model}) HTTP ${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== "string") {
      throw new Error(`Gemini (${model}) : réponse sans contenu exploitable`);
    }

    let parsed: { articles?: AiResult[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Gemini (${model}) : réponse non-JSON`);
    }

    const results = new Map<string, AiResult>();
    (parsed.articles ?? []).forEach((item) => {
      if (item?.id && item?.title && item?.summary) {
        results.set(String(item.id), {
          id: String(item.id),
          title: String(item.title).slice(0, 120),
          summary: String(item.summary).slice(0, 400),
        });
      }
    });
    return { results };
  } finally {
    clearTimeout(timeout);
  }
}

async function reformulateWithGemini(
  articles: NormalizedArticle[]
): Promise<{ results: Map<string, AiResult>; used: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { results: new Map(), used: false, error: "GEMINI_API_KEY absente" };
  if (articles.length === 0) return { results: new Map(), used: false };

  const userPayload = articles.map((a) => ({
    id: a.id,
    title: a.title,
    source: a.source,
    text: a.summaryOriginal || a.title,
  }));

  // Modèle principal, puis secours automatique (toujours gratuit) si le
  // premier échoue — quota, modèle temporairement indisponible, etc.
  // Jamais d'exception qui viderait la réponse : voir le catch final.
  try {
    const { results } = await callGemini(GEMINI_PRIMARY_MODEL, apiKey, userPayload);
    return { results, used: true };
  } catch (primaryError) {
    try {
      const { results } = await callGemini(GEMINI_FALLBACK_MODEL, apiKey, userPayload);
      return { results, used: true };
    } catch (fallbackError) {
      const primaryMsg = primaryError instanceof Error ? primaryError.message : "erreur inconnue";
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : "erreur inconnue";
      return {
        results: new Map(),
        used: false,
        error: `${primaryMsg} | secours (${GEMINI_FALLBACK_MODEL}) : ${fallbackMsg}`,
      };
    }
  }
}

// ---------- Handler ----------
function send(res: VercelResponse, status: number, body: unknown) {
  return res
    .status(status)
    .setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=1800")
    .json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, message: "Méthode non autorisée. Utilise GET." });
  }

  const sourcePriority = new Map(SOURCES.map((s) => [s.name, s.priority]));

  // 1) Récupération multi-sources en parallèle — une source en panne ne
  // doit jamais empêcher les autres de répondre (voir status par source).
  const fetched = await Promise.all(SOURCES.map((s) => fetchSource(s)));
  const sourcesStatus = fetched.map((f) => f.status);
  const allArticles = fetched.flatMap((f) => f.articles);

  // 2) Dédoublonnage puis classement par pertinence, borné.
  const deduped = dedupeArticles(allArticles, sourcePriority);
  const ranked = rankArticles(deduped).slice(0, MAX_CANDIDATES);

  if (ranked.length === 0) {
    return send(res, 200, {
      ok: true,
      articles: [],
      sourcesStatus,
      aiUsed: false,
      generatedAt: new Date().toISOString(),
    });
  }

  // 3) Cache : on ne reformule jamais un article déjà traité.
  const cache = await readCache(ranked.map((a) => a.id));
  const alreadyCached = ranked.filter((a) => cache.get(a.id)?.reformulated);
  const needsReformulation = ranked.filter((a) => !cache.get(a.id)?.reformulated).slice(0, MAX_FOR_AI);

  // 4) Reformulation Gemini (uniquement les nouveaux articles). En cas
  // d'échec (clé absente, réseau, quota...) : fallback texte original,
  // jamais d'exception qui viderait la réponse (voir req. tests §17).
  const ai = await reformulateWithGemini(needsReformulation);

  const articles = ranked.map((a) => {
    const cached = cache.get(a.id);
    const aiResult = ai.results.get(a.id);

    const reformulated = Boolean(cached?.reformulated) || Boolean(aiResult);
    const title = aiResult?.title ?? (cached?.reformulated ? cached?.title_ai : null) ?? a.title;
    const summary =
      aiResult?.summary ?? (cached?.reformulated ? cached?.summary_ai : null) ?? a.summaryOriginal ?? a.title;

    return {
      id: a.id,
      title,
      summary,
      titleOriginal: a.title,
      summaryOriginal: a.summaryOriginal,
      source: a.source,
      sourceUrl: a.sourceUrl,
      publishedAt: a.publishedAt,
      imageUrl: a.imageUrl,
      category: a.category,
      newsType: a.newsType,
      club: a.club,
      clubLabel: a.clubLabel,
      reformulated,
    };
  });

  return send(res, 200, {
    ok: true,
    articles,
    sourcesStatus,
    aiUsed: ai.used,
    aiError: ai.error,
    cachedCount: alreadyCached.length,
    reformulatedCount: needsReformulation.length,
    generatedAt: new Date().toISOString(),
  });
}
