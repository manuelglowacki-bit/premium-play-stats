import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Calendar,
  ChevronRight,
  Clock3,
  Flame,
  Hash,
  Lightbulb,
  Menu,
  Newspaper,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMatches, getMatchdays } from "@/services/adminService";
import { getOfficialClubId } from "@/lib/team-identity";
import { getTeamTheme } from "@/lib/team-theme";
import { rankPlayers } from "@/lib/leaderboardRanking";
import { fetchExternalGazetteNews, type GazetteArticle } from "@/services/gazetteNewsService";

export const Route = createFileRoute("/gazette")({
  head: () => ({
    meta: [
      { title: "La Gazette — Prono Ligue 1" },
      {
        name: "description",
        content:
          "La Gazette : toute l'actualité, les analyses et les tendances de la Ligue 1.",
      },
    ],
  }),
  component: GazettePage,
});

type Profile = {
  id: string;
  email?: string | null;
  pseudo?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
};

type Journee = {
  id: string;
  number: number | string;
  title: string;
  matches: any[];
  bonus: any[];
};

type PlayerPronos = {
  favoriteTeam: string;
  byMatch: Map<string, any>;
};


type DayMatch = {
  match: any;
  journee: Journee;
  isBonus: boolean;
};

// ============================================================
// HELPERS DE DONNÉES (réutilisés depuis l'ancienne Gazette)
// ============================================================

function clean(value: any) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sameClub(a: any, b: any) {
  const ca = clean(a);
  const cb = clean(b);
  return Boolean(ca && cb && (ca === cb || ca.includes(cb) || cb.includes(ca)));
}

function getTeamHome(match: any) {
  return (
    match?.home_team ??
    match?.home ??
    match?.domicile ??
    match?.equipeDomicile ??
    match?.homeTeam ??
    match?.club1 ??
    match?.equipe1 ??
    ""
  );
}

function getTeamAway(match: any) {
  return (
    match?.away_team ??
    match?.away ??
    match?.exterieur ??
    match?.equipeExterieur ??
    match?.awayTeam ??
    match?.club2 ??
    match?.equipe2 ??
    ""
  );
}

function getScoreHome(match: any) {
  return (
    match?.homeScore ??
    match?.scoreHome ??
    match?.score_domicile ??
    match?.domicileScore ??
    match?.result?.home ??
    match?.home_score ??
    null
  );
}

function getScoreAway(match: any) {
  return (
    match?.awayScore ??
    match?.scoreAway ??
    match?.score_exterieur ??
    match?.exterieurScore ??
    match?.result?.away ??
    match?.away_score ??
    null
  );
}

function hasScore(match: any) {
  const home = getScoreHome(match);
  const away = getScoreAway(match);
  if (home == null || away == null) return false;
  const h = Number(home);
  const a = Number(away);
  return Number.isFinite(h) && Number.isFinite(a);
}

function getResult1N2(home: any, away: any): "1" | "N" | "2" | null {
  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return "1";
  if (h < a) return "2";
  return "N";
}

function pickResult(prono: any): "1" | "N" | "2" | "" {
  if (!prono) return "";
  return getResult1N2(prono.home_prediction, prono.away_prediction) || "";
}

function isExactPrediction(match: any, prono: any): boolean {
  if (!prono || prono.home_prediction == null || prono.away_prediction == null) return false;
  if (!hasScore(match)) return false;
  return (
    Number(prono.home_prediction) === Number(getScoreHome(match)) &&
    Number(prono.away_prediction) === Number(getScoreAway(match))
  );
}

function getFavoriteTeamValue(value: any) {
  if (!value) return "Non choisi";

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return (
        parsed.favoriteTeam ??
        parsed.club ??
        parsed.team ??
        parsed.equipe ??
        Object.values(parsed).find(Boolean) ??
        "Non choisi"
      );
    }
  } catch {
    return String(value);
  }

  return String(value);
}

function isFavoriteMatch(match: any, favoriteTeam: string) {
  if (!favoriteTeam || favoriteTeam === "Non choisi") return false;
  return (
    sameClub(getTeamHome(match), favoriteTeam) ||
    sameClub(getTeamAway(match), favoriteTeam)
  );
}

// Le classement réel (points/rang) est calculé plus bas, dans le composant
// GazettePage, via rankPlayers (src/lib/leaderboardRanking.ts) — MÊME
// source de vérité que Classement/Accueil/Profil, à partir des points déjà
// enregistrés (predictions.points), jamais un recalcul 1N2 simplifié
// parallèle (l'ancienne version de ce fichier en avait un ici — supprimé).

function pluralWord(count: number, singular: string, plural: string) {
  return count > 1 ? plural : singular;
}

// Résolution du thème (fond + logo) d'un club pour les cartes éditoriales.
function clubAsset(name: string | undefined | null) {
  const id = getOfficialClubId(name);
  const theme = getTeamTheme(id);
  return {
    id,
    background: theme.background,
    logo: id ? `/logos/ligue1/${id}.png` : null,
  };
}

function formatKickoff(kickoff: string | null | undefined) {
  if (!kickoff) return "";
  try {
    const d = new Date(kickoff);
    if (Number.isNaN(d.getTime())) return "";
    return d
      .toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
      .replace(".", "");
  } catch {
    return "";
  }
}

function shortTeam(name: string) {
  const id = getOfficialClubId(name);
  if (!id) return name || "—";
  const map: Record<string, string> = {
    psg: "PSG",
    om: "OM",
    ol: "OL",
    lens: "RCL",
    lille: "LOSC",
    monaco: "ASM",
    rennes: "SRFC",
    nice: "OGCN",
    brest: "SB29",
    tfc: "TFC",
    strasbourg: "RCSA",
    lorient: "FCL",
    angers: "SCO",
    auxerre: "AJA",
    lehavre: "HAC",
    lemans: "LMFC",
    parisfc: "PFC",
    troyes: "ESTAC",
  };
  return map[id] || name || "—";
}

// ============================================================
// COMPOSANTS SQUELETTES (loading premium)
// ============================================================

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />
  );
}

