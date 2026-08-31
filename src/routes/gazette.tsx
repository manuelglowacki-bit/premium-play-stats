import { createFileRoute, Link } from "@tanstack/react-router";
import { choisirJourneeGazette } from "@/lib/journeeGazette";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ongletVisible } from "@/lib/ongletVisible";
import { fetchAllRowsCache } from "@/lib/supabaseFetchAll";
import { getMatches, getMatchdays } from "@/services/adminService";
import { getOfficialClubId } from "@/lib/team-identity";
import { matchAppeal, type StandingsLookup } from "@/lib/clubReputation";
import { getForeignClubLogo } from "@/lib/clubLogos";
import { getLigue1Standings, type CompetitionStandings } from "@/services/standingsService";
import { normalizeTeamName } from "@/services/bonusSelectionService";
import { getTeamTheme } from "@/lib/team-theme";
import { rankPlayers } from "@/lib/leaderboardRanking";
import {
  computeLeagueStats,
  type LeagueBonusOption,
  type LeagueMatch,
  type LeaguePrediction,
  type LeagueProfile,
} from "@/lib/leaderboardStats";
import { fetchExternalGazetteNews, type GazetteArticle } from "@/services/gazetteNewsService";
import {
  fetchLiveApiMatches,
  reconcileMatchesWithLive,
  markLiveMatchesScorable,
  FINISHED_STATUSES,
  IN_PROGRESS_STATUSES,
} from "@/lib/liveMatches";

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

type GazetteTeam = {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
};

// ============================================================
// HELPERS DE DONNÉES (réutilisés depuis l'ancienne Gazette)
// ============================================================

// Accord en nombre, pour ne plus lire "2 score exact" dans un article.
// `pluriel` n'est a fournir que si le mot ne prend pas un simple "s"
// (ex. "scores exacts", ou l'adjectif s'accorde aussi).
function accord(n: number, singulier: string, pluriel?: string) {
  return `${n} ${n > 1 ? pluriel ?? `${singulier}s` : singulier}`;
}

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

// ============================================================
// LOGOS LOCAUX — public/logos
// ============================================================

const LOCAL_LIGUE1_LOGOS: Record<string, string> = {
  angers: "/logos/ligue1/angers.png",
  auxerre: "/logos/ligue1/auxerre.png",
  brest: "/logos/ligue1/brest.png",
  lehavre: "/logos/ligue1/lehavre.png",
  lemans: "/logos/ligue1/lemans.png",
  lens: "/logos/ligue1/lens.png",
  lille: "/logos/ligue1/lille.png",
  lorient: "/logos/ligue1/lorient.png",
  monaco: "/logos/ligue1/monaco.png",
  nice: "/logos/ligue1/nice.png",
  lyon: "/logos/ligue1/ol.png",
  om: "/logos/ligue1/om.png",
  marseille: "/logos/ligue1/om.png",
  olympiquedemarseille: "/logos/ligue1/om.png",
  ol: "/logos/ligue1/ol.png",
  lyonnais: "/logos/ligue1/ol.png",
  parisfc: "/logos/ligue1/parisfc.png",
  psg: "/logos/ligue1/psg.png",
  parissg: "/logos/ligue1/psg.png",
  parissaintgermain: "/logos/ligue1/psg.png",
  rennes: "/logos/ligue1/rennes.png",
  strasbourg: "/logos/ligue1/strasbourg.png",
  rcstrasbourg: "/logos/ligue1/strasbourg.png",
  toulouse: "/logos/ligue1/tfc.png",
  tfc: "/logos/ligue1/tfc.png",
  troyes: "/logos/ligue1/troyes.png",
};

const LOCAL_BONUS_LOGOS: Record<string, string> = {
  premierleague: "/logos/Premier league",
  liga: "/logos/Liga",
  seriea: "/logos/Serie A",
  bundesliga: "/logos/Bundesliga",
};

