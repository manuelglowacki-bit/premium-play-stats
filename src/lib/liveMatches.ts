/**
 * Source de vérité UNIQUE pour la fusion Supabase + score/statut live.
 *
 * Avant cette extraction, chaque page (Classement, Accueil, Profil, Stats,
 * Pronostics) réimplémentait sa propre version de cette fusion — quasi
 * identique sur 3 pages, mais AVEC DES DIVERGENCES RÉELLES :
 *   - classement.tsx n'avait AUCUNE garde anti-régression (une réponse API
 *     temporairement incomplète pouvait faire revenir un score en arrière,
 *     ex. 1-1 -> 0-0) ;
 *   - classement.tsx ne marquait jamais un match EN COURS (LIVE/IN_PLAY/HT…)
 *     comme "scorable" : computeLeagueStats() exige `finished === true`,
 *     donc le Classement ignorait purement et simplement les points d'un
 *     match non encore officiellement FINISHED/FT/AET/PEN — contrairement à
 *     l'Accueil, au Profil et à Stats, qui avaient déjà ce comportement.
 * Résultat : le Classement (censé être la référence) était en réalité EN
 * RETARD sur les 3 autres pages pendant un match en direct. Ce module
 * élimine cette divergence : toutes les pages appellent désormais EXACTEMENT
 * le même code.
 *
 * Deux vues distinctes sont exposées, à ne jamais confondre :
 *   - reconcileMatchesWithLive()  -> vue "réelle" : `finished` reflète l'état
 *     RÉEL du match (utile pour "dernière journée terminée", l'évolution du
 *     classement, l'affichage d'un badge EN DIRECT, etc.) ;
 *   - markLiveMatchesScorable()   -> vue "calcul" dérivée de la précédente :
 *     un match en cours avec un score connu devient `finished: true` UNIQUEMENT
 *     pour servir d'entrée à computeLeagueStats() (src/lib/leaderboardStats.ts).
 *     Rien n'est jamais écrit dans Supabase.
 */

export const LIVE_SCORE_CACHE_PREFIX = "prono-ligue1-live-score:";

/** Statuts football-data.org considérés comme match définitivement terminé. */
export const FINISHED_STATUSES = new Set(["FINISHED", "FT", "AET", "PEN"]);

/** Statuts football-data.org considérés comme match en cours (pas encore terminé). */
export const IN_PROGRESS_STATUSES = new Set([
  "LIVE",
  "IN_PLAY",
  "INPLAY",
  "1H",
  "2H",
  "HT",
  "ET",
  "P",
  "PAUSED",
  "HALFTIME",
]);

export type LiveApiMatch = {
  apiFixtureId?: number | string | null;
  api_fixture_id?: number | string | null;
  fixture_id?: number | string | null;
  fixtureId?: number | string | null;
  statut?: string | null;
  status?: string | null;
  scoreDomicile?: number | string | null;
  scoreHome?: number | string | null;
  homeScore?: number | string | null;
  home_score?: number | string | null;
  scoreExterieur?: number | string | null;
  scoreAway?: number | string | null;
  awayScore?: number | string | null;
  away_score?: number | string | null;
  [key: string]: unknown;
};

/** Sous-ensemble commun aux tables/objets `matches` de chaque page. */
export type ReconcilableMatch = {
  id: string;
  api_fixture_id?: number | string | null;
  status?: string | null;
  finished?: boolean | null;
  home_score: number | null;
  away_score: number | null;
  kickoff?: string | null;
  kickoff_time?: string | null;
  [key: string]: unknown;
};

type CachedLiveScore = {
  home_score: number | null;
  away_score: number | null;
  status: string;
  finished: boolean;
  updatedAt: number;
};

/**
 * Interroge `/api/ligue1/matchs` (Ligue 1 + les 4 championnats bonus).
 * Ne lève jamais : en cas d'échec réseau/HTTP, retourne un tableau vide —
 * les pages continuent alors avec Supabase (+ le cache sessionStorage déjà
 * connu, voir reconcileMatchWithLive), exactement comme l'exige la section
 * "fonctionner même si l'API live est temporairement indisponible".
 */