function HeroSkeleton() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75"
      style={{ minHeight: 260 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1322]/60 via-[#0d1322]/40 to-[#0d1322]/80" />
      <div className="relative z-10 flex h-full min-h-[260px] flex-col justify-end p-6 md:p-8">
        <SkeletonBlock className="mb-4 h-5 w-24" />
        <SkeletonBlock className="mb-3 h-9 w-3/4 md:w-1/2" />
        <SkeletonBlock className="mb-5 h-4 w-full max-w-md" />
        <div className="flex gap-3">
          <SkeletonBlock className="h-11 w-36 rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

function ActuSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-[#0d1322]/75 p-4">
      <SkeletonBlock className="size-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="mb-2 h-3 w-16" />
        <SkeletonBlock className="mb-2 h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function FocusSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-6 md:p-8">
      <SkeletonBlock className="mb-6 h-5 w-40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <SkeletonBlock className="mx-auto mb-3 h-12 w-16" />
            <SkeletonBlock className="mx-auto h-3 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// SOUS-COMPOSANTS DE LA GAZETTE
// ============================================================

function SectionTitle({
  children,
  accentClass = "bg-emerald-400",
  hint,
}: {
  children: React.ReactNode;
  accentClass?: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2
        className="flex items-center gap-2.5 font-display text-lg font-black uppercase tracking-[.08em] text-white md:text-xl"
        style={{ textShadow: "0 1px 0 rgba(0,0,0,.4)" }}
      >
        <span
          className={`inline-block h-5 w-1 rounded-full ${accentClass} shadow-[0_0_12px_rgba(16,185,129,.45)]`}
        />
        {children}
      </h2>
      {hint && (
        <span className="hidden font-mono text-[10px] font-bold tracking-[.18em] text-slate-500 sm:block">
          {hint}
        </span>
      )}
    </div>
  );
}

// Carte d'actualité (Dernières actus) — tirée d'un match réel ou d'une info.
function ActuCard({
  title,
  subtitle,
  badge,
  kickoff,
  imageUrl,
  teamName,
  onClick,
}: {
  title: string;
  subtitle?: string;
  badge: string;
  kickoff?: string;
  imageUrl?: string | null;
  teamName?: string;
  onClick?: () => void;
}) {
  const asset = clubAsset(teamName || null);
  const bg = imageUrl || asset.background || null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap group flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-[#0d1322]/80 p-3 text-left shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur-md hover:border-emerald-500/30"
    >
      <div
        className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-cover bg-center"
        style={{ backgroundImage: bg ? `url('${bg}')` : undefined }}
      >
        <div className="absolute inset-0 bg-black/35" />
        {asset.logo && (
          <img
            src={asset.logo}
            alt=""
            className="absolute inset-0 m-auto size-7 object-contain opacity-80"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[.14em] text-emerald-400">
            {badge}
          </span>
          {kickoff && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
              <Clock3 className="size-3" />
              {kickoff}
            </span>
          )}
        </div>
        <h3 className="mt-1.5 line-clamp-1 font-display text-base font-bold leading-tight text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="line-clamp-1 mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
    </button>
  );
}

// État vide premium, réutilisé partout où une source de contenu (actus,
// mercato, temps forts vidéo) n'est pas encore branchée — jamais de fausse
// donnée statique à la place, mais jamais un grand vide silencieux non plus.
function EditorialEmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: typeof Newspaper;
  title: string;
  description: string;
  /** Version encore plus resserrée — pour les blocs secondaires (Le chiffre,
   * Les temps forts, Mercato) où même la version "compacte" par défaut
   * resterait trop haute une fois plusieurs de ces cartes empilées. */
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-dashed border-slate-800 bg-[#0d1322]/60 text-left ${
        compact ? "px-3.5 py-3" : "px-4 py-3.5"
      }`}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-500">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-xs font-bold text-white">{title}</p>
        <p className="mt-0.5 line-clamp-1 text-[10px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// PAGE PRINCIPALE
// ============================================================

function GazettePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [journees, setJournees] = useState<Journee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predictionsByUser, setPredictionsByUser] = useState<
    Map<string, PlayerPronos>
  >(new Map());
  // Horodatage réel du dernier chargement réussi — jamais une heure fixée
  // en dur : reflète le vrai moment où les données Supabase ont été
  // relues (voir loadData, rappelé automatiquement toutes les 5 min).
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Bascule Mercato / Rubrique du moment — réglage admin (voir Admin →
  // Réglages), jamais une date de fenêtre de mercato devinée ici.
  const [mercatoActive, setMercatoActive] = useState(false);
  // Actualités externes réelles (RSS multi-sources + reformulation OpenAI,
  // voir api/gazette-news.ts). Totalement découplé de loadData() : un échec
  // ici (endpoint absent en local sans `vercel dev`, réseau coupé...) ne
  // doit jamais bloquer ni vider le reste de la page — voir externalArticles
  // par défaut à [] et son usage systématiquement en fallback ci-dessous.
  const [externalArticles, setExternalArticles] = useState<GazetteArticle[]>([]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [
        { data: competitionsData, error: competitionsError },
        matchdaysData,
        matchesData,
        { data: bonusOptionsData, error: bonusOptionsError },
        { data: profileData, error: profileError },
        { data: predictionData, error: predictionError },
        { data: settingsData, error: settingsError },
      ] = await Promise.all([
        supabase.from("competitions").select("id, external_code, code"),
        getMatchdays(),
        getMatches(),
        supabase
          .from("bonus_options")
          .select("matchday_id, match_id")
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("*")
          .order("pseudo", { ascending: true, nullsFirst: false }),
        supabase.from("predictions").select("*"),
        // Bascule Mercato / Rubrique du moment (Admin → Réglages) — voir
        // migration 20260817090000. Non bloquant : si absente/en erreur, on
        // retombe sur la Rubrique du moment (jamais un faux Mercato).
        supabase.from("app_settings").select("mercato_active").eq("id", 1).maybeSingle(),
      ]);

      if (competitionsError) throw competitionsError;
      if (bonusOptionsError) throw bonusOptionsError;
      if (profileError) throw profileError;
      if (predictionError) throw predictionError;
      if (settingsError) console.warn("Erreur chargement réglages (mercato) :", settingsError);

      const ligue1CompetitionId = (competitionsData ?? []).find(
        (c: any) => c.external_code === "FL1" || c.code === "FL1"
      )?.id;

      const ligue1Matchdays = (matchdaysData ?? []).filter(
        (md: any) => md.competition_id === ligue1CompetitionId
      );

      const matchesById = new Map<string, any>();
      const matchesByMatchday = new Map<string, any[]>();

      (matchesData ?? []).forEach((match: any) => {
        matchesById.set(String(match.id), match);
        if ((match.match_type ?? "LIGUE1") !== "LIGUE1") return;
        if (!match.matchday_id) return;
        const list = matchesByMatchday.get(match.matchday_id) ?? [];
        list.push(match);
        matchesByMatchday.set(match.matchday_id, list);
      });

      const bonusMatchesByMatchday = new Map<string, any[]>();
      (bonusOptionsData ?? []).forEach((option: any) => {
        const match = matchesById.get(String(option.match_id));
        if (!match) return;
        const list = bonusMatchesByMatchday.get(option.matchday_id) ?? [];
        list.push(match);
        bonusMatchesByMatchday.set(option.matchday_id, list);
      });

      const normalized: Journee[] = ligue1Matchdays
        .map((matchday: any) => ({
          id: matchday.id,
          number: matchday.number,
          title: `J${matchday.number}`,
          matches: matchesByMatchday.get(matchday.id) ?? [],
          bonus: bonusMatchesByMatchday.get(matchday.id) ?? [],
        }))
        .sort((a, b) => Number(a.number) - Number(b.number));

      const profilesLoaded = (profileData || []) as Profile[];
      const predictions = predictionData || [];

      const predictionsMap = new Map<string, PlayerPronos>();
      profilesLoaded.forEach((profile: any) => {
        predictionsMap.set(profile.id, {
          favoriteTeam: getFavoriteTeamValue(
            profile.favorite_team ?? profile.favorite_team_id ?? null
          ),
          byMatch: new Map(),
        });
      });

      predictions.forEach((prediction: any) => {
        const entry = predictionsMap.get(prediction?.user_id);
        if (!entry || !prediction?.match_id) return;
        entry.byMatch.set(String(prediction.match_id), prediction);
      });

      setJournees(normalized);
      setProfiles(profilesLoaded);
      setPredictionsByUser(predictionsMap);
      setMercatoActive(Boolean((settingsData as any)?.mercato_active));
      setLastUpdated(new Date());
    } catch (err: any) {
      setError("Données momentanément indisponibles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = window.setInterval(() => loadData(true), 300000);
    return () => window.clearInterval(interval);
  }, []);

  // Actualités externes : chargement volontairement séparé du moteur
  // interne ci-dessus. Ainsi la Gazette s'affiche instantanément avec ses
  // données internes réelles, puis s'enrichit avec de vraies actus dès
  // qu'elles arrivent — jamais l'inverse (jamais d'attente, jamais d'écran
  // vide si les actus externes échouent).
  useEffect(() => {
    let cancelled = false;
    async function loadExternalNews() {
      const { articles } = await fetchExternalGazetteNews();
      if (!cancelled) setExternalArticles(articles);
    }
    loadExternalNews();
    const interval = window.setInterval(loadExternalNews, 300000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Journées jouées, pour dériver les temps forts et la une.
  const scoredJournees = useMemo(
    () =>
      [...new Set(
        journees
          .filter((j) => [...j.matches, ...j.bonus].some(hasScore))
          .map((j) => Number(j.number))
          .filter(Boolean)
      )].sort((a, b) => a - b),
    [journees]
  );

  const lastJournee = scoredJournees[scoredJournees.length - 1] || 1;
  const currentJournee =
    journees.find((j) => Number(j.number) === Number(lastJournee)) ||
    journees[journees.length - 1];

  const selectedJournee = currentJournee;

  // Table de recherche des matchs (Ligue 1 + bonus) par id — pour déduire les
  // scores exacts à partir des pronostics déjà enregistrés.
  const matchesByIdMap = useMemo(() => {
    const map = new Map<string, any>();
    journees.forEach((j) => {
      [...j.matches, ...j.bonus].forEach((m) => map.set(String(m.id), m));
    });
    return map;
  }, [journees]);

  // Classement "Dans notre compétition" — MÊME source de vérité que
  // Classement/Accueil/Profil : points RÉELLEMENT enregistrés
  // (predictions.points, jamais un recalcul 1N2 simplifié parallèle) +
  // rankPlayers (src/lib/leaderboardRanking.ts) pour le tri/départage.
  // `excludeMatchdayId` permet de recalculer un classement "avant la
  // dernière journée" (pour La tendance / À surveiller) sans dupliquer la
  // logique de tri : seul l'ensemble de pronostics pris en compte change.
  function buildRankedPlayers(excludeMatchdayId?: string) {
    const rows = profiles.map((profile) => {
      const byMatch = predictionsByUser.get(profile.id)?.byMatch;
      let points = 0;
      let exactScores = 0;
      let predictionsCount = 0;
      let regularitySuccess = 0;

      byMatch?.forEach((prono, matchId) => {
        const match = matchesByIdMap.get(matchId);
        if (excludeMatchdayId && match?.matchday_id === excludeMatchdayId) return;
        const pts = Number(prono.points || 0);
        points += pts;
        predictionsCount += 1;
        if (pts > 0) regularitySuccess += 1;
        if (match && isExactPrediction(match, prono)) exactScores += 1;
      });

      const pseudo = profile.pseudo || "Joueur";
      return {
        id: profile.id,
        name: pseudo,
        avatar: profile.avatar_url || "",
        points,
        exactScores,
        predictionsCount,
        regularitySuccess,
        pseudo,
      };
    });

    return rankPlayers(rows);
  }

  const rankedPlayers = useMemo(
    () => buildRankedPlayers(),
    [profiles, predictionsByUser, matchesByIdMap],
  );

  const rankedPlayersBeforeLast = useMemo(
    () => buildRankedPlayers(selectedJournee?.id),
    [profiles, predictionsByUser, matchesByIdMap, selectedJournee],
  );

  const currentDayMatches = useMemo<DayMatch[]>(
    () =>
      selectedJournee
        ? [
            ...selectedJournee.matches.map((match) => ({
              match,
              journee: selectedJournee,
              isBonus: false,
            })),
            ...selectedJournee.bonus.map((match) => ({
              match,
              journee: selectedJournee,
              isBonus: true,
            })),
          ].filter(({ match }) => hasScore(match))
        : [],
    [selectedJournee]
  );

  // État de la journée : "upcoming" (pas commencée), "live" (partielle/en
  // cours) ou "finished" (tous les matchs joués). Sert à ne jamais présenter
  // une statistique partielle comme si elle était définitive.
  const dayStatus = useMemo(() => {
    if (!selectedJournee) {
      return { status: "upcoming" as const, total: 0, finished: 0 };
    }
    const all = [...selectedJournee.matches, ...selectedJournee.bonus];
    const total = all.length;
    const finished = currentDayMatches.length;
    const status =
      total === 0 || finished === 0
        ? ("upcoming" as const)
        : finished >= total
          ? ("finished" as const)
          : ("live" as const);
    return { status, total, finished };
  }, [selectedJournee, currentDayMatches]);

  // Répartition 1/N/2 des pronostics des joueurs sur la journée courante.
  const dayPredictionStats = useMemo(() => {
    const distribution = { "1": 0, N: 0, "2": 0 };
    let totalPredictions = 0;
    let totalExact = 0;

    const matchRows: {
      dayMatch: DayMatch;
      picks: { result: string; exact: boolean }[];
    }[] = [];

    profiles.forEach((profile) => {
      const playerPronos = predictionsByUser.get(profile.id);
      currentDayMatches.forEach((dayMatch) => {
        const prono = playerPronos?.byMatch.get(String(dayMatch.match.id));
        if (!prono) return;
        const pick = pickResult(prono);
        const exact = isExactPrediction(dayMatch.match, prono);

        if (pick === "1" || pick === "N" || pick === "2") {
          distribution[pick] += 1;
          totalPredictions += 1;
        }
        if (exact) totalExact += 1;

        let row = matchRows.find(
          (entry) => entry.dayMatch.match === dayMatch.match
        );
        if (!row) {
          row = { dayMatch, picks: [] };
          matchRows.push(row);
        }
        row.picks.push({ result: pick || "", exact });
      });
    });

    return { distribution, totalPredictions, totalExact, matchRows };
  }, [profiles, predictionsByUser, currentDayMatches]);

  // ===== FOCUS JOURNÉE
  const focusStats = useMemo(() => {
    let goals = 0;
    let matchesPlayed = 0;
    currentDayMatches.forEach(({ match }) => {
      goals += Number(getScoreHome(match) || 0) + Number(getScoreAway(match) || 0);
      matchesPlayed += 1;
    });

    return {
      goals,
      matchesPlayed,
      average: matchesPlayed > 0 ? goals / matchesPlayed : 0,
      exactScores: dayPredictionStats.totalExact,
      goalsAvailable: matchesPlayed > 0,
      exactAvailable: dayPredictionStats.totalPredictions > 0,
    };
  }, [currentDayMatches, dayPredictionStats]);

  // ===== FOCUS JOURNÉE : match "en tête d'affiche" — le premier de la
  // journée par coup d'envoi (celui qui ouvre le bal), données réelles
  // uniquement (équipes, logos, date, heure). Aucun stade en base
  // (matches n'a pas de colonne venue) : jamais inventé, simplement omis.
  const focusMatch = useMemo(() => {
    if (!selectedJournee) return null;
    const withKickoff = selectedJournee.matches.filter(
      (m: any) => m.kickoff ?? m.kickoff_time,
    );
    const sorted = [...withKickoff].sort((a: any, b: any) => {
      const ka = new Date(a.kickoff ?? a.kickoff_time).getTime();
      const kb = new Date(b.kickoff ?? b.kickoff_time).getTime();
      return ka - kb;
    });
    return sorted[0] ?? selectedJournee.matches[0] ?? null;
  }, [selectedJournee]);

  // ===== LES TEMPS FORTS
  const highlights = useMemo(() => {
    if (currentDayMatches.length === 0) return null;

    const biggestWin = [...currentDayMatches].sort((a, b) => {
      const ga = Math.abs(
        Number(getScoreHome(a.match) || 0) - Number(getScoreAway(a.match) || 0)
      );
      const gb = Math.abs(
        Number(getScoreHome(b.match) || 0) - Number(getScoreAway(b.match) || 0)
      );
      return gb - ga;
    })[0];

    const mostGoals = [...currentDayMatches].sort((a, b) => {
      const ta =
        Number(getScoreHome(a.match) || 0) + Number(getScoreAway(a.match) || 0);
      const tb =
        Number(getScoreHome(b.match) || 0) + Number(getScoreAway(b.match) || 0);
      return tb - ta;
    })[0];

    const attackMap = new Map<string, number>();
    currentDayMatches.forEach(({ match }) => {
      const home = getTeamHome(match);
      const away = getTeamAway(match);
      attackMap.set(home, (attackMap.get(home) || 0) + Number(getScoreHome(match) || 0));
      attackMap.set(away, (attackMap.get(away) || 0) + Number(getScoreAway(match) || 0));
    });
    const bestAttack = [...attackMap.entries()].sort((a, b) => b[1] - a[1])[0];

    const surpriseCandidates = dayPredictionStats.matchRows
      .map((row) => {
        const actual = getResult1N2(
          getScoreHome(row.dayMatch.match),
          getScoreAway(row.dayMatch.match)
        );
        const votes = row.picks.filter((pick) => pick.result === actual).length;
        return {
          ...row,
          actual,
          percentage: row.picks.length
            ? Math.round((votes / row.picks.length) * 100)
            : 100,
        };
      })
      .filter((row) => row.actual)
      .sort((a, b) => a.percentage - b.percentage)[0];

    return { biggestWin, mostGoals, bestAttack, surprise: surpriseCandidates || null };
  }, [currentDayMatches, dayPredictionStats]);

  // ===== LE PRONO SURPRISE
  // On identifie le match sur lequel les joueurs sont le plus unanimes
  // (le % du résultat dominant le plus élevé) pour contextualiser le pronostic.
  const pronoSurprise = useMemo(() => {
    const total = dayPredictionStats.totalPredictions;
    if (!total) return null;

    const homePctGlobal = Math.round((dayPredictionStats.distribution["1"] / total) * 100);
    const drawPctGlobal = Math.round((dayPredictionStats.distribution.N / total) * 100);
    const awayPctGlobal = Math.max(0, 100 - homePctGlobal - drawPctGlobal);

    // Le match le plus "unanime" : celui dont le résultat dominant concentre
    // le plus grand pourcentage de votes.
    const matchConsensus = dayPredictionStats.matchRows
      .map((row) => {
        const counts = { "1": 0, N: 0, "2": 0 };
        row.picks.forEach((pick) => {
          if (pick.result === "1" || pick.result === "N" || pick.result === "2") {
            counts[pick.result] += 1;
          }
        });
        const n = counts["1"] + counts.N + counts["2"];
        if (!n) return null;
        const winner: "1" | "N" | "2" =
          counts["1"] >= counts.N && counts["1"] >= counts["2"]
            ? "1"
            : counts.N >= counts["2"]
              ? "N"
              : "2";
        const pct = Math.round((counts[winner] / n) * 100);
        return { row, winner, pct, n };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.pct - a.pct || b.n - a.n)[0];

    // Si aucun consensus clair par match, on retombe sur la tendance globale.
    const winner: "1" | "N" | "2" = matchConsensus
      ? matchConsensus.winner
      : homePctGlobal >= drawPctGlobal && homePctGlobal >= awayPctGlobal
        ? "1"
        : drawPctGlobal >= awayPctGlobal
          ? "N"
          : "2";

    const label =
      winner === "1"
        ? "victoire à domicile"
        : winner === "2"
          ? "victoire à l'extérieur"
          : "match nul";

    const pct = matchConsensus
      ? matchConsensus.pct
      : winner === "1"
        ? homePctGlobal
        : winner === "2"
          ? awayPctGlobal
          : drawPctGlobal;

    const matchRef = matchConsensus?.row.dayMatch.match ?? null;
    const home = matchRef ? getTeamHome(matchRef) : "";
    const away = matchRef ? getTeamAway(matchRef) : "";

    return {
      pct,
      label,
      total: matchConsensus?.n ?? total,
      matchLabel: matchRef ? `${shortTeam(home)} — ${shortTeam(away)}` : null,
    };
  }, [dayPredictionStats]);

  // ===== LA TENDANCE
  const tendance = useMemo(() => {
    const merged = rankedPlayers.map((player) => {
      const before = rankedPlayersBeforeLast.find((p) => p.id === player.id);
      const oldRank = before?.rank ?? player.rank;
      return { ...player, oldRank, evolution: oldRank - player.rank };
    });
    const best = [...merged].sort(
      (a, b) => b.evolution - a.evolution || b.points - a.points
    )[0];
    if (!best || best.evolution <= 0) return null;
    return best;
  }, [rankedPlayers, rankedPlayersBeforeLast]);

  // ===== LA UNE : gros événement prioritaire, sinon fait marquant réel.
  const laUne = useMemo(() => {
    if (currentDayMatches.length === 0) return null;

    // Priorité 1 : le plus gros score (événement marquant).
    const sorted = [...currentDayMatches].sort((a, b) => {
      const ta =
        Number(getScoreHome(a.match) || 0) + Number(getScoreAway(a.match) || 0);
      const tb =
        Number(getScoreHome(b.match) || 0) + Number(getScoreAway(b.match) || 0);
      return tb - ta;
    });
    const top = sorted[0];
    const home = getTeamHome(top.match);
    const away = getTeamAway(top.match);
    const scoreH = Number(getScoreHome(top.match) || 0);
    const scoreA = Number(getScoreAway(top.match) || 0);
    const totalGoals = scoreH + scoreA;

    const result1N2 = getResult1N2(scoreH, scoreA);
    let title = `${shortTeam(home)} ${scoreH}–${scoreA} ${shortTeam(away)}`;
    let subtitle = "";

    if (result1N2 === "1") subtitle = `${home} s'impose face à ${away}.`;
    else if (result1N2 === "2") subtitle = `${away} s'impose face à ${home}.`;
    else subtitle = `${home} et ${away} se neutralisent.`;

    if (totalGoals >= 4) {
      title = `${shortTeam(home)}–${shortTeam(away)} : ${totalGoals} buts !`;
    }

    return {
      title,
      subtitle,
      badge: `JOURNÉE ${selectedJournee?.title || ""}`,
      teamName: scoreH >= scoreA ? home : away,
      home,
      away,
      scoreH,
      scoreA,
      totalGoals,
    };
  }, [currentDayMatches, selectedJournee]);

  // ===== CLASSEMENT LIGUE 1 (provisoire, réel) — calculé uniquement à
  // partir des matchs Ligue 1 déjà joués et enregistrés (journees[].matches
  // avec score). Aucune donnée externe : sert uniquement à détecter une
  // course serrée (titre / Europe / maintien) pour la Rubrique du moment.
  const ligue1Standings = useMemo(() => {
    const table = new Map<string, { team: string; points: number; played: number; diff: number }>();
    journees.forEach((j) => {
      j.matches.forEach((m: any) => {
        if (!hasScore(m)) return;
        const home = getTeamHome(m);
        const away = getTeamAway(m);
        const hs = Number(getScoreHome(m) || 0);
        const as = Number(getScoreAway(m) || 0);
        ([[home, hs, as], [away, as, hs]] as const).forEach(([team, gf, ga]) => {
          if (!team) return;
          const row = table.get(team) || { team, points: 0, played: 0, diff: 0 };
          row.played += 1;
          row.diff += gf - ga;
          row.points += gf > ga ? 3 : gf === ga ? 1 : 0;
          table.set(team, row);
        });
      });
    });
    return [...table.values()].sort((a, b) => b.points - a.points || b.diff - a.diff);
  }, [journees]);

  // ===== RUBRIQUE DU MOMENT — remplace automatiquement Mercato quand la
  // période n'est pas active (voir mercatoActive, réglage admin). Choisit un
  // thème éditorial selon le contexte réel de la saison, jamais une donnée
  // externe ni inventée. Architecture volontairement en cascade (if/else if)
  // pour rester facile à étendre avec de nouveaux thèmes.
  const rubriqueDuMoment = useMemo(() => {
    const MIN_PLAYED_FOR_RACE = 5; // trop tôt en saison, un écart de points ne veut encore rien dire.
    const top = ligue1Standings;

    const titleRace =
      top.length >= 2 && top[0].played >= MIN_PLAYED_FOR_RACE && top[0].points - top[1].points <= 3;
    const europeRace =
      top.length >= 6 &&
      top[3].played >= MIN_PLAYED_FOR_RACE &&
      top[3].points - top[5].points <= 3;
    const relegationRace =
      top.length >= 4 &&
      top[top.length - 1].played >= MIN_PLAYED_FOR_RACE &&
      top[top.length - 4].points - top[top.length - 1].points <= 4;

    if (relegationRace) {
      const last4 = top.slice(-4);
      return {
        emoji: "⚠️",
        label: "La course au maintien",
        accentClass: "bg-red-400",
        title: `${last4.length} équipes se tiennent en ${last4[0].points - last4[last4.length - 1].points} points`,
        text: `${last4.map((t) => shortTeam(t.team)).join(", ")} sont engagées dans la lutte pour le maintien.`,
      };
    }
    if (titleRace) {
      return {
        emoji: "🏆",
        label: "La course au titre",
        accentClass: "bg-amber-400",
        title: `${shortTeam(top[0].team)} mène avec ${top[0].points} pts`,
        text: `Seulement ${top[0].points - top[1].points} point${top[0].points - top[1].points > 1 ? "s" : ""} d'avance sur ${shortTeam(top[1].team)} — la course au titre est lancée.`,
      };
    }
    if (europeRace) {
      return {
        emoji: "🔥",
        label: "La course à l'Europe",
        accentClass: "bg-cyan-400",
        title: "Les places européennes se resserrent",
        text: `De la ${4}ᵉ à la ${6}ᵉ place, seulement ${top[3].points - top[5].points} points séparent les prétendants à l'Europe.`,
      };
    }
    if (focusMatch && !hasScore(focusMatch)) {
      return {
        emoji: "⚽",
        label: "Le match du jour",
        accentClass: "bg-emerald-400",
        title: `${shortTeam(getTeamHome(focusMatch))} — ${shortTeam(getTeamAway(focusMatch))}`,
        text: `Rendez-vous à suivre pour la ${selectedJournee?.title || "prochaine journée"} de Ligue 1.`,
      };
    }
    if (dayStatus.status === "finished" && laUne) {
      return {
        emoji: "📋",
        label: "Ce qu'il faut retenir",
        accentClass: "bg-sky-400",
        title: laUne.title,
        text: laUne.subtitle,
      };
    }
    if (highlights?.biggestWin) {
      const m = highlights.biggestWin.match;
      return {
        emoji: "⭐",
        label: "La performance du week-end",
        accentClass: "bg-fuchsia-400",
        title: `${shortTeam(getTeamHome(m))} ${getScoreHome(m)}–${getScoreAway(m)} ${shortTeam(getTeamAway(m))}`,
        text: "La plus large victoire de la journée en Ligue 1.",
      };
    }
    if (laUne) {
      return {
        emoji: "🔥",
        label: "À ne pas manquer",
        accentClass: "bg-emerald-400",
        title: laUne.title,
        text: laUne.subtitle,
      };
    }
    return null;
  }, [ligue1Standings, focusMatch, selectedJournee, dayStatus, laUne, highlights]);

  // ===== DERNIÈRES ACTUS : un mix éditorial des faits réels de la journée.
  // Chaque carte raconte une information DIFFÉRENTE : on déduplique par
  // match pour ne jamais afficher deux fois le même événement (ex. "RCL 1-0 AJA"
  // répété). Les titres sont éditorialisés mais toujours dérivés des données réelles.
  const derniereActus = useMemo(() => {
    const items: {
      id: string;
      title: string;
      subtitle?: string;
      badge: string;
      kickoff?: string;
      teamName?: string;
    }[] = [];

    const usedMatchIds = new Set<string>();

    // Carte 1 — Résultat marquant (la plus large victoire).
    if (highlights?.biggestWin) {
      const m = highlights.biggestWin.match;
      const h = getTeamHome(m);
      const a = getTeamAway(m);
      const hScore = Number(getScoreHome(m) || 0);
      const aScore = Number(getScoreAway(m) || 0);
      const winner = hScore >= aScore ? h : a;
      usedMatchIds.add(String(m.id));
      items.push({
        id: `win-${m.id}`,
        title: `${shortTeam(winner)} signe la plus large victoire`,
        subtitle: `${shortTeam(h)} ${hScore}–${aScore} ${shortTeam(a)}`,
        badge: "RÉSULTAT",
        kickoff: formatKickoff(m.kickoff ?? m.kickoff_time),
        teamName: winner,
      });
    }

    // Carte 2 — Match le plus prolifique (si c'est un AUTRE match que la carte 1).
    if (highlights?.mostGoals && !usedMatchIds.has(String(highlights.mostGoals.match.id))) {
      const m = highlights.mostGoals.match;
      const h = getTeamHome(m);
      const a = getTeamAway(m);
      const total =
        Number(getScoreHome(m) || 0) + Number(getScoreAway(m) || 0);
      usedMatchIds.add(String(m.id));
      items.push({
        id: `goals-${m.id}`,
        title: `${shortTeam(h)}–${shortTeam(a)} : ${total} buts au total`,
        subtitle: `Le match le plus prolifique de la journée`,
        badge: "LIGUE 1",
        kickoff: formatKickoff(m.kickoff ?? m.kickoff_time),
        teamName: total >= 3 ? h : a,
      });
    }

    // Carte 3 — Surprise de la journée (si c'est encore un AUTRE match).
    if (
      highlights?.surprise &&
      !usedMatchIds.has(String(highlights.surprise.dayMatch.match.id))
    ) {
      const m = highlights.surprise.dayMatch.match;
      const h = getTeamHome(m);
      const a = getTeamAway(m);
      usedMatchIds.add(String(m.id));
      items.push({
        id: `surprise-${m.id}`,
        title: `Les joueurs avaient-ils vu juste ?`,
        subtitle: `${shortTeam(h)} ${getScoreHome(m)}–${getScoreAway(m)} ${shortTeam(a)} · ${highlights.surprise.percentage}% de bons pronos`,
        badge: "SURPRISE",
        kickoff: formatKickoff(m.kickoff ?? m.kickoff_time),
        teamName: h,
      });
    }

    // Carte 4 — Classement / progression (toujours une info différente).
    const bestScore = rankedPlayers[0];
    if (bestScore) {
      items.push({
        id: `leader-${bestScore.id}`,
        title: `${bestScore.name} prend les commandes`,
        subtitle: `${bestScore.points} points au classement général`,
        badge: "CLASSEMENT",
        teamName: null as any,
      });
    }

    return items.slice(0, 4);
  }, [highlights, rankedPlayers]);

  // ===== ACTUALITÉS EXTERNES — regroupements dérivés (voir
  // externalArticles + fetchExternalGazetteNews plus haut). Purs ajouts :
  // ne touchent à aucun calcul interne existant (laUne, derniereActus,
  // highlights restent inchangés et servent toujours de repli). =====
  const externalMercatoArticles = useMemo(
    () => externalArticles.filter((a) => a.category === "mercato"),
    [externalArticles]
  );
  const externalGeneralArticles = useMemo(
    () => externalArticles.filter((a) => a.category !== "mercato"),
    [externalArticles]
  );

  // "À la une" : la meilleure vraie actu externe si disponible, sinon
  // l'événement interne calculé (laUne ci-dessus) — jamais les deux mélangés.
  const effectiveLaUne = useMemo(() => {
    const top = externalGeneralArticles[0];
    if (!top) return laUne;
    return {
      title: top.title,
      subtitle: top.summary,
      badge: top.source.toUpperCase(),
      teamName: top.clubLabel,
      imageUrl: top.imageUrl,
      sourceUrl: top.sourceUrl,
    };
  }, [externalGeneralArticles, laUne]);

  // "Dernières actus" : jusqu'à 5 vraies actus externes (on saute celle déjà
  // utilisée en Une pour ne jamais répéter la même info), sinon les cartes
  // internes existantes.
  const effectiveDerniereActus = useMemo(() => {
    if (externalGeneralArticles.length === 0) return derniereActus;
    const usedAsUneId = externalGeneralArticles[0]?.id;
    const pool = externalGeneralArticles.filter((a) => a.id !== usedAsUneId);
    return (pool.length > 0 ? pool : externalGeneralArticles).slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      subtitle: a.summary,
      badge: a.source.toUpperCase(),
      kickoff: formatKickoff(a.publishedAt),
      teamName: a.clubLabel || undefined,
      imageUrl: a.imageUrl || undefined,
      onClick: () => window.open(a.sourceUrl, "_blank", "noopener,noreferrer"),
    }));
  }, [externalGeneralArticles, derniereActus]);

  // "Les temps forts" : ligne secondaire de vraies actus externes, en plus
  // du résumé statistique interne — jamais à la place (voir JSX plus bas).
  const externalHighlightExtras = useMemo(() => {
    const usedIds = new Set(
      [externalGeneralArticles[0]?.id, ...effectiveDerniereActus.map((a: any) => a.id)].filter(Boolean)
    );
    return externalGeneralArticles.filter((a) => !usedIds.has(a.id)).slice(0, 3);
  }, [externalGeneralArticles, effectiveDerniereActus]);

  const hasAnyData = journees.length > 0;

  return (
    <AppShell>
      <style>{`
        @keyframes gazette-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .gazette-fade-up { animation: gazette-fade-up .55s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .gazette-fade-up { animation: none; }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-6xl space-y-5 pb-28 md:space-y-7 md:pb-20">
        {/* ===== HEADER PREMIUM COMPACT ===== */}
        <header className="gazette-fade-up flex items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-4 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#060b16]">
              <img
                src="/logo%20ligue%201%20white.png"
                alt="Ligue 1"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1
                className="bg-gradient-to-b from-white via-white to-[color-mix(in_oklab,var(--sky)_32%,white)] bg-clip-text font-display text-2xl font-black uppercase leading-none tracking-[-0.02em] text-transparent md:text-3xl"
                style={{
                  filter:
                    "drop-shadow(0 1px 0 rgba(0,0,0,.35)) drop-shadow(0 0 16px rgba(22,82,240,.16))",
                }}
              >
                La Gazette
              </h1>
              <p className="mt-1 text-[11px] leading-tight text-slate-400">
                Toute l'actualité de la <span className="text-emerald-400">Ligue 1</span>
              </p>
              {lastUpdated && (
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.1em] text-slate-600">
                  <span className="size-1 rounded-full bg-emerald-400/70" />
                  Actualisé à{" "}
                  {lastUpdated.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="tap relative flex size-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            >
              <Bell className="size-4" />
              {hasAnyData && (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,.55)]" />
              )}
            </button>
            <button
              type="button"
              aria-label="Menu"
              className="tap flex size-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </header>

        {/* ===== ÉTAT CHARGEMENT ===== */}
        {loading ? (
          <div className="space-y-8">
            <HeroSkeleton />
            <section>
              <SkeletonBlock className="mb-4 h-5 w-40" />
              <div className="space-y-3">
                <ActuSkeleton />
                <ActuSkeleton />
                <ActuSkeleton />
              </div>
            </section>
            <FocusSkeleton />
          </div>
        ) : error ? (
          /* ===== ÉTAT ERREUR ===== */
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10">
              <Newspaper className="size-6 text-red-400" />
            </div>
            <p className="mt-4 font-display text-lg font-bold text-white">
              Données momentanément indisponibles.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Réessaie dans un instant, la Gazette se met à jour régulièrement.
            </p>
            <button
              type="button"
              onClick={() => loadData()}
              className="tap mt-6 flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-3 font-display text-sm font-bold text-slate-950"
            >
              RÉESSAYER <ArrowRight className="size-4" />
            </button>
          </section>
        ) : !hasAnyData ? (
          /* ===== ÉTAT VIDE ===== */
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
              <Newspaper className="size-6 text-emerald-400" />
            </div>
            <p className="mt-4 font-display text-lg font-bold text-white">
              La Gazette se prépare.
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              Les actualités et statistiques apparaîtront après les premiers matchs de la saison.
            </p>
          </section>
        ) : (
          <>
            {/* ===== À LA UNE ===== */}
            <section className="gazette-fade-up">
              {effectiveLaUne ? (
                <article
                  className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 shadow-[0_0_50px_rgba(0,0,0,0.7)]"
                  style={{ minHeight: 260 }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url('${
                        (effectiveLaUne as any).imageUrl || clubAsset(effectiveLaUne.teamName).background
                      }')`,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030914] via-[#030914]/45 to-transparent" />

                  {/* Badge À LA UNE (+ indicateur d'autres actus disponibles) */}
                  <div className="absolute left-5 top-5 z-10 flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                      <Zap className="size-3 text-emerald-400" />
                      <span className="font-mono text-[9px] font-bold tracking-[.16em] text-emerald-300">
                        À LA UNE
                      </span>
                    </div>
                    {effectiveDerniereActus.length > 0 && (
                      <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[9px] font-bold text-slate-300 backdrop-blur-md">
                        +{effectiveDerniereActus.length} actu{effectiveDerniereActus.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 flex min-h-[260px] flex-col justify-end p-5 md:p-7">
                    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[9px] font-bold tracking-[.14em] text-slate-300 backdrop-blur-sm">
                      <Trophy className="size-3 text-emerald-400" />
                      {effectiveLaUne.badge}
                    </span>

                    <h2
                      className="max-w-2xl font-display text-3xl font-black uppercase leading-[0.95] text-white md:text-5xl"
                      style={{ textShadow: "0 2px 20px rgba(0,0,0,.7)" }}
                    >
                      {effectiveLaUne.title}
                    </h2>
                    <p
                      className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-200 md:text-base"
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,.7)" }}
                    >
                      {effectiveLaUne.subtitle}
                    </p>

                    <div className="mt-5 flex items-center gap-3">
                      {(effectiveLaUne as any).sourceUrl ? (
                        <a
                          href={(effectiveLaUne as any).sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tap flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-3 font-display text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                        >
                          LIRE L'ARTICLE <ArrowRight className="size-4" />
                        </a>
                      ) : (
                        <Link
                          to="/pronostics"
                          className="tap flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-3 font-display text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                        >
                          LIRE L'ARTICLE <ArrowRight className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ) : (
                <EditorialEmptyState
                  icon={Zap}
                  title="Aucune actualité disponible pour le moment."
                  description="La une s'activera automatiquement dès les premiers résultats de la saison."
                />
              )}
            </section>

            {/* ===== DERNIÈRES ACTUS ===== */}
            <section className="gazette-fade-up" style={{ animationDelay: "70ms" }}>
              <SectionTitle hint="MISE À JOUR EN DIRECT">
                Dernières actus
              </SectionTitle>

              {effectiveDerniereActus.length === 0 ? (
                <EditorialEmptyState
                  icon={Newspaper}
                  title="Aucune actualité disponible pour le moment."
                  description="Les résultats et faits marquants de chaque journée apparaîtront ici automatiquement."
                />
              ) : (
                <div className="flex items-stretch gap-3">
                  <div className="grid flex-1 gap-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {effectiveDerniereActus.slice(0, 2).map((item: any) => (
                        <ActuCard
                          key={item.id}
                          {...item}
                          teamName={item.teamName || undefined}
                        />
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {effectiveDerniereActus.slice(2, 4).map((item: any) => (
                        <ActuCard
                          key={item.id}
                          {...item}
                          teamName={item.teamName || undefined}
                        />
                      ))}
                    </div>
                  </div>

                  <Link
                    to="/pronostics"
                    className="tap hidden shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-[#0d1322]/60 px-5 text-center hover:border-emerald-500/40 sm:flex"
                  >
                    <ChevronRight className="size-5 text-emerald-400" />
                    <span className="max-w-[80px] font-mono text-[9px] font-bold tracking-[.14em] text-slate-400">
                      VOIR TOUT
                    </span>
                  </Link>
                </div>
              )}
            </section>

            {/* ===== FOCUS JOURNÉE ===== */}
            <section className="gazette-fade-up" style={{ animationDelay: "120ms" }}>
              <SectionTitle
                accentClass="bg-amber-400"
                hint={`${selectedJournee?.title || ""}${
                  dayStatus.status === "live"
                    ? ` · ${dayStatus.finished}/${dayStatus.total} matchs`
                    : dayStatus.status === "finished"
                      ? " · TERMINÉE"
                      : " · EN ATTENTE"
                }`}
              >
                Focus journée
              </SectionTitle>

              {focusMatch ? (
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 pt-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 font-mono text-[9px] font-bold tracking-[.14em] text-amber-300">
                      <Trophy className="size-3" />
                      JOURNÉE {selectedJournee?.number}
                    </span>
                    <span
                      className={`font-mono text-[9px] font-bold uppercase tracking-[.14em] ${
                        hasScore(focusMatch) ? "text-slate-500" : "text-emerald-400"
                      }`}
                    >
                      {hasScore(focusMatch) ? "Terminé" : "Match à venir"}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5 sm:gap-6 sm:py-6">
                    <div className="flex flex-col items-center gap-2.5 text-center">
                      <div
                        className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] bg-contain bg-center bg-no-repeat sm:size-16"
                        style={{ backgroundImage: clubAsset(getTeamHome(focusMatch)).logo ? `url('${clubAsset(getTeamHome(focusMatch)).logo}')` : undefined }}
                      />
                      <span className="line-clamp-2 max-w-[7rem] font-display text-xs font-black uppercase leading-tight text-white sm:text-sm">
                        {getTeamHome(focusMatch)}
                      </span>
                    </div>

                    {hasScore(focusMatch) ? (
                      <div className="font-display text-2xl font-black text-white sm:text-3xl">
                        {getScoreHome(focusMatch)}–{getScoreAway(focusMatch)}
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                        VS
                      </div>
                    )}

                    <div className="flex flex-col items-center gap-2.5 text-center">
                      <div
                        className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] bg-contain bg-center bg-no-repeat sm:size-16"
                        style={{ backgroundImage: clubAsset(getTeamAway(focusMatch)).logo ? `url('${clubAsset(getTeamAway(focusMatch)).logo}')` : undefined }}
                      />
                      <span className="line-clamp-2 max-w-[7rem] font-display text-xs font-black uppercase leading-tight text-white sm:text-sm">
                        {getTeamAway(focusMatch)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 px-5 py-3.5">
                    {(focusMatch.kickoff ?? focusMatch.kickoff_time) && (
                      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-slate-400">
                        <Clock3 className="size-3.5 text-amber-400" />
                        {new Date(focusMatch.kickoff ?? focusMatch.kickoff_time).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}{" "}
                        —{" "}
                        {new Date(focusMatch.kickoff ?? focusMatch.kickoff_time).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <Link
                      to="/pronostics"
                      className="tap ml-auto flex items-center gap-1.5 font-display text-xs font-bold text-amber-300 hover:text-amber-200"
                    >
                      LIRE LE FOCUS <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <EditorialEmptyState
                  icon={Trophy}
                  title="Aucun match programmé pour le moment."
                  description="Le focus de la journée apparaîtra dès la publication du calendrier."
                />
              )}
            </section>

            {/* ===== À SURVEILLER + LE CHIFFRE (côte à côte dès que la place le permet) ===== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* ----- À SURVEILLER ----- */}
              <section className="gazette-fade-up" style={{ animationDelay: "150ms" }}>
                <SectionTitle accentClass="bg-emerald-400">À surveiller</SectionTitle>

                {tendance ? (
                  <Link
                    to="/classement"
                    className="tap group flex h-full items-center gap-3.5 rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-4 backdrop-blur-xl hover:border-emerald-500/30"
                  >
                    <div className="relative shrink-0">
                      {tendance.avatar ? (
                        <img
                          src={tendance.avatar}
                          alt=""
                          className="size-14 rounded-2xl border border-emerald-400/30 object-cover"
                        />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 font-display text-lg font-black text-emerald-300">
                          {tendance.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1.5 -right-1.5 flex items-center gap-0.5 rounded-full bg-emerald-400 px-1.5 py-0.5 font-mono text-[9px] font-black text-slate-950 shadow-[0_0_8px_rgba(52,211,153,.6)]">
                        <TrendingUp className="size-2.5" />+{tendance.evolution}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-black text-white">
                        {tendance.name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-emerald-400">
                        ↑ Progression au classement
                      </p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-300">
                        #{tendance.rank} · {tendance.points} pts
                      </p>
                    </div>

                    <ChevronRight className="size-4 shrink-0 self-center text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                  </Link>
                ) : (
                  <EditorialEmptyState
                    compact
                    icon={TrendingUp}
                    title="Pas encore de tendance notable."
                    description="Le joueur qui progresse le plus apparaîtra ici après la prochaine journée."
                  />
                )}
              </section>

              {/* ----- LE CHIFFRE ----- */}
              <section className="gazette-fade-up" style={{ animationDelay: "180ms" }}>
                <SectionTitle accentClass="bg-sky-400">Le chiffre</SectionTitle>

                {focusStats.goalsAvailable ? (
                  <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-5 text-center backdrop-blur-xl">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-400/10 to-transparent"
                    />
                    <div className="relative flex items-center justify-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-sky-300">
                      <Hash className="size-3" />
                      Statistique du jour
                    </div>
                    <div
                      className="relative mt-1 font-display text-5xl font-black text-white"
                      style={{ textShadow: "0 0 30px rgba(56,189,248,.35)" }}
                    >
                      {focusStats.goals}
                    </div>
                    <p className="relative mt-1 text-xs font-semibold text-slate-300">
                      but{focusStats.goals > 1 ? "s" : ""} marqué{focusStats.goals > 1 ? "s" : ""} · {selectedJournee?.title || "journée"}
                    </p>
                    <p className="relative mt-1 font-mono text-[10px] text-slate-500">
                      {focusStats.average.toFixed(2)} but{focusStats.average >= 2 ? "s" : ""}/match
                      {focusStats.exactAvailable ? ` · ${focusStats.exactScores} exact${focusStats.exactScores > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                ) : (
                  <EditorialEmptyState
                    compact
                    icon={Hash}
                    title="Les statistiques arrivent après les premiers matchs."
                    description="Buts et moyennes apparaîtront ici dès les premiers résultats."
                  />
                )}
              </section>
            </div>

            {/* ===== DANS NOTRE COMPÉTITION ===== */}
            <section className="gazette-fade-up" style={{ animationDelay: "210ms" }}>
              <SectionTitle accentClass="bg-amber-400">
                Dans notre compétition
              </SectionTitle>

              {rankedPlayers.length === 0 ? (
                <EditorialEmptyState
                  icon={Trophy}
                  title="Le classement démarre avec les premiers pronostics."
                  description="Reviens ici dès que les premières journées seront jouées."
                />
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-4 backdrop-blur-xl md:p-5">
                  <div className="space-y-2">
                    {rankedPlayers.slice(0, 3).map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-black/15 px-3.5 py-2.5"
                      >
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full font-display text-[11px] font-black ${
                            player.rank === 1
                              ? "bg-amber-400 text-slate-950"
                              : player.rank === 2
                                ? "bg-slate-300 text-slate-950"
                                : "bg-orange-400/80 text-slate-950"
                          }`}
                        >
                          {player.rank}
                        </span>

                        {player.avatar ? (
                          <img
                            src={player.avatar}
                            alt=""
                            className="size-8 shrink-0 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 font-display text-[10px] font-black text-slate-400">
                            {player.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-bold text-white">
                            {player.name}
                          </p>
                          {player.exactScores > 0 && (
                            <p className="text-[10px] text-slate-500">
                              {player.exactScores} score{player.exactScores > 1 ? "s" : ""} exact{player.exactScores > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 font-mono text-sm font-black text-emerald-300">
                          {player.points} pts
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/classement"
                    className="tap mt-3 flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                  >
                    VOIR LE CLASSEMENT <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </section>

            {/* ===== LES TEMPS FORTS ===== */}
            <section className="gazette-fade-up" style={{ animationDelay: "170ms" }}>
              <SectionTitle accentClass="bg-cyan-400">
                Les temps forts
              </SectionTitle>

              {!highlights ? (
                <EditorialEmptyState
                  icon={Flame}
                  title="Aucun temps fort disponible pour le moment."
                  description="Les faits marquants de la journée apparaîtront ici dès les premiers résultats."
                />
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl">
                  <div className="flex items-center gap-2 border-b border-slate-800/80 px-5 py-3.5">
                    <Flame className="size-4 text-cyan-400" />
                    <span className="font-display text-sm font-black uppercase tracking-wide text-white">
                      Résumé de {selectedJournee?.title || "la journée"}
                    </span>
                  </div>

                  <div className="grid gap-px bg-slate-800/60 p-px sm:grid-cols-2">
                    {highlights.biggestWin && (
                      <div className="tap bg-[#0d1322] p-4">
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-emerald-400">
                          <Trophy className="size-3.5" /> Plus large victoire
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 font-display text-lg font-black text-white">
                          <span>{shortTeam(getTeamHome(highlights.biggestWin.match))}</span>
                          <span className="text-emerald-300">
                            {getScoreHome(highlights.biggestWin.match)}–
                            {getScoreAway(highlights.biggestWin.match)}
                          </span>
                          <span>{shortTeam(getTeamAway(highlights.biggestWin.match))}</span>
                        </div>
                      </div>
                    )}

                    {highlights.bestAttack && (
                      <div className="tap bg-[#0d1322] p-4">
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-amber-400">
                          <Flame className="size-3.5" />{" "}
                          {dayStatus.status === "live" ? "Meilleur départ" : "Meilleure attaque"}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 font-display text-lg font-black text-white">
                          <span className="truncate">{highlights.bestAttack[0]}</span>
                          <span className="text-amber-300">{highlights.bestAttack[1]} buts</span>
                        </div>
                      </div>
                    )}

                    {highlights.mostGoals && (
                      <div className="tap bg-[#0d1322] p-4">
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-cyan-400">
                          <Zap className="size-3.5" /> Match le plus prolifique
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 font-display text-lg font-black text-white">
                          <span>{shortTeam(getTeamHome(highlights.mostGoals.match))}</span>
                          <span className="text-cyan-300">
                            {getScoreHome(highlights.mostGoals.match)}–
                            {getScoreAway(highlights.mostGoals.match)}
                          </span>
                          <span>{shortTeam(getTeamAway(highlights.mostGoals.match))}</span>
                        </div>
                        <div className="mt-1 text-right font-mono text-[9px] text-slate-500">
                          {Number(getScoreHome(highlights.mostGoals.match) || 0) +
                            Number(getScoreAway(highlights.mostGoals.match) || 0)}{" "}
                          buts au total
                        </div>
                      </div>
                    )}

                    {highlights.surprise ? (
                      <div className="tap bg-[#0d1322] p-4">
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-fuchsia-400">
                          <Lightbulb className="size-3.5" /> Surprise de la journée
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 font-display text-lg font-black text-white">
                          <span>
                            {shortTeam(getTeamHome(highlights.surprise.dayMatch.match))}
                          </span>
                          <span className="text-fuchsia-300">
                            {getScoreHome(highlights.surprise.dayMatch.match)}–
                            {getScoreAway(highlights.surprise.dayMatch.match)}
                          </span>
                          <span>
                            {shortTeam(getTeamAway(highlights.surprise.dayMatch.match))}
                          </span>
                        </div>
                        <div className="mt-1 text-right font-mono text-[9px] text-slate-500">
                          {highlights.surprise.percentage}% l'avaient vu venir
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center bg-[#0d1322] p-4">
                        <p className="text-xs text-slate-600">
                          Pas encore de surprise notable cette journée.
                        </p>
                      </div>
                    )}
                  </div>

                  {externalHighlightExtras.length > 0 && (
                    <div className="border-t border-slate-800/80 p-3">
                      <p className="mb-2 px-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">
                        Dans les médias
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {externalHighlightExtras.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => window.open(a.sourceUrl, "_blank", "noopener,noreferrer")}
                            className="tap rounded-xl border border-slate-800 bg-[#0d1322] p-3 text-left hover:border-cyan-500/30"
                          >
                            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[.1em] text-cyan-400">
                              {a.source.toUpperCase()}
                            </span>
                            <p className="mt-1.5 line-clamp-2 font-display text-xs font-bold leading-snug text-white">
                              {a.title}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ===== LE PRONO SURPRISE ===== */}
            {pronoSurprise && (
              <section className="gazette-fade-up" style={{ animationDelay: "220ms" }}>
                <SectionTitle accentClass="bg-fuchsia-400">
                  Le prono surprise
                </SectionTitle>

                <div className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-5 backdrop-blur-xl md:p-6">
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
                    {/* Cercle de progression */}
                    <div className="relative flex size-28 shrink-0 items-center justify-center md:size-32">
                      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          fill="none"
                          stroke="#172033"
                          strokeWidth="10"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          fill="none"
                          stroke="#e879f9"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(pronoSurprise.pct / 100) * (2 * Math.PI * 52)} ${
                            2 * Math.PI * 52
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-4xl font-black text-white md:text-5xl">
                          {pronoSurprise.pct}
                          <span className="text-[0.55em] align-top text-fuchsia-300">%</span>
                        </span>
                        <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-slate-400">
                          des joueurs
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <p className="font-display text-2xl font-bold text-white">
                        {pronoSurprise.label}
                      </p>
                      {pronoSurprise.matchLabel && (
                        <p className="mt-1 font-display text-lg font-black tracking-wide text-fuchsia-300">
                          {pronoSurprise.matchLabel}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        {pronoSurprise.total} pronostics analysés
                        {pronoSurprise.matchLabel ? " sur ce match" : ""} ·{" "}
                        {selectedJournee?.title || "journée en cours"}
                      </p>

                      <Link
                        to="/pronostics"
                        className="tap mt-6 inline-flex items-center gap-2 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-6 py-3 font-display text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-500/20"
                      >
                        DÉCOUVRIR <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ===== MERCATO (si actif) OU RUBRIQUE DU MOMENT (sinon) ===== */}
            {mercatoActive ? (
              <section className="gazette-fade-up" style={{ animationDelay: "300ms" }}>
                <SectionTitle accentClass="bg-amber-400">Mercato</SectionTitle>

                {externalMercatoArticles.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {externalMercatoArticles.slice(0, 4).map((a) => {
                      const typeLabel =
                        a.newsType === "officiel"
                          ? "OFFICIEL"
                          : a.newsType === "en_discussion"
                          ? "EN DISCUSSION"
                          : "RUMEUR";
                      const typeClass =
                        a.newsType === "officiel"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : a.newsType === "en_discussion"
                          ? "bg-sky-500/10 text-sky-400"
                          : "bg-amber-500/10 text-amber-400";
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => window.open(a.sourceUrl, "_blank", "noopener,noreferrer")}
                          className="tap rounded-2xl border border-slate-800 bg-[#0d1322]/80 p-3.5 text-left hover:border-amber-500/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-[.12em] ${typeClass}`}>
                              {typeLabel}
                            </span>
                            <span className="font-mono text-[9px] text-slate-500">{a.source}</span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 font-display text-sm font-bold leading-snug text-white">
                            {a.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                            {a.summary}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EditorialEmptyState
                    compact
                    icon={ArrowLeftRight}
                    title="Mercato"
                    description="Les informations apparaîtront ici dès qu'une actualité mercato Ligue 1 sera détectée."
                  />
                )}
              </section>
            ) : rubriqueDuMoment ? (
              <section className="gazette-fade-up" style={{ animationDelay: "300ms" }}>
                <SectionTitle accentClass={rubriqueDuMoment.accentClass}>
                  {rubriqueDuMoment.emoji} {rubriqueDuMoment.label}
                </SectionTitle>

                <div className="rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-4 backdrop-blur-xl">
                  <p className="font-display text-base font-black text-white">
                    {rubriqueDuMoment.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {rubriqueDuMoment.text}
                  </p>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}