function normalizeClubLogoName(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getLocalLigue1Logo(teamName: unknown) {
  const key = normalizeClubLogoName(teamName);
  if (LOCAL_LIGUE1_LOGOS[key]) return LOCAL_LIGUE1_LOGOS[key];

  return null;
}

function getLocalTeamLogo(match: any, side: "home" | "away") {
  const team =
    side === "home" ? getTeamHome(match) : getTeamAway(match);

  // Keep any exact local logo URL already stored in the match.
  const direct =
    side === "home"
      ? match?.home_logo ?? match?.homeLogo ?? match?.homeTeam?.logo
      : match?.away_logo ?? match?.awayLogo ?? match?.awayTeam?.logo;

  if (
    typeof direct === "string" &&
    direct.startsWith("/logos/")
  ) {
    return direct;
  }

  // Les championnats bonus (PL/PD/SA/BL1) ont eux aussi leurs logos dans
  // /public/logos, mais seule la table Ligue 1 était consultée : un
  // Atlético–Villarreal s'affichait avec deux pastilles grises.
  return getLocalLigue1Logo(team) ?? getForeignClubLogo(team);
}

function LocalTeamLogo({
  match,
  side,
  size = "size-11",
}: {
  match: any;
  side: "home" | "away";
  size?: string;
}) {
  const logo = getLocalTeamLogo(match, side);
  const name = side === "home" ? getTeamHome(match) : getTeamAway(match);

  return logo ? (
    <img
      src={logo}
      alt={`Logo ${name}`}
      className={`${size} shrink-0 object-contain drop-shadow-[0_5px_16px_rgba(0,0,0,.55)]`}
      loading="eager"
    />
  ) : (
    <div
      className={`${size} shrink-0 rounded-full border border-white/10 bg-slate-900/80`}
      aria-label={`Logo ${name}`}
    />
  );
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


function getMatchState(match: any): "upcoming" | "live" | "finished" {
  // Vocabulaire de statuts UNIQUE (src/lib/liveMatches.ts) — la Gazette ne
  // doit pas reconnaître un sous-ensemble différent de LIVE/FINISHED par
  // rapport à Classement/Accueil/Profil/Stats/Pronostics.
  const raw = String(
    match?.status ??
      match?.match_status ??
      match?.state ??
      match?.fixture_status ??
      match?.status_short ??
      ""
  ).toUpperCase();

  if (IN_PROGRESS_STATUSES.has(raw)) {
    return "live";
  }
  if (FINISHED_STATUSES.has(raw)) {
    return "finished";
  }
  if (["POSTPONED", "CANCELLED", "CANCELED", "SUSPENDED"].includes(raw)) {
    return "upcoming";
  }

  // Fallback quand la base ne stocke pas encore de statut :
  // on considère le match en direct autour de son coup d'envoi si un score
  // existe déjà. Cela permet à la Gazette de bouger pendant les rencontres
  // sans toucher aux calculs de points.
  const kickoff = match?.kickoff ?? match?.kickoff_time;
  if (kickoff) {
    const start = new Date(kickoff).getTime();
    if (Number.isFinite(start)) {
      const now = Date.now();
      const elapsed = now - start;
      if (elapsed >= 0 && elapsed <= 2.25 * 60 * 60 * 1000) {
        return hasScore(match) ? "live" : "upcoming";
      }
    }
  }

  return hasScore(match) ? "finished" : "upcoming";
}

function getLiveMinute(match: any) {
  const explicit =
    match?.minute ??
    match?.elapsed ??
    match?.elapsed_minute ??
    match?.status_minute ??
    match?.fixture?.status?.elapsed ??
    null;
  const n = Number(explicit);
  if (Number.isFinite(n) && n >= 0) return `${Math.min(120, Math.round(n))}'`;
  return "EN DIRECT";
}

function getKickoffTimestamp(match: any) {
  const raw = match?.kickoff ?? match?.kickoff_time;
  if (!raw) return NaN;
  return new Date(raw).getTime();
}

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateKeyFromMatch(match: any) {
  const ts = getKickoffTimestamp(match);
  if (!Number.isFinite(ts)) return "";
  return localDateKey(new Date(ts));
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

function isActuallyFinished(match: any): boolean {
  const state = getMatchState(match);
  if (state !== "finished") return false;

  const kickoff = getKickoffTimestamp(match);
  if (Number.isFinite(kickoff) && kickoff > Date.now()) return false;

  return hasScore(match);
}

function isExactPrediction(match: any, prono: any): boolean {
  if (!prono || prono.home_prediction == null || prono.away_prediction == null) return false;
  if (!isActuallyFinished(match)) return false;

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

function normalizeGazetteTeam(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function teamFromGazette(teams: GazetteTeam[], match: any, side: "home" | "away") {
  const id = side === "home" ? match?.home_team_id : match?.away_team_id;
  const name = side === "home" ? getTeamHome(match) : getTeamAway(match);

  if (id) {
    const byId = teams.find((team) => String(team.id) === String(id));
    if (byId) return byId;
  }

  const wanted = normalizeGazetteTeam(name);
  if (!wanted) return null;

  return teams.find((team) => {
    const n = normalizeGazetteTeam(team.name);
    const sn = normalizeGazetteTeam(team.short_name);
    return n === wanted || sn === wanted || n.includes(wanted) || wanted.includes(n);
  }) ?? null;
}

function GazetteTeamLogo({
  teams,
  match,
  side,
  size = "size-11",
}: {
  teams: GazetteTeam[];
  match: any;
  side: "home" | "away";
  size?: string;
}) {
  const team = teamFromGazette(teams, match, side);
  const local = getLocalTeamLogo(match, side);
  const logo = team?.logo_url || local;
  const name = side === "home" ? getTeamHome(match) : getTeamAway(match);

  if (!logo) {
    return (
      <div className={`${size} shrink-0 rounded-full border border-white/10 bg-slate-900/80`} aria-label={`Logo ${name}`} />
    );
  }

  return (
    <img
      src={logo}
      alt={`Logo ${team?.name ?? name}`}
      className={`${size} shrink-0 object-contain drop-shadow-[0_5px_16px_rgba(0,0,0,.6)]`}
      loading="eager"
      onError={(event) => {
        const target = event.currentTarget;
        if (target.src.endsWith(local ?? "___none___")) target.style.display = "none";
      }}
    />
  );
}

// Résolution du thème (fond + logo) d'un club pour les cartes éditoriales.
function clubAsset(name: string | undefined | null) {
  const key = normalizeClubLogoName(name);
  // Même repli que getLocalTeamLogo : les cartes éditoriales peuvent porter
  // sur un match bonus, donc sur un club étranger.
  const logo = LOCAL_LIGUE1_LOGOS[key] ?? getForeignClubLogo(name);

  return {
    logo,
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
  const bg = imageUrl || null;

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
  const [predictionsByUser, setPredictionsByUser] = useState<Map<string, PlayerPronos>>(new Map());
  const [teams, setTeams] = useState<GazetteTeam[]>([]);

  // Même source de vérité que la page Classement.
  const [rankingPredictions, setRankingPredictions] = useState<LeaguePrediction[]>([]);
  const [rankingBonusOptions, setRankingBonusOptions] = useState<LeagueBonusOption[]>([]);
  const [rankingFavoriteHistory, setRankingFavoriteHistory] = useState<Record<string, string | undefined>>({});
  const [rankingTeamNames, setRankingTeamNames] = useState<Record<string, string | undefined>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(Date.now());
  // Repliement de l'analyse — etat d'AFFICHAGE uniquement. Le texte reste
  // celui que produit `analysis` ; on choisit seulement combien de
  // paragraphes sont visibles avant le clic.
  const [analyseDepliee, setAnalyseDepliee] = useState(false);
  // Empêche une requête devenue obsolète (refresh live précédent encore en
  // vol) d'écraser un résultat plus récent — même garde que Classement/
  // Accueil/Profil/Stats.
  const loadSeqRef = useRef(0);

  async function loadData(silent = false) {
    const requestId = ++loadSeqRef.current;
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
        { data: teamsData, error: teamsError },
        { data: favoriteHistoryData, error: favoriteHistoryError },
        apiLiveMatches,
      ] = await Promise.all([
        supabase.from("competitions").select("id, external_code, code"),
        getMatchdays(),
        getMatches(),
        supabase.from("bonus_options").select("matchday_id, match_id").eq("is_active", true),
        supabase.from("profiles").select("*").order("pseudo", { ascending: true, nullsFirst: false }),
        // Paginee : sans cela PostgREST tronque a 1000 lignes en silence et
        // la Gazette raconte la journee sur des chiffres incomplets.
        // Colonnes explicites plutot que « * ». Verifie une par une : la
        // Gazette ne lit que user_id, match_id et les deux scores, et le
        // moteur de points a besoin de created_at (il departage les pronostics
        // bonus d'une meme journee : le plus recent gagne). Les colonnes `id`
        // et `points` n'etaient lues nulle part — cette derniere n'est de toute
        // facon jamais ecrite par le site.
        fetchAllRowsCache(
          "predictions",
          "user_id,match_id,home_prediction,away_prediction,created_at",
          ["user_id", "match_id"],
        ),
        supabase.from("teams").select("id, name, short_name, logo_url"),
        supabase
          .from("user_season_favorite_teams")
          .select("user_id, season_id, favorite_team_id"),
        // Même fetcher que toutes les autres pages (src/lib/liveMatches.ts) —
        // Ligue 1 + les 4 championnats bonus, jamais un fetch dédié.
        fetchLiveApiMatches(),
      ]);

      if (requestId !== loadSeqRef.current) return;

      if (competitionsError) throw competitionsError;
      if (bonusOptionsError) throw bonusOptionsError;
      if (profileError) throw profileError;
      if (predictionError) throw predictionError;
      if (teamsError) throw teamsError;

      const competitionId = (competitionsData ?? []).find(
        (c: any) => c.external_code === "FL1" || c.code === "FL1"
      )?.id;

      const ligue1Matchdays = (matchdaysData ?? []).filter(
        (md: any) => md.competition_id === competitionId
      );

      const matchesById = new Map<string, any>();
      const matchesByMatchday = new Map<string, any[]>();
      (matchesData ?? []).forEach((match: any) => {
        matchesById.set(String(match.id), match);
        if ((match.match_type ?? "LIGUE1") !== "LIGUE1" || !match.matchday_id) return;
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

      // Supabase reste la source du calendrier. Pour le direct, la fusion
      // (statut/score + garde anti-régression + cache sessionStorage) passe
      // EXCLUSIVEMENT par src/lib/liveMatches.ts — même fonction que
      // Classement/Accueil/Profil/Stats/Pronostics, plus de fetch ni de
      // fusion dédiés à la Gazette.
      const normalized: Journee[] = ligue1Matchdays
        .map((matchday: any) => ({
          id: matchday.id,
          number: matchday.number,
          title: `J${matchday.number}`,
          matches: reconcileMatchesWithLive(matchesByMatchday.get(matchday.id) ?? [], apiLiveMatches),
          bonus: reconcileMatchesWithLive(bonusMatchesByMatchday.get(matchday.id) ?? [], apiLiveMatches),
        }))
        .sort((a, b) => Number(a.number) - Number(b.number));

      const loadedProfiles = (profileData ?? []) as Profile[];
      const predictionMap = new Map<string, PlayerPronos>();

      loadedProfiles.forEach((profile: any) => {
        predictionMap.set(profile.id, {
          favoriteTeam: getFavoriteTeamValue(profile.favorite_team ?? profile.favorite_team_id ?? null),
          byMatch: new Map(),
        });
      });

      (predictionData ?? []).forEach((prediction: any) => {
        const entry = predictionMap.get(prediction?.user_id);
        if (!entry || !prediction?.match_id) return;
        entry.byMatch.set(String(prediction.match_id), prediction);
      });

      const rankingPredictionRows = (predictionData ?? []) as LeaguePrediction[];

      const rankingBonusRows: LeagueBonusOption[] = (bonusOptionsData ?? []).map(
        (row: any) => ({
          matchday_id: String(row.matchday_id),
          match_id: String(row.match_id),
        }),
      );

      const favoriteHistoryMap: Record<string, string | undefined> = {};
      (favoriteHistoryData ?? []).forEach((row: any) => {
        if (!row?.user_id || !row?.season_id || !row?.favorite_team_id) return;
        favoriteHistoryMap[`${row.user_id}:${row.season_id}`] = row.favorite_team_id;
      });

      const teamNames: Record<string, string | undefined> = {};
      (matchesData ?? []).forEach((match: any) => {
        if (match?.home_team_id && match?.home_team) {
          teamNames[String(match.home_team_id)] = match.home_team;
        }
        if (match?.away_team_id && match?.away_team) {
          teamNames[String(match.away_team_id)] = match.away_team;
        }
      });

      setRankingPredictions(rankingPredictionRows);
      setRankingBonusOptions(rankingBonusRows);
      setRankingFavoriteHistory(favoriteHistoryMap);
      setRankingTeamNames(teamNames);

      setJournees(normalized);
      setProfiles(loadedProfiles);
      setPredictionsByUser(predictionMap);
      setTeams((teamsData ?? []) as GazetteTeam[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Gazette load error", err);
      setError("Données momentanément indisponibles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Même cadence que les autres pages (15s) — un compromis charge API /
    // fraîcheur live, cf. src/lib/liveMatches.ts.
    const refresh = window.setInterval(() => {
      // Onglet cache : on ne recharge pas. Voir src/lib/ongletVisible.ts.
      if (ongletVisible()) loadData(true);
    }, 15000);
    const ticker = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(ticker);
    };
  }, []);

  const todayKey = useMemo(() => localDateKey(new Date(clock)), [clock]);

  const currentJournee = useMemo(() => {
    if (!journees.length) return null;

    // La journee racontee est choisie par choisirJourneeGazette()
    // (src/lib/journeeGazette.ts) : un jour de match, celle du jour ; les
    // jours creux, la derniere journee deja commencee — la Gazette continue
    // ainsi de raconter le week-end ecoule au lieu d'afficher une page vide
    // du lundi au jeudi. La regle vit dans une fonction pure pour etre
    // verifiable jour par jour (npm run verif-journee-gazette).
    const candidates = journees
      .map((journee) => {
        const all = [...journee.matches, ...journee.bonus];
        const timestamps = all
          .map(getKickoffTimestamp)
          .filter((ts) => Number.isFinite(ts))
          .sort((a, b) => a - b);
        return {
          journee,
          candidate: {
            id: String(journee.id),
            numero: Number(journee.number) || 0,
            premierCoupDEnvoi: timestamps[0] ?? NaN,
            clesDeDate: all.map(localDateKeyFromMatch).filter(Boolean) as string[],
          },
          vide: all.length === 0,
        };
      })
      .filter((x) => !x.vide);

    const choisi = choisirJourneeGazette(
      candidates.map((x) => x.candidate),
      clock,
      todayKey,
    );

    return candidates.find((x) => x.candidate.id === choisi)?.journee ?? journees[0];
  }, [journees, clock, todayKey]);

  // UNIQUEMENT les rencontres dont la date locale correspond à aujourd'hui.
  // La journée peut contenir 10 matchs L1 + les bonus, mais le vendredi,
  // par exemple, on n'affiche que le(s) match(s) du vendredi.
  const todaysMatches = useMemo<DayMatch[]>(() => {
    if (!currentJournee) return [];

    return [
      ...currentJournee.matches.map((match) => ({
        match,
        journee: currentJournee,
        isBonus: false,
      })),
      ...currentJournee.bonus.map((match) => ({
        match,
        journee: currentJournee,
        isBonus: true,
      })),
    ]
      .filter(({ match }) => localDateKeyFromMatch(match) === todayKey)
      .sort((a, b) => getKickoffTimestamp(a.match) - getKickoffTimestamp(b.match));
  }, [currentJournee, todayKey, clock]);

  const liveMatches = useMemo(() => {
    return todaysMatches.filter(({ match }) => getMatchState(match) === "live");
  }, [todaysMatches, clock]);

  const finishedMatches = useMemo(() => {
    return todaysMatches.filter(({ match }) => getMatchState(match) === "finished");
  }, [todaysMatches, clock]);

  // Matchs déjà terminés de toute la journée J1/J2/... :
  // utiles pour l'analyse et le classement, sans les afficher dans "matchs du jour".
  const currentJourneeAllMatches = useMemo<DayMatch[]>(() => {
    if (!currentJournee) return [];
    return [
      ...currentJournee.matches.map((match) => ({ match, journee: currentJournee, isBonus: false })),
      ...currentJournee.bonus.map((match) => ({ match, journee: currentJournee, isBonus: true })),
    ].sort((a, b) => getKickoffTimestamp(a.match) - getKickoffTimestamp(b.match));
  }, [currentJournee]);

  // CE QUE LA SECTION "LE DIRECT" AFFICHE : les matchs DU JOUR, et rien
  // d'autre. Pas la journee entiere (13 resultats deja joues font un mur que
  // personne ne lit), pas le calendrier a venir. Un jour sans match, la
  // section disparait entierement — l'article et le classement suffisent a
  // remplir la page.
  //
  // Aucun calcul ne depend de cette liste : elle ne sert qu'a l'affichage.
  const allCurrentMatches = todaysMatches;

  const journeeFinishedMatches = useMemo(() => {
    return currentJourneeAllMatches.filter(({ match }) => getMatchState(match) === "finished");
  }, [currentJourneeAllMatches, clock]);

  const matchesById = useMemo(() => {
    const map = new Map<string, any>();
    journees.forEach((j) => [...j.matches, ...j.bonus].forEach((m) => map.set(String(m.id), m)));
    return map;
  }, [journees]);

  // Agrégats officiels du moteur, exposés tels quels : le détail par
  // pronostic (pointsByPredictionKey) est LA source des points d'un joueur sur
  // un match donné. La colonne `predictions.points`, elle, n'est jamais écrite
  // par l'application (column_default 0, aucun trigger) — la lire renvoyait
  // systématiquement 0, d'où les "0 point pris sur cette journée" de la
  // Gazette alors que le joueur avait bel et bien marqué.
  const leagueStats = useMemo(() => {
    // `journees[].matches/.bonus` gardent leur statut RÉEL (utilisé pour
    // l'affichage : badges EN DIRECT, minuteur, etc.). Le calcul des points,
    // lui, doit voir un match commencé comme immédiatement scorable — même
    // vue dérivée que Classement/Accueil/Profil/Stats
    // (markLiveMatchesScorable, src/lib/liveMatches.ts), jamais Supabase modifié.
    const ligue1Matches = markLiveMatchesScorable(journees.flatMap((j) => j.matches)) as LeagueMatch[];
    const bonusMatches = markLiveMatchesScorable(journees.flatMap((j) => j.bonus)) as LeagueMatch[];

    return computeLeagueStats(
      ligue1Matches,
      bonusMatches,
      rankingBonusOptions,
      rankingPredictions,
      profiles as LeagueProfile[],
      rankingTeamNames,
      {
        favoriteTeamBySeason: rankingFavoriteHistory,
      },
    );
  }, [
    profiles,
    journees,
    rankingPredictions,
    rankingBonusOptions,
    rankingFavoriteHistory,
    rankingTeamNames,
  ]);

  // Points RÉELS d'un joueur sur un match précis, tels que calculés par le
  // moteur. Remplace partout la lecture de `prono.points` (colonne morte).
  const pointsFor = useMemo(() => {
    const table = leagueStats.pointsByPredictionKey;
    return (userId: string, matchId: string) => table[`${userId}:${matchId}`] ?? 0;
  }, [leagueStats]);

  const rankedPlayers = useMemo(() => {
    const rows = profiles.map((profile) => ({
      id: profile.id,
      name: profile.pseudo || "Joueur",
      avatar: profile.avatar_url || "",
      points: leagueStats.pointsByUser[profile.id] ?? 0,
      exactScores: leagueStats.exactScoresByUser[profile.id] ?? 0,
      predictionsCount: leagueStats.predictionsCountByUser[profile.id] ?? 0,
      regularitySuccess: leagueStats.regularitySuccessByUser[profile.id] ?? 0,
      pseudo: profile.pseudo || "Joueur",
    }));

    return rankPlayers(rows);
  }, [profiles, leagueStats]);

  const leader = rankedPlayers[0] ?? null;
  const second = rankedPlayers[1] ?? null;
  const third = rankedPlayers[2] ?? null;

  const evolution = useMemo(() => {
    if (!rankedPlayers.length) return null;
    const moves = rankedPlayers.map((player) => {
      let pointsToday = 0;
      let exactToday = 0;
      player && predictionsByUser.get(player.id)?.byMatch.forEach((prono, matchId) => {
        const match = matchesById.get(matchId);
        if (
          !match ||
          match.matchday_id !== currentJournee?.id ||
          !isActuallyFinished(match)
        ) return;
        pointsToday += pointsFor(player.id, String(matchId));
        if (isExactPrediction(match, prono)) exactToday += 1;
      });
      return { ...player, pointsToday, exactToday };
    });

    // Rang AVANT la journée = classement recalculé sur les points du joueur
    // moins ceux pris sur cette journée.
    // BUG CORRIGÉ : cette table renvoyait le rang COURANT (recherche de
    // `player.rank` dans rankedPlayers), donc un mouvement toujours nul —
    // elle n'était d'ailleurs consommée nulle part.
    const previousRanks = new Map<string, number>();
    rankPlayers(
      moves.map((player) => ({
        ...player,
        points: player.points - player.pointsToday,
        exactScores: Math.max(0, player.exactScores - player.exactToday),
      })) as any,
    ).forEach((player: any) => previousRanks.set(String(player.id), Number(player.rank)));

    const biggestMover = [...moves].sort((a, b) => b.pointsToday - a.pointsToday || b.exactToday - a.exactToday)[0] ?? null;
    const closestRace = leader && second ? leader.points - second.points : 0;

    return { moves, biggestMover, closestRace, previousRanks };
  }, [rankedPlayers, predictionsByUser, matchesById, currentJournee, profiles, clock, pointsFor]);

  const lastFinished = journeeFinishedMatches[journeeFinishedMatches.length - 1]?.match ?? null;
  const lastFinishedId = String(lastFinished?.id ?? "");

  // ============================================================
  // BLOCS ÉVOLUTIFS DE LA GAZETTE
  // 1. Leader actuel
  // 2. Plus belle progression depuis le dernier match terminé
  // 3. Dernier coup : meilleure performance sur le dernier match
  // ============================================================
  const gazetteDynamicBlocks = useMemo(() => {
    if (!rankedPlayers.length) {
      return {
        leader: null,
        progression: null,
        performance: null,
        bestMatchday: null,
      };
    }

    const previousMatchId = lastFinishedId;

    // Reconstitue le classement juste AVANT le dernier match terminé.
    // On retire uniquement les points/exacts de ce match, sans toucher
    // aux calculs de classement actuels.
    const previousRows = profiles.map((profile) => {
      const player = predictionsByUser.get(profile.id);
      let points = 0;
      let exactScores = 0;
      let predictionsCount = 0;

      player?.byMatch.forEach((prono, matchId) => {
        const match = matchesById.get(matchId);
        if (!match || !isActuallyFinished(match)) return;
        if (previousMatchId && String(matchId) === previousMatchId) return;

        points += pointsFor(profile.id, String(matchId));
        predictionsCount += 1;
        if (isExactPrediction(match, prono)) exactScores += 1;
      });

      return {
        id: profile.id,
        name: profile.pseudo || "Joueur",
        avatar: profile.avatar_url || "",
        points,
        exactScores,
        predictionsCount,
        regularitySuccess: 0,
        pseudo: profile.pseudo || "Joueur",
      };
    });

    const previousRanked = rankPlayers(previousRows);
    const previousRankById = new Map(
      previousRanked.map((player) => [player.id, player.rank]),
    );

    // Plus belle progression : on compare le rang avant/après le dernier match.
    const movers = rankedPlayers
      .map((player) => ({
        ...player,
        previousRank: previousRankById.get(player.id) ?? player.rank,
        movement:
          (previousRankById.get(player.id) ?? player.rank) - player.rank,
      }))
      .filter((player) => player.movement > 0)
      .sort(
        (a, b) =>
          b.movement - a.movement ||
          b.points - a.points ||
          b.exactScores - a.exactScores,
      );

    const progression = movers[0] ?? null;

    // MEILLEURE JOURNEE : plus gros total de points realise par un joueur
    // sur une seule journee, depuis le debut de la saison. On additionne des
    // points deja calcules (pointsFor) : aucun bareme n'est recalcule ici.
    const dayTotals: {
      name: string;
      avatar: string;
      points: number;
      journeeNumber: number | string;
    }[] = [];

    journees.forEach((journee) => {
      const dayMatchIds = [...journee.matches, ...journee.bonus]
        .filter((match) => isActuallyFinished(match))
        .map((match) => String(match.id));
      if (dayMatchIds.length === 0) return;

      profiles.forEach((profile) => {
        const total = dayMatchIds.reduce(
          (sum, matchId) => sum + pointsFor(profile.id, matchId),
          0,
        );
        if (total <= 0) return;
        dayTotals.push({
          name: profile.pseudo || "Joueur",
          avatar: profile.avatar_url || "",
          points: total,
          journeeNumber: journee.number,
        });
      });
    });

    // A egalite de points, on met en avant la journee la plus recente.
    const bestMatchday =
      dayTotals.sort(
        (a, b) =>
          b.points - a.points ||
          Number(b.journeeNumber) - Number(a.journeeNumber),
      )[0] ?? null;

    // Dernier coup : on cherche le meilleur prono sur le dernier match.
    let performance: any = null;

    if (lastFinished) {
      const candidates = profiles
        .map((profile) => {
          const player = predictionsByUser.get(profile.id);
          const prono = previousMatchId
            ? player?.byMatch.get(previousMatchId)
            : null;

          if (!prono) return null;

          const points = pointsFor(profile.id, String(previousMatchId));
          const exact = isExactPrediction(lastFinished, prono);

          return {
            player,
            profile,
            prono,
            points,
            exact,
          };
        })
        .filter(Boolean)
        .filter((item: any) => item.points > 0)
        .sort(
          (a: any, b: any) =>
            Number(b.exact) - Number(a.exact) ||
            b.points - a.points,
        );

      performance = candidates[0] ?? null;
    }

    return {
      leader: rankedPlayers[0] ?? null,
      progression,
      performance,
      bestMatchday,
    };
  }, [
    rankedPlayers,
    profiles,
    journees,
    predictionsByUser,
    matchesById,
    lastFinished,
    lastFinishedId,
    pointsFor,
  ]);


  // Bilan chiffré de la journée en cours, calculé une seule fois sur les
  // points RÉELS du moteur (pointsFor) : l'article et le bloc "LE CHIFFRE"
  // s'appuient dessus tous les deux, donc ils ne peuvent plus se contredire.
  const journeeBilan = useMemo(() => {
    const parMatch = journeeFinishedMatches.map(({ match }) => {
      let gagnants = 0;
      let parieurs = 0;
      let points = 0;
      profiles.forEach((profile) => {
        // Un match que personne n'a joué n'est pas un match "raté" : sans ce
        // compteur, il passerait pour le piège de la journée.
        if (!predictionsByUser.get(profile.id)?.byMatch.get(String(match.id))) return;
        parieurs += 1;
        const gagnes = pointsFor(profile.id, String(match.id));
        points += gagnes;
        if (gagnes > 0) gagnants += 1;
      });
      return { match, gagnants, parieurs, points };
    });

    return {
      parMatch,
      parieurs: parMatch.reduce((sum, entry) => sum + entry.parieurs, 0),
      gagnants: parMatch.reduce((sum, entry) => sum + entry.gagnants, 0),
      points: parMatch.reduce((sum, entry) => sum + entry.points, 0),
    };
  }, [journeeFinishedMatches, profiles, predictionsByUser, pointsFor]);

  const analysis = useMemo(() => {
    if (!currentJournee) {
      return {
        kicker: "GAZETTE LIVE",
        title: "La journée va bientôt commencer",
        intro: "Les premiers résultats feront progressivement apparaître la hiérarchie de votre compétition.",
        paragraphs: ["La Gazette suivra chaque rencontre et actualisera l'analyse dès qu'un nouveau résultat sera disponible."],
      };
    }

    const done = journeeFinishedMatches.length;
    const total = currentJourneeAllMatches.length;
    const live = liveMatches.length;
    const hash = lastFinishedId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variant = hash % 4;
    const mover = evolution?.biggestMover;
    const moverName = mover?.name ?? leader?.name ?? "Le leader";
    const gap = evolution?.closestRace ?? 0;

    // ------------------------------------------------------------------
    // BLOCS PARTAGÉS par les trois branches (direct / avant match / en cours).
    // Auparavant chaque branche réécrivait ses propres phrases, avec les mêmes
    // defauts recopiés : `gap` présenté comme un total, aucun accord en nombre,
    // et un "profite le plus des résultats" affirmé même pour un joueur à zéro.
    // ------------------------------------------------------------------
    const exAequo = Boolean(leader && second && gap === 0);

    // `gap` est un ÉCART, jamais un total.
    const hierarchie = !leader
      ? "Les premiers points de la journée sont désormais enregistrés."
      : !second
        ? `${leader.name} ouvre le compteur avec ${accord(leader.points, "point")} et reste pour l'instant seul en piste.`
        : exAequo
          ? `${leader.name} et ${second.name} se tiennent à hauteur, ${accord(leader.points, "point")} chacun : rien ne les sépare à ce stade.${third ? ` ${third.name} complète le podium.` : ""}`
          : gap === 1
            ? `${leader.name} mène avec ${accord(leader.points, "point")}, mais ${second.name} n'est qu'à une longueur et attend le moindre faux pas.${third ? ` ${third.name} complète le podium.` : ""}`
            : `${leader.name} mène avec ${accord(leader.points, "point")} et compte ${accord(gap, "longueur")} d'avance sur ${second.name}.${third ? ` ${third.name} complète le podium.` : ""}`;

    // ANGLE — mouvement au classement depuis le début de la journée.
    const grimpeur = (evolution?.moves ?? [])
      .map((player: any) => ({
        ...player,
        gain: (evolution?.previousRanks.get(String(player.id)) ?? player.rank) - player.rank,
      }))
      .filter((player: any) => player.gain > 0)
      .sort((a: any, b: any) => b.gain - a.gain || b.pointsToday - a.pointsToday)[0] ?? null;

    // Le meilleur marqueur du jour est souvent aussi celui qui remonte le
    // plus : deux paragraphes consécutifs sur le même joueur se liraient comme
    // une redite. On fusionne, et l'angle "remontée" laisse alors sa place.
    const memeJoueur = Boolean(grimpeur && mover && String(grimpeur.id) === String(mover.id));
    const places = (n: number) => (n > 1 ? `${n} places` : "une place");

    // Un joueur à 0 point pris n'a "profité" de rien.
    const operation = !mover || mover.pointsToday <= 0
      ? "Aucun joueur n'a encore creusé l'écart sur cette journée : les compteurs restent groupés."
      : `${mover.name} signe la meilleure opération du moment, avec ${accord(mover.pointsToday, "point")} pris sur les rencontres déjà jouées${mover.exactToday > 0 ? `, dont ${accord(mover.exactToday, "score exact", "scores exacts")}` : ""}${memeJoueur && grimpeur ? ` — ${places(grimpeur.gain)} gagnée${grimpeur.gain > 1 ? "s" : ""} au classement, ${grimpeur.rank}e désormais` : ""}.`;

    const mouvement = grimpeur && !memeJoueur
      ? `${grimpeur.name} réalise la plus belle remontée : ${places(grimpeur.gain)} gagnée${grimpeur.gain > 1 ? "s" : ""} depuis le coup d'envoi de la journée, ${grimpeur.rank}e désormais.`
      : null;

    // ANGLE — le match qui a piégé tout le monde, ou celui que personne
    // n'a manqué. Compté sur les points RÉELS du moteur.
    const parMatch = journeeBilan.parMatch;

    const affiche = (match: any) =>
      `${shortTeam(getTeamHome(match))}–${shortTeam(getTeamAway(match))} (${getScoreHome(match)}–${getScoreAway(match)})`;

    // Piège : au moins deux joueurs ont tenté, aucun n'a marqué.
    const piege = parMatch.find((entry) => entry.parieurs >= 2 && entry.gagnants === 0) ?? null;
    // Évidence : la quasi-totalité de ceux qui ont joué le match ont marqué.
    const evidence = [...parMatch]
      .filter((entry) => entry.parieurs >= 3 && entry.gagnants >= Math.ceil(entry.parieurs * 0.8))
      .sort((a, b) => b.parieurs - a.parieurs)[0] ?? null;

    const surprise = piege
      ? `${affiche(piege.match)} restera le piège de la journée : sur ${accord(piege.parieurs, "joueur")} à avoir tenté le coup, pas un n'a pris le moindre point.`
      : evidence
        ? `Personne ou presque ne s'est trompé sur ${affiche(evidence.match)} : ${evidence.gagnants} joueurs sur ${evidence.parieurs} y ont marqué.`
        : null;

    if (live > 0) {
      const liveMatch = liveMatches[0].match;
      const home = shortTeam(getTeamHome(liveMatch));
      const away = shortTeam(getTeamAway(liveMatch));
      const homeScore = Number(getScoreHome(liveMatch) ?? 0);
      const awayScore = Number(getScoreAway(liveMatch) ?? 0);
      const minute = getDisplayedLiveMinute(liveMatch, clock);
      const diff = homeScore - awayScore;
      const totalGoals = homeScore + awayScore;
      const status = String(
        liveMatch?.live_status ??
        liveMatch?.status ??
        liveMatch?.fixture?.status?.short ??
        "",
      ).toUpperCase();

      let liveTitle = "";
      let liveIntro = "";

      // Le texte éditorial s'adapte au score réel : pas de "bataille continue"
      // lorsque l'une des équipes mène largement.
      if (["PAUSED", "HT", "HALFTIME"].includes(status)) {
        if (diff >= 2) {
          liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${home} a fait le break`;
          liveIntro = `À la pause, ${home} a pris une vraie option. ${away} devra réagir pour relancer la rencontre.`;
        } else if (diff === 1) {
          liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${home} prend l'avantage`;
          liveIntro = `À la pause, ${home} mène d'une courte tête. La seconde période peut encore tout changer.`;
        } else if (diff === -1) {
          liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${away} prend les commandes`;
          liveIntro = `À la pause, ${away} mène d'un but. ${home} devra réagir au retour des vestiaires.`;
        } else if (totalGoals >= 2) {
          liveTitle = `${home} ${homeScore}–${awayScore} ${away} : un match déjà animé`;
          liveIntro = `À la pause, les deux équipes ont déjà fait trembler les filets. La seconde période promet encore du mouvement.`;
        } else {
          liveTitle = `${home} ${homeScore}–${awayScore} ${away} : tout reste à faire`;
          liveIntro = `À la pause, rien n'est joué. Le prochain but peut complètement faire basculer la rencontre.`;
        }
      } else if (diff >= 3) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${home} déroule`;
        liveIntro = `${minute} et ${home} a pris une avance très nette. Sauf retournement, la tendance est clairement en faveur des locaux.`;
      } else if (diff === 2) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${home} fait le break`;
        liveIntro = `${minute} et ${home} compte deux buts d'avance. ${away} doit désormais réagir pour revenir dans le match.`;
      } else if (diff === 1) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${home} prend l'avantage`;
        liveIntro = `${minute} et ${home} mène d'un but. ${away} reste à portée, mais le prochain événement peut peser lourd sur les points de la compétition.`;
      } else if (diff === -1) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : ${away} prend les commandes`;
        liveIntro = `${minute} et ${away} mène d'un but. ${home} doit réagir pour inverser la tendance.`;
      } else if (totalGoals >= 3) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : un scénario débridé`;
        liveIntro = `${minute} et les buts s'enchaînent. Le résultat reste impossible à figer tant que le coup de sifflet final n'est pas donné.`;
      } else if (totalGoals >= 1) {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : le match s'anime`;
        liveIntro = `${minute} et un but a déjà fait évoluer la rencontre. Chaque nouvelle action peut encore modifier les points de vos joueurs.`;
      } else {
        liveTitle = `${home} ${homeScore}–${awayScore} ${away} : tout reste à faire`;
        liveIntro = `${minute} et les deux équipes sont toujours à égalité. Un seul but peut faire basculer le match et la hiérarchie de la compétition.`;
      }

      const endGame =
        minute === "90+'"
          ? `À ${minute}, le résultat se joue dans les derniers instants : chaque but peut encore changer les points.`
          : null;

      return {
        kicker: "ANALYSE EN DIRECT",
        title: liveTitle,
        intro: endGame ?? liveIntro,
        paragraphs: [
          done > 0
            ? `${accord(done, "match")} ${done > 1 ? "sont" : "est"} déjà ${done > 1 ? "terminés" : "terminé"} sur cette ${currentJournee.title} : la hiérarchie se construit en temps réel.`
            : `Aucune rencontre n'est encore allée à son terme sur cette ${currentJournee.title} : tout se joue en direct.`,
          // Mêmes blocs que les autres branches — l'ancienne version répétait
          // ici le bug de l'écart lu comme un total ("${second.name} suit à
          // 0 point" pour une égalité) et affirmait qu'un joueur "profite le
          // plus des résultats" même sans un seul point pris.
          hierarchie,
          ...([operation, mouvement, surprise].filter(Boolean) as string[]).slice(0, 1),
        ],
      };
    }

    if (!done) {
      return {
        kicker: "AVANT LE COUP D'ENVOI",
        title: `${currentJournee.title} : la course va commencer`,
        intro: "Aucun résultat n'est encore figé. Les premiers matchs vont donner le ton de la journée.",
        paragraphs: [
          // "1 rencontre sont programmée" : l'accord du verbe manquait.
          `${accord(total, "rencontre")} ${total > 1 ? "sont programmées" : "est programmée"}. Les pronostics sont en place et la première évolution du classement apparaîtra dès le premier score officiel.`,
          "La Gazette suivra ensuite les changements de points, les scores exacts et les mouvements du podium sans attendre la fin de la journée.",
        ],
      };
    }

    const lastHome = shortTeam(getTeamHome(lastFinished));
    const lastAway = shortTeam(getTeamAway(lastFinished));
    const lastScore = `${getScoreHome(lastFinished)}–${getScoreAway(lastFinished)}`;
    const lastResult = getResult1N2(getScoreHome(lastFinished), getScoreAway(lastFinished));
    const resultText = lastResult === "1" ? `${lastHome} s'impose` : lastResult === "2" ? `${lastAway} s'impose` : "les deux équipes se quittent sur un nul";

    const variants = [
      `${resultText} (${lastScore}) et le résultat vient de remettre le classement de la compétition en mouvement.`,
      `Le dernier coup de sifflet a encore déplacé les lignes : ${lastHome}–${lastAway} (${lastScore}) devient le nouveau point de référence de la journée.`,
      `Après ${lastHome}–${lastAway}, conclu ${lastScore}, les écarts commencent à prendre une vraie signification dans la bataille entre vos pronostiqueurs.`,
      `Le résultat ${lastHome}–${lastAway} (${lastScore}) ajoute un nouvel épisode à la course au classement. Les prochains matchs peuvent encore tout changer.`,
    ];

    // Perimetre JOURNEE, comme le reste de l'article (kicker "7/12 matchs",
    // mover.exactToday...). Auparavant base sur `finishedMatches`, qui ne
    // couvre que les matchs DU JOUR : l'article pouvait annoncer "2 scores
    // exacts" pour le meilleur joueur puis "aucun score exact" deux lignes
    // plus bas.
    const exactCount = journeeFinishedMatches.reduce((sum, { match }) => {
      let count = 0;
      profiles.forEach((profile) => {
        const prono = predictionsByUser.get(profile.id)?.byMatch.get(String(match.id));
        if (isExactPrediction(match, prono)) count += 1;
      });
      return sum + count;
    }, 0);

    // TITRE — "garde la main" est faux quand deux joueurs sont a egalite.
    const titre = !leader
      ? "La hiérarchie commence à se dessiner"
      : exAequo
        ? `${leader.name} et ${second!.name} ne se lâchent plus`
        : [
            `${leader.name} garde la main, mais la journée n'a pas livré son dernier mot`,
            `${leader.name} tient la corde, la journée reste ouverte`,
            `${leader.name} passe devant, sans avoir encore fait le trou`,
          ][variant % 3];

    // SCORES EXACTS — meme perimetre (journee) que le reste de l'article.
    const exacts = exactCount > 0
      ? `${accord(exactCount, "score exact", "scores exacts")} ${exactCount > 1 ? "ont" : "a"} déjà été ${exactCount > 1 ? "trouvés" : "trouvé"} sur les rencontres terminées. C'est précisément là que se décident les fins de saison, quand deux joueurs arrivent au même total.`
      : "Aucun score exact n'est encore tombé sur les rencontres terminées. Le premier à en signer un prendra une avance que les autres mettront du temps à combler.";

    // Le corps de l'article : la hiérarchie ouvre, les scores exacts ferment,
    // et entre les deux on retient les deux angles les plus parlants du moment
    // (meilleure opération, remontée au classement, match piège ou évidence)
    // au lieu de servir toujours les trois mêmes phrases.
    const angles = [operation, mouvement, surprise].filter(Boolean) as string[];

    // BILAN DE LA JOURNEE — tous les matchs sont joues et plus rien n'est en
    // direct. C'est l'article que lisent les joueurs entre deux journees,
    // souvent du lundi au jeudi. Les phrases par defaut ouvrent sur une suite
    // ("la journee n'a pas livre son dernier mot", "les prochains matchs
    // peuvent encore tout changer") : elles sonnent faux une fois tout joue.
    // Cette branche referme la journee et met en avant l'evolution des
    // joueurs. Aucun chiffre n'est recalcule : ce sont les memes blocs.
    const journeeTerminee = total > 0 && done === total && live === 0;

    if (journeeTerminee) {
      const titreBilan = !leader
        ? `${currentJournee.title} : la journée est terminée`
        : exAequo
          ? `${leader.name} et ${second!.name} terminent la ${currentJournee.title} à égalité`
          : `${leader.name} termine la ${currentJournee.title} en tête`;

      return {
        kicker: `${currentJournee.title} · BILAN`,
        title: titreBilan,
        intro: `${accord(total, "match")} ${total > 1 ? "joués" : "joué"}, la ${currentJournee.title} est close. ${resultText.charAt(0).toUpperCase()}${resultText.slice(1)} (${lastScore}) pour refermer la journée.`,
        paragraphs: [
          hierarchie,
          // L'evolution des joueurs passe avant le reste : c'est ce qu'on
          // vient lire quand la journee est finie.
          ...([mouvement, operation, surprise].filter(Boolean) as string[]).slice(0, 2),
          exacts,
        ],
      };
    }

    return {
      kicker: `${currentJournee.title} · ${done}/${total} MATCH${total > 1 ? "S" : ""}`,
      title: titre,
      intro: variants[variant],
      paragraphs: [hierarchie, ...angles.slice(0, 2), exacts],
    };
  }, [currentJournee, journeeFinishedMatches, currentJourneeAllMatches.length, liveMatches, evolution, leader, second, third, lastFinishedId, profiles, predictionsByUser, clock, pointsFor, journeeBilan]);

  // LE CHIFFRE — un seul indicateur à la fois, mais un indicateur qui dit
  // quelque chose. L'ancienne rotation servait quatre totaux bruts, dont
  // "points actuellement distribués" : un cumul qui ne renseigne ni sur le
  // suspense, ni sur la performance, ni sur ce qu'il reste à jouer. Chaque
  // chiffre porte désormais sa propre légende, et un indicateur sans objet
  // (aucun score exact, aucun match restant...) n'est tout simplement pas
  // proposé.
  const dynamicStat = useMemo(() => {
    const finished = journeeFinishedMatches.length;
    const total = currentJourneeAllMatches.length;
    const restants = Math.max(0, total - finished);
    const moves = evolution?.moves ?? [];
    const exactsJournee = moves.reduce((sum, player) => sum + player.exactToday, 0);
    const meilleur = [...moves].sort((a, b) => b.pointsToday - a.pointsToday)[0] ?? null;
    const dernier = rankedPlayers.length > 2 ? rankedPlayers[rankedPlayers.length - 1] : null;
    const ecartTete = leader && second ? leader.points - second.points : null;
    const amplitude = leader && dernier ? leader.points - dernier.points : null;
    const reussite =
      journeeBilan.parieurs > 0
        ? Math.round((journeeBilan.gagnants / journeeBilan.parieurs) * 100)
        : null;

    type Chiffre = { value: string | number; label: string; note: string };
    const candidats: Chiffre[] = [];

    // Le suspense en tête, la seule chose que tout le monde regarde.
    // Sans point marqué, tout le monde est à égalité : annoncer un duel de
    // tête n'aurait alors aucun sens.
    if (leader && second && leader.points === 0) {
      // rien à dire sur la tête du classement pour l'instant
    } else if (leader && second && ecartTete === 0) {
      candidats.push({
        value: "=",
        label: `${leader.name} et ${second.name} à égalité en tête`,
        note: "Le prochain point marqué suffira à les départager.",
      });
    } else if (leader && second && ecartTete !== null && ecartTete > 0) {
      candidats.push({
        value: ecartTete,
        label: `${ecartTete > 1 ? "points" : "point"} d'écart entre ${leader.name} et ${second.name}`,
        note: "C'est tout ce qui sépare la première place de la deuxième.",
      });
    }

    // Le taux de réussite dit si la journée est piégeuse ou évidente.
    if (reussite !== null) {
      candidats.push({
        value: `${reussite}%`,
        label: "des pronostics joués ont rapporté des points",
        note: `${journeeBilan.gagnants} pronostics gagnants sur ${journeeBilan.parieurs} joués sur les matchs terminés.`,
      });
    }

    // La meilleure performance individuelle du jour.
    if (meilleur && meilleur.pointsToday > 0) {
      candidats.push({
        value: meilleur.pointsToday,
        label: `${meilleur.pointsToday > 1 ? "points pris" : "point pris"} par ${meilleur.name} sur cette journée`,
        note: "Meilleur total du jour, tous joueurs confondus.",
      });
    }

    if (exactsJournee > 0) {
      candidats.push({
        value: exactsJournee,
        label: `${exactsJournee > 1 ? "scores exacts trouvés" : "score exact trouvé"} sur la journée`,
        note: "Le coup le plus difficile à réussir, et le mieux payé.",
      });
    }

    if (restants > 0) {
      candidats.push({
        value: restants,
        label: `${restants > 1 ? "rencontres restent" : "rencontre reste"} à jouer`,
        note: "Tant qu'elles ne sont pas jouées, le classement peut encore basculer.",
      });
    }

    // L'amplitude du classement : l'écart réel entre le haut et le bas.
    if (amplitude !== null && amplitude > 0) {
      candidats.push({
        value: amplitude,
        label: `${amplitude > 1 ? "points" : "point"} entre le premier et le dernier`,
        note: "L'amplitude du classement, tout en haut contre tout en bas.",
      });
    }

    if (!candidats.length) {
      return {
        value: total,
        label: `${total > 1 ? "rencontres au programme" : "rencontre au programme"} de la journée`,
        note: "Les chiffres s'animeront dès le premier coup de sifflet.",
      };
    }

    return candidats[Math.floor(clock / 12000) % candidats.length];
  }, [
    journeeFinishedMatches.length,
    currentJourneeAllMatches.length,
    rankedPlayers,
    evolution,
    leader,
    second,
    journeeBilan,
    clock,
  ]);

  // Classement Ligue 1 RÉEL, chargé via le proxy football-data.org déjà en
  // place pour les championnats bonus (api/standings.ts, token côté serveur).
  // Sert à juger l'affiche d'une journée sur la position des deux équipes.
  const [ligue1Standings, setLigue1Standings] = useState<CompetitionStandings | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Année football-data.org : une saison européenne bascule en juillet
    // (2026-2027 -> "2026"). standingsService retombe seul sur la saison
    // précédente tant que celle en cours compte trop peu de journées jouées.
    const now = new Date();
    const seasonYear = String(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

    getLigue1Standings(seasonYear)
      .then((standings) => {
        if (!cancelled) setLigue1Standings(standings);
      })
      .catch(() => {
        // Classement indisponible : la Gazette dégrade sur la seule
        // réputation, sans jamais bloquer l'affichage.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const standingsLookup = useMemo<StandingsLookup | null>(() => {
    if (!ligue1Standings || ligue1Standings.source === "unavailable" || ligue1Standings.totalTeams < 2) {
      return null;
    }
    return {
      totalTeams: ligue1Standings.totalTeams,
      positionOf: (teamName: unknown) =>
        ligue1Standings.entriesByTeam.get(normalizeTeamName(teamName))?.position ?? null,
    };
  }, [ligue1Standings]);

  // L'AFFICHE DE LA JOURNÉE.
  // BUG CORRIGÉ : le prestige reposait sur
  // /psg|paris|marseille|om|lyon|ol|monaco|lille|lens/, avec deux defauts.
  // "paris" capturait le PARIS FC aussi bien que le PSG — d'où un
  // ESTAC–Paris FC promu affiche du week-end. Et le score binaire 0/20
  // donnait le même poids à un match comptant un seul gros club qu'à une
  // vraie affiche entre deux cadors. On passe par getOfficialClubId(), qui
  // distingue déjà `psg` de `parisfc`, et par une cote de notoriété graduée
  // où le côté le plus faible compte double (voir src/lib/clubReputation.ts).
  const weekendMatch = useMemo(() => {
    if (!currentJourneeAllMatches.length) return null;

    const notes = currentJourneeAllMatches.map((item) => {
      let predictions = 0;
      profiles.forEach((profile) => {
        if (predictionsByUser.get(profile.id)?.byMatch.has(String(item.match.id))) predictions += 1;
      });
      return {
        ...item,
        predictions,
        kickoff: getKickoffTimestamp(item.match),
        appeal: matchAppeal(getTeamHome(item.match), getTeamAway(item.match), standingsLookup),
        joue: getMatchState(item.match) === "finished",
      };
    });

    const classer = (a: typeof notes[number], b: typeof notes[number]) =>
      b.appeal - a.appeal || b.predictions - a.predictions || a.kickoff - b.kickoff;

    // "Le rendez-vous à suivre" : une rencontre déjà jouée n'est plus un
    // rendez-vous. On privilégie donc ce qui reste à voir, et on ne retombe
    // sur les matchs terminés que si la journée est bouclée.
    const aVenir = notes.filter((item) => !item.joue).sort(classer);
    return aVenir[0] ?? [...notes].sort(classer)[0] ?? null;
  }, [currentJourneeAllMatches, profiles, predictionsByUser, clock, standingsLookup]);

  const bigPerformance = useMemo(() => {
    if (!journeeFinishedMatches.length) return null;
    const candidates: any[] = [];
    journeeFinishedMatches.forEach(({ match }) => {
      profiles.forEach((profile) => {
        const prono = predictionsByUser.get(profile.id)?.byMatch.get(String(match.id));
        const gained = pointsFor(profile.id, String(match.id));
        if (!prono || gained <= 0) return;
        candidates.push({
          player: rankedPlayers.find((p) => p.id === profile.id) ?? { name: profile.pseudo || "Joueur", avatar: profile.avatar_url || "" },
          match,
          points: gained,
          exact: isExactPrediction(match, prono),
        });
      });
    });
    return candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || b.points - a.points)[0] ?? null;
  }, [journeeFinishedMatches, profiles, predictionsByUser, rankedPlayers, pointsFor]);

  const matchStatusLabel = (match: any) => {
    const state = getMatchState(match);
    if (state === "live") return getDisplayedLiveMinute(match, clock);
    if (state === "finished" || hasScore(match)) return "TERMINÉ";
    const kickoff = getKickoffTimestamp(match);
    if (Number.isFinite(kickoff)) {
      return new Date(kickoff).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return "À VENIR";
  };

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-28 pt-6">
          <SkeletonBlock className="h-32 w-full rounded-[28px]" />
          <SkeletonBlock className="h-72 w-full rounded-[28px]" />
          <div className="grid gap-4 md:grid-cols-2"><SkeletonBlock className="h-44 rounded-2xl" /><SkeletonBlock className="h-44 rounded-2xl" /></div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <section className="mx-auto max-w-4xl px-4 pb-28 pt-10">
          <div className="rounded-[28px] border border-red-400/20 bg-[#08111d]/95 p-10 text-center">
            <Newspaper className="mx-auto size-10 text-red-300" />
            <h1 className="mt-4 font-display text-2xl font-black text-white">Gazette indisponible</h1>
            <p className="mt-2 text-sm text-slate-400">Les données de la compétition n'ont pas pu être chargées.</p>
            <button onClick={() => loadData()} className="mt-5 rounded-xl bg-emerald-300 px-5 py-3 font-display text-sm font-black text-slate-950">RÉESSAYER</button>
          </div>
        </section>
      </AppShell>
    );
  }

  const liveCount = liveMatches.length;
  const totalMatches = allCurrentMatches.length;
  const finishedCount = finishedMatches.length;

  return (
    <AppShell>
      <div className="relative z-10 mx-auto max-w-[1320px] px-3 pb-28 md:px-6 md:pb-20">
        <article className="overflow-hidden rounded-[30px] border border-slate-800/90 bg-[#07101c]/96 shadow-[0_30px_100px_rgba(0,0,0,.45)]">

          {/* ============================================================
              1 — L'OURS : le titre, la date, et ce qui se joue MAINTENANT
              ============================================================
              L'entete accumulait quatre pastilles techniques de meme poids —
              journee, compte des matchs, LIVE, heure de mise a jour — dont
              aucune ne ressortait. Il n'en reste qu'une qui compte vraiment,
              le direct ; le reste redescend au rang de legende. */}
          <header className="relative overflow-hidden border-b border-slate-800 px-5 py-7 md:px-10 md:py-9">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-emerald-500/[0.07] blur-3xl"
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <span className="font-mono text-[10px] font-black uppercase tracking-[.3em] text-emerald-300">
                  Gazette live
                </span>
                <h1 className="mt-1.5 font-display text-[3.25rem] font-black uppercase leading-[.82] tracking-[-.05em] text-white md:text-[4.5rem] lg:text-[5.5rem]">
                  La Gazette
                </h1>
                <p className="mt-3.5 font-mono text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">
                  <span className="capitalize">
                    {new Date(clock).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  {currentJournee?.title ? <span className="text-slate-600"> · {currentJournee.title}</span> : null}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {liveCount > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/15 px-3.5 py-2 font-mono text-[10px] font-black uppercase tracking-[.14em] text-red-300">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative size-2 rounded-full bg-red-400" />
                    </span>
                    {liveCount} match{liveCount > 1 ? "s" : ""} en direct
                  </span>
                )}
                <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-600">
                  MAJ {lastUpdated?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) ?? "—"}
                </span>
              </div>
            </div>
          </header>

          {/* Le direct, tout de suite apres le titre — c'est la seule chose
              qui merite de passer avant l'analyse. */}
          {liveMatches.length > 0 && (
            <section className="border-b border-red-400/20 bg-gradient-to-r from-red-500/[.10] via-slate-950/70 to-emerald-500/[.05] px-5 py-4 md:px-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-red-400 px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[.12em] text-slate-950">
                  En direct
                </span>
                {liveMatches.map(({ match }) => (
                  <div
                    key={String(match.id)}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 font-display text-sm font-black text-white">
                      <GazetteTeamLogo teams={teams} match={match} side="home" size="size-7" />
                      {shortTeam(getTeamHome(match))} {getScoreHome(match) ?? 0}–{getScoreAway(match) ?? 0}{" "}
                      {shortTeam(getTeamAway(match))}
                      <GazetteTeamLogo teams={teams} match={match} side="away" size="size-7" />
                    </span>
                    <span className="font-mono text-[10px] font-black text-red-300">
                      {getDisplayedLiveMinute(match, clock)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ============================================================
              2 — L'ANALYSE
              ============================================================
              Le texte complet s'etalait d'emblee : quatre a cinq paragraphes
              avant d'atteindre quoi que ce soit d'autre. Le chapeau et le
              premier paragraphe restent visibles, la suite se deplie. Le
              contenu, lui, est exactement celui que produit `analysis`. */}
          <section className="border-b border-slate-800 px-5 py-9 md:px-10 md:py-12">
            <div className="flex items-center gap-3">
              <Flame className="size-4 shrink-0 text-emerald-300" />
              <span className="font-mono text-[9px] font-black uppercase tracking-[.22em] text-emerald-300">
                {analysis.kicker}
              </span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            <h2 className="mt-5 max-w-4xl font-display text-[1.75rem] font-black uppercase leading-[.95] tracking-[-.035em] text-white md:text-[3.25rem]">
              {analysis.title}
            </h2>

            <p className="mt-5 max-w-3xl border-l-2 border-emerald-300 pl-4 font-display text-base font-bold leading-7 text-slate-200 md:text-lg md:leading-8">
              {analysis.intro}
            </p>

            {analysis.paragraphs.length > 0 && (
              <div className="mt-7 max-w-3xl space-y-5 text-[14px] leading-7 text-slate-400 md:text-[15px] md:leading-8">
                {(analyseDepliee ? analysis.paragraphs : analysis.paragraphs.slice(0, 1)).map((paragraph, index) => (
                  <p key={`${lastFinishedId}-${index}`}>{paragraph}</p>
                ))}
              </div>
            )}

            {analysis.paragraphs.length > 1 && (
              <button
                type="button"
                onClick={() => setAnalyseDepliee((v) => !v)}
                className="tap mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[.14em] text-emerald-300 transition-colors hover:bg-emerald-400/[0.12] hover:text-emerald-200"
              >
                {analyseDepliee ? "Replier l'analyse" : "Lire l'analyse complète"}
                <ChevronRight
                  size={13}
                  className={`transition-transform ${analyseDepliee ? "-rotate-90" : ""}`}
                />
              </button>
            )}
          </section>

          {/* ============================================================
              3 — LES TROIS INFORMATIONS CLES
              ============================================================
              Elles vivaient dans une colonne laterale de 280 px, serrees
              contre le texte. Elles prennent toute la largeur : ce sont les
              trois chiffres qu'on vient chercher. */}
          <section className="border-b border-slate-800 px-5 py-8 md:px-10">
            <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
              {/* LEADER */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[.10] to-transparent p-5">
                <p className="font-mono text-[9px] font-black uppercase tracking-[.18em] text-amber-300">
                  🏆 Leader
                </p>
                <p className="mt-3 truncate font-display text-2xl font-black leading-none text-white">
                  {gazetteDynamicBlocks.leader?.name ?? "—"}
                </p>
                <p className="mt-2.5 font-display text-lg font-black tabular-nums text-amber-300">
                  {gazetteDynamicBlocks.leader?.points ?? 0}
                  <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-amber-300/70">
                    pts
                  </span>
                </p>
              </div>

              {/* RECORD DE LA SAISON */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/[.09] to-transparent p-5">
                <p className="font-mono text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">
                  🎯 Record de la saison
                </p>
                {gazetteDynamicBlocks.bestMatchday ? (
                  <>
                    <p className="mt-3 truncate font-display text-2xl font-black leading-none text-white">
                      {gazetteDynamicBlocks.bestMatchday.name}
                    </p>
                    <p className="mt-2.5 font-display text-lg font-black tabular-nums text-emerald-300">
                      {gazetteDynamicBlocks.bestMatchday.points}
                      <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-emerald-300/70">
                        pts · J{gazetteDynamicBlocks.bestMatchday.journeeNumber}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-display text-2xl font-black text-white">—</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Le record apparaîtra après les premiers résultats.
                    </p>
                  </>
                )}
              </div>

              {/* DERNIER COUP */}
              <div className="relative overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-400/[.09] to-transparent p-5">
                <p className="font-mono text-[9px] font-black uppercase tracking-[.18em] text-sky-300">
                  🔥 Dernier coup
                </p>
                {gazetteDynamicBlocks.performance ? (
                  <>
                    <p className="mt-3 truncate font-display text-2xl font-black leading-none text-white">
                      {gazetteDynamicBlocks.performance.profile.pseudo || "Joueur"}
                    </p>
                    <p className="mt-2 font-mono text-[11px] font-bold text-slate-400">
                      {shortTeam(getTeamHome(lastFinished))} {getScoreHome(lastFinished)}–
                      {getScoreAway(lastFinished)} {shortTeam(getTeamAway(lastFinished))}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-black tabular-nums text-sky-300">
                        +{gazetteDynamicBlocks.performance.points}
                        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-sky-300/70">
                          pts
                        </span>
                      </span>
                      {gazetteDynamicBlocks.performance.exact && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/15 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[.12em] text-sky-200">
                          <Target size={10} /> Score exact
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-display text-2xl font-black text-white">—</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      En attente du prochain résultat.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ============================================================
              4 — LE DIRECT
              ============================================================
              Les trois etats etaient melanges dans une seule liste : on
              cherchait le match en cours au milieu des matchs a venir. Ils
              sont desormais groupes — en direct, termines, a venir — sans
              qu'aucune donnee ni aucun tri ne change : `getMatchState` est la
              meme fonction qu'avant. */}
          {allCurrentMatches.length > 0 && (
          <section className="border-b border-slate-800 px-5 py-8 md:px-10">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-black uppercase tracking-[.2em] text-cyan-300">
                  Le direct
                </p>
                <h2 className="mt-1 font-display text-2xl font-black uppercase text-white md:text-3xl">
                  Les matchs du jour
                </h2>
              </div>
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[.1em] text-slate-600">
                {totalMatches} match{totalMatches > 1 ? "s" : ""}
              </span>
            </div>

            {/* La section entiere ne s'affiche que s'il y a des matchs
                aujourd'hui (voir la condition plus haut) : plus besoin d'un
                encadre « aucun match » qui ne dirait rien a personne. */}
            <div className="mt-5 space-y-6">
                {([
                  { cle: "live", titre: "En direct", couleur: "text-red-300" },
                  { cle: "finished", titre: "Terminés", couleur: "text-emerald-300" },
                  { cle: "upcoming", titre: "À venir", couleur: "text-slate-400" },
                ] as const).map(({ cle, titre, couleur }) => {
                  const groupe = allCurrentMatches.filter(({ match }) => {
                    const etat = getMatchState(match);
                    if (cle === "live") return etat === "live";
                    if (cle === "finished") return etat === "finished" || (etat !== "live" && hasScore(match));
                    return etat === "upcoming" && !hasScore(match);
                  });
                  if (groupe.length === 0) return null;

                  return (
                    <div key={cle}>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-[9px] font-black uppercase tracking-[.2em] ${couleur}`}>
                          {titre}
                        </span>
                        <span className="font-mono text-[9px] font-bold text-slate-600">{groupe.length}</span>
                        <div className="h-px flex-1 bg-slate-800/70" />
                      </div>

                      <div className="mt-3 grid gap-2">
                        {groupe.map(({ match, isBonus }) => {
                          const live = cle === "live";
                          const termine = cle === "finished";
                          return (
                            <div
                              key={String(match.id)}
                              className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-2.5 py-3 sm:grid sm:grid-cols-[58px_minmax(0,1fr)_66px] sm:px-4 sm:py-4 ${
                                live
                                  ? "border-red-400/35 bg-red-400/[.07]"
                                  : termine
                                    ? "border-emerald-400/15 bg-emerald-400/[.025]"
                                    : "border-slate-800 bg-slate-950/30"
                              }`}
                            >
                              <div className="order-1 w-[58px] shrink-0 text-center sm:order-none sm:w-auto">
                                <p
                                  className={`font-mono text-[10px] font-black ${
                                    live ? "animate-pulse text-red-300" : termine ? "text-emerald-300" : "text-slate-500"
                                  }`}
                                >
                                  {matchStatusLabel(match)}
                                </p>
                                <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[.12em] text-slate-600">
                                  {isBonus ? "BONUS" : "L1"}
                                </p>
                              </div>

                              {/* Les noms de clubs etrangers (matchs bonus) ne tiennent
                                  pas cote a cote sur un telephone : "Borussia
                                  Monchengladbach" demande 213 px, la colonne en
                                  fait 102. Sous `sm` on empile les deux equipes,
                                  chacune avec son score en bout de ligne ; a
                                  partir de `sm` on retrouve exactement la ligne
                                  centree. Deux rendus, une seule source de
                                  donnees : les memes getScoreHome/getScoreAway. */}

                              {/* Telephone : un vrai tableau de scores. */}
                              <div className="order-2 flex min-w-0 basis-full flex-col gap-2 font-display text-sm font-black text-white sm:hidden">
                                {([
                                  { cote: "home" as const, nom: getTeamHome(match), score: getScoreHome(match) },
                                  { cote: "away" as const, nom: getTeamAway(match), score: getScoreAway(match) },
                                ]).map(({ cote, nom, score }) => (
                                  <div key={cote} className="flex min-w-0 items-center gap-2">
                                    <GazetteTeamLogo teams={teams} match={match} side={cote} size="size-8" />
                                    <span className="min-w-0 flex-1 truncate">{shortTeam(nom)}</span>
                                    {(live || termine) && (
                                      <span
                                        className={`shrink-0 tabular-nums ${
                                          live ? "text-red-300" : "text-white"
                                        }`}
                                      >
                                        {score ?? "—"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Tablette et ordinateur : la ligne centree. */}
                              <div className="order-2 hidden min-w-0 flex-1 basis-full items-center justify-center gap-2 font-display text-sm font-black text-white sm:order-none sm:flex sm:basis-auto md:gap-4 md:text-base">
                                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                  <span className="truncate text-right">{shortTeam(getTeamHome(match))}</span>
                                  <GazetteTeamLogo teams={teams} match={match} side="home" size="size-9 md:size-11" />
                                </div>
                                <span
                                  className={`min-w-[58px] shrink-0 rounded-lg px-2 py-1 text-center tabular-nums ${
                                    live
                                      ? "bg-red-400 text-slate-950"
                                      : termine
                                        ? "bg-slate-800 text-white"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {live || termine
                                    ? `${getScoreHome(match) ?? "—"} – ${getScoreAway(match) ?? "—"}`
                                    : "VS"}
                                </span>
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <GazetteTeamLogo teams={teams} match={match} side="away" size="size-9 md:size-11" />
                                  <span className="truncate">{shortTeam(getTeamAway(match))}</span>
                                </div>
                              </div>

                              <div className="order-1 ml-auto text-right sm:order-none sm:ml-0">
                                <p className="font-mono text-[8px] text-slate-600">
                                  {formatKickoff(match.kickoff ?? match.kickoff_time)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
          )}

          {/* ============================================================
              5 — LE CLASSEMENT
              ============================================================
              Le mouvement etait CALCULE (evolution.previousRanks) mais
              n'apparaissait nulle part. Il s'affiche enfin, avec la meme
              regle que partout : rang precedent moins rang actuel. */}
          <section className="border-b border-slate-800 px-5 py-8 md:px-10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9px] font-black uppercase tracking-[.2em] text-amber-300">
                  Dans notre compétition
                </p>
                <h2 className="mt-1 font-display text-2xl font-black uppercase text-white md:text-3xl">
                  Le classement
                </h2>
              </div>
              <div className="hidden h-px flex-1 bg-slate-800 sm:block" />
              <Link
                to="/classement"
                className="tap shrink-0 basis-full whitespace-nowrap text-center sm:basis-auto sm:text-left rounded-xl border border-slate-700 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.12em] text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-200"
              >
                Voir le classement →
              </Link>
            </div>

            {[leader, second, third].filter(Boolean).length === 0 ? (
              <div className="mt-5">
                <EditorialEmptyState
                  compact
                  icon={Trophy}
                  title="Classement en construction"
                  description="Le podium s'affichera dès les premiers points marqués."
                />
              </div>
            ) : (
            <div className="mt-5 grid gap-2.5 lg:grid-cols-3">
              {[leader, second, third].filter(Boolean).map((player: any) => {
                const rangAvant = evolution?.previousRanks.get(String(player.id));
                const mouvement =
                  typeof rangAvant === "number" ? rangAvant - Number(player.rank) : 0;
                const medaille = player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : "🥉";

                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 rounded-2xl border p-4 ${
                      player.rank === 1
                        ? "border-amber-400/45 bg-gradient-to-br from-amber-400/[.12] to-transparent shadow-[0_10px_35px_-12px_rgba(245,158,11,.35)]"
                        : player.rank === 2
                          ? "border-slate-300/25 bg-slate-300/[.045]"
                          : "border-orange-400/25 bg-orange-400/[.05]"
                    }`}
                  >
                    <span className="shrink-0 text-2xl leading-none" aria-hidden>
                      {medaille}
                    </span>

                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt=""
                        className="size-10 shrink-0 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-display text-xs font-black text-slate-300">
                        {player.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-black text-white">{player.name}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[.1em] text-slate-500">
                        {player.exactScores} score{player.exactScores > 1 ? "s" : ""} exact
                        {player.exactScores > 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`font-display text-xl font-black tabular-nums ${
                          player.rank === 1 ? "text-amber-300" : "text-white"
                        }`}
                      >
                        {player.points}
                      </p>
                      <p
                        className={`font-mono text-[9px] font-black ${
                          mouvement > 0
                            ? "text-emerald-400"
                            : mouvement < 0
                              ? "text-red-400"
                              : "text-slate-600"
                        }`}
                      >
                        {mouvement > 0 ? `↑${mouvement}` : mouvement < 0 ? `↓${Math.abs(mouvement)}` : "="}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </section>

          {/* ============================================================
              6 — LE CHIFFRE
              ============================================================
              Le chiffre etait relegue a droite, a la meme taille que le
              titre. Il devient l'element, seul au centre. La phrase qui
              l'explique reste petite, dessous — c'est elle qui commente, pas
              l'inverse. */}
          <section className="border-b border-slate-800 px-5 py-10 md:px-10 md:py-14">
            <div className="relative overflow-hidden rounded-[26px] border border-sky-400/15 bg-gradient-to-b from-sky-400/[.07] via-slate-950/40 to-transparent px-6 py-10 text-center md:py-14">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/10 blur-3xl"
              />
              <p className="relative font-mono text-[9px] font-black uppercase tracking-[.3em] text-sky-300">
                Le chiffre
              </p>
              <p className="relative mt-4 font-display text-[5rem] font-black leading-[.8] tracking-[-.04em] text-white tabular-nums md:text-[8rem]">
                {dynamicStat.value}
              </p>
              <p className="relative mx-auto mt-5 max-w-md font-display text-sm font-black uppercase tracking-[.12em] text-sky-200 md:text-base">
                {dynamicStat.label}
              </p>
              <p className="relative mx-auto mt-3 max-w-lg text-xs leading-relaxed text-slate-500 md:text-sm">
                {dynamicStat.note}
              </p>
            </div>
          </section>

          {/* ============================================================
              7 + 8 — L'AFFICHE ET LA PERF
              ============================================================ */}
          <section className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-slate-800 p-5 md:border-b-0 md:border-r md:p-10">
              <p className="font-mono text-[9px] font-black uppercase tracking-[.2em] text-orange-300">🔥 L'affiche</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-white">
                {weekendMatch && weekendMatch.joue ? "L'affiche de la journée" : "Le rendez-vous à suivre"}
              </h2>

              {weekendMatch ? (
                <div className="mt-5 rounded-[24px] border border-orange-400/20 bg-gradient-to-b from-orange-400/[.08] to-transparent p-6 text-center">
                  <div className="flex items-center justify-center gap-3 md:gap-6">
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
                      <GazetteTeamLogo
                        teams={teams}
                        match={weekendMatch.match}
                        side="home"
                        size="size-16 md:size-20"
                      />
                      <p className="w-full truncate font-display text-base font-black text-white md:text-lg">
                        {shortTeam(getTeamHome(weekendMatch.match))}
                      </p>
                    </div>

                    <span className="shrink-0 font-display text-2xl font-black tabular-nums text-orange-300 md:text-3xl">
                      {hasScore(weekendMatch.match)
                        ? `${getScoreHome(weekendMatch.match)}–${getScoreAway(weekendMatch.match)}`
                        : "VS"}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
                      <GazetteTeamLogo
                        teams={teams}
                        match={weekendMatch.match}
                        side="away"
                        size="size-16 md:size-20"
                      />
                      <p className="w-full truncate font-display text-base font-black text-white md:text-lg">
                        {shortTeam(getTeamAway(weekendMatch.match))}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-slate-500">
                    {matchStatusLabel(weekendMatch.match)} ·{" "}
                    {formatKickoff(weekendMatch.match.kickoff ?? weekendMatch.match.kickoff_time)}
                  </p>
                </div>
              ) : (
                <EditorialEmptyState
                  compact
                  icon={Flame}
                  title="Affiche à venir"
                  description="Le gros match apparaîtra dès que le calendrier sera disponible."
                />
              )}
            </div>

            <div className="p-5 md:p-10">
              <p className="font-mono text-[9px] font-black uppercase tracking-[.2em] text-fuchsia-300">⚡ La perf</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-white">La performance</h2>

              {bigPerformance ? (
                <div className="mt-5 rounded-[24px] border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-400/[.08] to-transparent p-6">
                  <div className="flex items-center gap-4">
                    {bigPerformance.player.avatar ? (
                      <img
                        src={bigPerformance.player.avatar}
                        alt=""
                        className="size-14 shrink-0 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-800 font-display font-black text-white">
                        {bigPerformance.player.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-black text-white">
                        {bigPerformance.player.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
                        {shortTeam(getTeamHome(bigPerformance.match))} {getScoreHome(bigPerformance.match)}–
                        {getScoreAway(bigPerformance.match)} {shortTeam(getTeamAway(bigPerformance.match))}
                      </p>
                      {bigPerformance.exact && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-fuchsia-400/35 bg-fuchsia-400/15 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[.12em] text-fuchsia-200">
                          <Target size={10} /> Score exact
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-display text-4xl font-black tabular-nums text-fuchsia-300">
                        +{bigPerformance.points}
                      </p>
                      <p className="font-mono text-[8px] uppercase tracking-[.12em] text-slate-600">points</p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm font-bold leading-6 text-slate-300">
                    {bigPerformance.exact
                      ? "Score exact : une lecture parfaite du match."
                      : "Une des meilleures performances enregistrées sur les matchs déjà terminés."}
                  </p>
                </div>
              ) : (
                <EditorialEmptyState
                  compact
                  icon={Zap}
                  title="Performance en attente"
                  description="La grosse performance apparaîtra après les premiers résultats."
                />
              )}
            </div>
          </section>
        </article>
      </div>
    </AppShell>
  );
}

function getDisplayedLiveMinute(match: any, now: number) {
  const rawStatus = String(
    match?.live_status ??
    match?.status ??
    match?.fixture?.status?.short ??
    ""
  ).toUpperCase();

  // Le statut FINISHED/FT est prioritaire : le chrono s'arrête.
  if (FINISHED_STATUSES.has(rawStatus)) {
    return "FT";
  }

  // À la mi-temps, on affiche MT et on ne continue surtout pas à compter.
  if (["PAUSED", "HT", "HALFTIME"].includes(rawStatus)) {
    return "MT";
  }

  const kickoff = getKickoffTimestamp(match);
  if (!Number.isFinite(kickoff)) {
    return "LIVE";
  }

  const elapsedWallMinutes = Math.max(
    0,
    Math.floor((now - kickoff) / 60000)
  );

  /*
   * football-data.org fournit le statut et le score, mais pas une minute
   * "elapsed" fiable comme certaines autres APIs.
   *
   * On reconstruit donc la minute à partir du coup d'envoi en retirant
   * les ~15 minutes de pause entre les deux mi-temps.
   *
   * 0-45 min réelles  -> 0-45'
   * pause              -> MT (géré par le statut API)
   * après la reprise   -> on retire 15 min de temps mur
   * au-delà de 90'     -> 90+'
   */
  let matchMinute = elapsedWallMinutes;

  if (elapsedWallMinutes >= 60) {
    matchMinute = elapsedWallMinutes - 15;
  }

  matchMinute = Math.max(1, matchMinute);

  if (matchMinute >= 90) {
    return "90+'";
  }

  return `${matchMinute}'`;
}