export async function fetchLiveApiMatches(options?: { signal?: AbortSignal }): Promise<LiveApiMatch[]> {
  try {
    const response = await fetch(
      `/api/ligue1/matchs?season=2026&competition=ALL&_live=${Date.now()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: options?.signal,
      },
    );

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.allMatches) ? payload.allMatches : [];
  } catch {
    return [];
  }
}

/** Indexe les matchs live reçus par `api_fixture_id` (formats de champ tolérés). */
export function buildLiveFixtureMap(liveApiMatches: LiveApiMatch[]): Map<number, LiveApiMatch> {
  const map = new Map<number, LiveApiMatch>();
  liveApiMatches.forEach((m) => {
    const fixtureId = m?.apiFixtureId ?? m?.api_fixture_id ?? m?.fixture_id ?? m?.fixtureId ?? null;
    if (fixtureId != null && Number.isFinite(Number(fixtureId))) {
      map.set(Number(fixtureId), m);
    }
  });
  return map;
}

function readLiveCache(fixtureId: number): CachedLiveScore | null {
  try {
    const raw = sessionStorage.getItem(`${LIVE_SCORE_CACHE_PREFIX}${fixtureId}`);
    return raw ? (JSON.parse(raw) as CachedLiveScore) : null;
  } catch {
    // sessionStorage indisponible (navigation privée, quota, etc.) : on
    // continue sans cache, jamais d'erreur bloquante pour l'affichage.
    return null;
  }
}

function writeLiveCache(
  fixtureId: number,
  value: { home_score: number | null; away_score: number | null; status: string; finished: boolean },
): void {
  try {
    sessionStorage.setItem(
      `${LIVE_SCORE_CACHE_PREFIX}${fixtureId}`,
      JSON.stringify({ ...value, updatedAt: Date.now() }),
    );
  } catch {
    // Écriture impossible : le calcul continue avec les données reçues.
  }
}

/**
 * Fusionne UN match Supabase avec son état live éventuel.
 *
 * Règles (voir l'objectif du chantier, sections 2 et 3) :
 * - Pas d'`api_fixture_id` -> le match n'est jamais concerné par le live,
 *   renvoyé tel quel (matchs sans suivi live, ex. anciennes données).
 * - Live disponible -> le score/statut de l'API est prioritaire, SAUF s'il
 *   régresse par rapport au dernier score live connu (cache sessionStorage) :
 *   dans ce cas précis, on conserve le dernier score connu au lieu d'écraser
 *   avec une réponse API incomplète/temporairement fausse.
 * - Live indisponible mais un score a déjà été vu cette session -> on garde
 *   ce dernier score connu plutôt que de revenir à l'état Supabase (souvent
 *   en retard tant que la synchro admin n'a pas tourné).
 * - Un match réellement FINISHED en base (`match.finished === true`) reste
 *   toujours considéré terminé, même si l'API ne le confirme pas encore.
 */
export function reconcileMatchWithLive<T extends ReconcilableMatch>(
  match: T,
  liveByFixture: Map<number, LiveApiMatch>,
): T {
  if (match.api_fixture_id == null) return match;

  const fixtureId = Number(match.api_fixture_id);
  const live = liveByFixture.get(fixtureId);
  const cached = readLiveCache(fixtureId);

  if (!live) {
    if (cached && !match.finished) {
      return {
        ...match,
        status: cached.status ?? match.status,
        // On est dans la branche `!match.finished` : le match n'est déjà
        // pas terminé côté Supabase, seul le cache peut le faire passer à true.
        finished: Boolean(cached.finished),
        home_score: cached.home_score != null ? Number(cached.home_score) : match.home_score,
        away_score: cached.away_score != null ? Number(cached.away_score) : match.away_score,
      };
    }
    return match;
  }

  const status = String(live.statut ?? live.status ?? match.status ?? "SCHEDULED");
  const upperStatus = status.toUpperCase();
  const apiFinished = FINISHED_STATUSES.has(upperStatus);

  const apiHome = live.scoreDomicile ?? live.scoreHome ?? live.homeScore ?? live.home_score ?? null;
  const apiAway = live.scoreExterieur ?? live.scoreAway ?? live.awayScore ?? live.away_score ?? null;

  let homeScore = apiHome != null && Number.isFinite(Number(apiHome)) ? Number(apiHome) : match.home_score;
  let awayScore = apiAway != null && Number.isFinite(Number(apiAway)) ? Number(apiAway) : match.away_score;

  // GARDE ANTI-RÉGRESSION : un score de football ne peut jamais diminuer.
  // Si la réponse API (non finale) est invalide ou inférieure au dernier
  // score connu, on conserve ce dernier score connu.
  if (!apiFinished && cached?.home_score != null && cached?.away_score != null) {
    const cachedHome = Number(cached.home_score);
    const cachedAway = Number(cached.away_score);
    const incomingInvalid = !Number.isFinite(homeScore) || !Number.isFinite(awayScore);
    const incomingRegresses =
      Number.isFinite(homeScore) &&
      Number.isFinite(awayScore) &&
      ((homeScore as number) < cachedHome || (awayScore as number) < cachedAway);

    if (incomingInvalid || incomingRegresses) {
      homeScore = cachedHome;
      awayScore = cachedAway;
    }
  }

  writeLiveCache(fixtureId, { home_score: homeScore, away_score: awayScore, status, finished: apiFinished });

  return {
    ...match,
    status,
    finished: apiFinished || match.finished === true,
    home_score: homeScore,
    away_score: awayScore,
  };
}

/** Applique reconcileMatchWithLive() à une liste complète de matchs Supabase. */
export function reconcileMatchesWithLive<T extends ReconcilableMatch>(
  matches: T[],
  liveApiMatches: LiveApiMatch[],
): T[] {
  const liveByFixture = buildLiveFixtureMap(liveApiMatches);
  return matches.map((match) => reconcileMatchWithLive(match, liveByFixture));
}

/**
 * Un match est considéré "commencé" (donc son score, s'il est connu, peut
 * déjà être utilisé pour calculer des points) dès que :
 * - il est réellement `finished`, OU
 * - son statut API est un statut "en cours" (LIVE/IN_PLAY/HT/…), OU
 * - son coup d'envoi est déjà passé (repli si le statut API n'a pas encore
 *   été rafraîchi juste après l'heure de coup d'envoi).
 */
export function isMatchStarted(match: ReconcilableMatch, nowMs: number = Date.now()): boolean {
  if (match.finished === true) return true;

  const status = String(match.status ?? "").toUpperCase();
  if (IN_PROGRESS_STATUSES.has(status)) return true;

  const kickoff = match.kickoff ?? match.kickoff_time ?? null;
  if (!kickoff) return false;

  const kickoffMs = new Date(kickoff).getTime();
  return Number.isFinite(kickoffMs) && kickoffMs <= nowMs;
}

/**
 * Vue DÉRIVÉE réservée au calcul des points (computeLeagueStats) : un match
 * commencé (voir isMatchStarted) dont le score est déjà connu devient
 * `finished: true` / `status: "FINISHED"` — un résultat PROVISOIRE, jamais
 * écrit dans Supabase, qui permet au moteur de points de scorer les
 * pronostics dès le début du match au lieu d'attendre le coup de sifflet
 * final. Ne JAMAIS utiliser cette vue pour autre chose que le calcul des
 * points (ex. la détection de "dernière journée terminée" doit utiliser la
 * vue réelle issue de reconcileMatchesWithLive()).
 */
export function markLiveMatchesScorable<T extends ReconcilableMatch>(
  matches: T[],
  nowMs: number = Date.now(),
): T[] {
  return matches.map((match) => {
    const hasScore = match.home_score != null && match.away_score != null;
    if (!hasScore || !isMatchStarted(match, nowMs)) return match;
    if (match.finished === true && String(match.status ?? "").toUpperCase() === "FINISHED") return match;
    return { ...match, finished: true, status: "FINISHED" };
  });
}
