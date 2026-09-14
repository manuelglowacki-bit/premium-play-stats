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
import { normalizeTeamName } from "@/services/bonusSelectionService";
import { getTeamTheme } from "@/lib/team-theme";
import { rankPlayers } from "@/lib/leaderboardRanking";
import { ecrireRecit, morceaux } from "@/lib/recitDebrief";
import { bonusEnVigueurParJournee } from "@/lib/journeeBonus";
import {
  cheminLisible,
  journeeTerminee,
  parcoursSaison,
  progressionJournee,
  progressionTotale,
} from "@/lib/parcoursSaison";
import {
  computeLeagueStats,
  type LeagueBonusOption,
  type LeagueMatch,
  type LeaguePrediction,
  type LeagueProfile,
} from "@/lib/leaderboardStats";
import {
  fetchLiveApiMatches,
  reconcileMatchesWithLive,
  markLiveMatchesScorable,
  FINISHED_STATUSES,
  IN_PROGRESS_STATUSES,
} from "@/lib/liveMatches";

/** Les quatre tons de l'article. Le texte ne nomme qu'une couleur
 *  (« or », « vert »...) ; c'est ici qu'elle devient des classes. */
const TONS = {
  or: {
    fond: "bg-amber-400/[.035]",
    kicker: "text-amber-300",
    filet: "border-amber-400/40",
    accent: "text-amber-200",
  },
  vert: {
    fond: "bg-emerald-400/[.035]",
    kicker: "text-emerald-300",
    filet: "border-emerald-400/40",
    accent: "text-emerald-200",
  },
  rouge: {
    fond: "bg-red-400/[.03]",
    kicker: "text-red-300",
    filet: "border-red-400/35",
    accent: "text-red-200",
  },
  bleu: {
    fond: "bg-sky-400/[.035]",
    kicker: "text-sky-300",
    filet: "border-sky-400/40",
    accent: "text-sky-200",
  },
  violet: {
    fond: "bg-fuchsia-400/[.035]",
    kicker: "text-fuchsia-300",
    filet: "border-fuchsia-400/40",
    accent: "text-fuchsia-200",
  },
  cyan: {
    fond: "bg-cyan-400/[.035]",
    kicker: "text-cyan-300",
    filet: "border-cyan-400/40",
    accent: "text-cyan-200",
  },
} as const;

export const Route = createFileRoute("/debrief")({
  head: () => ({
    meta: [
      { title: "Le Debrief — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Le Debrief : le bilan de la journée, les remontées, les chutes et le classement.",
      },
    ],
  }),
  component: DebriefPage,
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
  /**
   * LE match bonus qui compte pour savoir si la journee est finie : le
   * dernier tirage actif. `bonus` peut en contenir plusieurs (une ligne
   * `bonus_options` oubliee active apres un retirage), et ces lignes-la
   * restent dans `bonus` pour que les points ne bougent pas — mais elles
   * ne doivent pas empecher la journee d'etre racontee.
   */
  bonusPrincipal: string | null;
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


const LOCAL_BONUS_LOGOS: Record<string, string> = {
  premierleague: "/logos/Premier league",
  liga: "/logos/Liga",
  seriea: "/logos/Serie A",
  bundesliga: "/logos/Bundesliga",
};

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
  // Vocabulaire de statuts UNIQUE (src/lib/liveMatches.ts) — le Debrief ne
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
  // existe déjà. Cela permet à le Debrief de bouger pendant les rencontres
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
// DebriefPage, via rankPlayers (src/lib/leaderboardRanking.ts) — MÊME
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

function DebriefPage() {
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
        supabase
          .from("bonus_options")
          // `is_active` et `created_at` servent a reconnaitre le tirage EN
          // VIGUEUR quand une journee porte plusieurs lignes bonus (voir
          // bonusEnVigueurParJournee). Meme requete que l'Accueil.
          .select("matchday_id, match_id, is_active, created_at"),
        supabase.from("profiles").select("*").order("pseudo", { ascending: true, nullsFirst: false }),
        // Paginee : sans cela PostgREST tronque a 1000 lignes en silence et
        // le Debrief raconte la journee sur des chiffres incomplets.
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
        const matchdayId = String(option.matchday_id);
        const list = bonusMatchesByMatchday.get(matchdayId) ?? [];
        list.push(match);
        bonusMatchesByMatchday.set(matchdayId, list);
      });

      // Le tirage EN VIGUEUR pour chaque journee. Regle partagee avec
      // l'Accueil (src/lib/journeeBonus.ts) : deux implementations de la meme
      // regle finissent toujours par diverger — c'est deja arrive a Stats.
      const bonusEnVigueur = bonusEnVigueurParJournee((bonusOptionsData ?? []) as any[]);

      // Supabase reste la source du calendrier. Pour le direct, la fusion
      // (statut/score + garde anti-régression + cache sessionStorage) passe
      // EXCLUSIVEMENT par src/lib/liveMatches.ts — même fonction que
      // Classement/Accueil/Profil/Stats/Pronostics, plus de fetch ni de
      // fusion dédiés à le Debrief.
      const normalized: Journee[] = ligue1Matchdays
        .map((matchday: any) => ({
          id: matchday.id,
          number: matchday.number,
          title: `J${matchday.number}`,
          matches: reconcileMatchesWithLive(matchesByMatchday.get(matchday.id) ?? [], apiLiveMatches),
          bonus: reconcileMatchesWithLive(bonusMatchesByMatchday.get(matchday.id) ?? [], apiLiveMatches),
          bonusPrincipal: bonusEnVigueur.get(String(matchday.id)) ?? null,
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
    // jours creux, la derniere journee deja commencee — le Debrief continue
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







  // LE GRAND BILAN — le parcours de chaque joueur depuis la premiere journee.
  //
  // C'est ce que le Debrief ne savait pas raconter : « 17e -> 1er » dit une
  // saison, un total de points ne dit rien. Le rang apres chaque journee
  // n'est stocke nulle part, il se reconstruit en rejouant le classement
  // journee apres journee (src/lib/parcoursSaison.ts) — avec `rankPlayers`,
  // celui du vrai classement, departages compris, et les points du moteur.
  const grandBilan = useMemo(() => {
    if (rankedPlayers.length === 0) return null;

    // UNE JOURNEE N'EST RACONTEE QUE LORSQU'ELLE EST ENTIEREMENT TERMINEE —
    // matchs de Ligue 1 ET matchs bonus.
    //
    // Un bilan qui bouge pendant que les matchs se jouent n'est pas un bilan :
    // le classement change a chaque but, et le joueur qui lit le samedi soir
    // voit un article que le dimanche dementira. En n'ouvrant la page qu'une
    // fois tout joue, elle bascule d'elle-meme le dimanche soir — sans tache
    // programmee, c'est la donnee qui decide.
    //
    // CONSEQUENCE ASSUMEE, decidee par l'organisateur : un match bonus laisse
    // sans score empeche sa journee d'etre racontee. Le Debrief reste alors
    // sur la precedente — c'est visible immediatement, et le remede est de
    // saisir le score manquant (Admin -> Bonus -> Modifier le bonus).
    const toutesLesJournees = journees
      .map((journee) => {
        const tous = [...journee.matches, ...journee.bonus];

        // CE QUI COMPTE POUR LA PORTE : les matchs de Ligue 1 et LE match
        // bonus en vigueur (le dernier tirage). Une journee peut trainer une
        // deuxieme ligne `bonus_options` restee active apres un retirage :
        // ses points continuent d'etre comptes — le match reste dans `tous`,
        // donc dans `matchIds` — mais un match d'un tirage abandonne, qui ne
        // sera peut-etre jamais joue, ne doit pas empecher la journee d'etre
        // racontee.
        const bonusQuiCompte = journee.bonusPrincipal
          ? journee.bonus.filter((match: any) => String(match.id) === journee.bonusPrincipal)
          : journee.bonus;
        const porte = [...journee.matches, ...bonusQuiCompte];

        const termines = tous.map((match: any) => isActuallyFinished(match));
        return {
          id: String(journee.id),
          numero: Number(journee.number) || 0,
          matchIds: tous.map((match: any) => String(match.id)),
          terminee: journeeTerminee(porte.map((match: any) => isActuallyFinished(match))),
          joues: termines.filter(Boolean).length,
        };
      })
      .filter((journee) => journee.numero > 0);

    // LA JOURNEE RACONTEE : la derniere entierement terminee.
    const derniereTerminee = toutesLesJournees
      .filter((journee) => journee.terminee)
      .sort((a, b) => b.numero - a.numero)[0];

    if (!derniereTerminee) return null;

    // LE PARCOURS s'arrete a cette journee, mais il compte TOUTES celles
    // d'avant des qu'un match y a ete joue.
    //
    // Si on n'y gardait que les journees completes, une journee a laquelle il
    // manque un resultat disparaitrait du cumul : ses points ne seraient
    // jamais additionnes, et tous les rangs des journees suivantes seraient
    // faux. Mieux vaut une journee comptee avec ce qui a ete joue qu'une
    // journee effacee.
    const journeesJouees = toutesLesJournees
      .filter((journee) => journee.joues > 0 && journee.numero <= derniereTerminee.numero);

    if (journeesJouees.length === 0) return null;

    const parcours = parcoursSaison({
      joueurs: rankedPlayers.map((p: any) => ({ id: String(p.id), name: p.name })),
      journees: journeesJouees,
      pointsDe: (userId, matchId) => pointsFor(userId, matchId),
      exactDe: (userId, matchId) => {
        const prono = predictionsByUser.get(userId)?.byMatch.get(matchId);
        if (!prono) return false;
        return isExactPrediction(matchesById.get(matchId), prono);
      },
      classer: rankPlayers,
    });

    // ARRETE A LA JOURNEE RACONTEE, pas a aujourd'hui.
    //
    // `rankedPlayers` donne le classement A L'INSTANT : pendant que la J5 se
    // joue, il compte deja ses matchs termines. Un article intitule « le
    // bilan apres 4 journees » qui afficherait ces totaux-la se contredirait
    // lui-meme. On lit donc le rang et le total de la DERNIERE ETAPE du
    // parcours — l'etat du classement au soir de la journee racontee.
    const fiches = rankedPlayers.map((joueur: any) => {
      const etapes = parcours.get(String(joueur.id)) ?? [];
      const derniereEtape = etapes[etapes.length - 1];
      return {
        id: String(joueur.id),
        name: joueur.name as string,
        avatar: (joueur.avatar as string) || "",
        rang: derniereEtape ? derniereEtape.rang : Number(joueur.rank),
        points: derniereEtape ? derniereEtape.points : Number(joueur.points),
        exactScores: derniereEtape ? derniereEtape.exactScores : Number(joueur.exactScores ?? 0),
        etapes,
        chemin: cheminLisible(etapes),
        progression: progressionTotale(etapes),
        // Le mouvement SUR la journee racontee — c'est lui qui decide qui
        // monte et qui descend dans l'article. Voir progressionJournee().
        mouvement: progressionJournee(etapes),
        rangVeille: etapes.length >= 2 ? etapes[etapes.length - 2].rang : null,
        // Points marques sur la derniere journee jouee.
        derniereJournee: etapes[etapes.length - 1]?.gainJournee ?? 0,
      };
    });

    // On reordonne sur le rang de la journee racontee : `rankedPlayers` est
    // trie sur le classement d'aujourd'hui, qui peut deja avoir bouge.
    fiches.sort((a, b) => a.rang - b.rang || a.name.localeCompare(b.name, "fr"));

    const parId = new Map(fiches.map((f) => [f.id, f]));

    // QUI MONTE ET QUI DESCEND SUR LA JOURNEE RACONTEE — pas sur la saison.
    // Un joueur parti de la 23e place et 9e aujourd'hui a une belle saison,
    // mais s'il vient de perdre quatre places il n'a rien a faire dans « ils
    // reviennent de loin » d'un Debrief de la journee 4.
    const remontees = [...fiches]
      .filter((f) => f.mouvement > 0 && f.etapes.length >= 2)
      .sort((a, b) => b.mouvement - a.mouvement || a.rang - b.rang)
      .slice(0, 3);

    const chutes = [...fiches]
      .filter((f) => f.mouvement < 0 && f.etapes.length >= 2)
      .sort((a, b) => a.mouvement - b.mouvement || a.rang - b.rang)
      .slice(0, 3);

    // La plus belle trajectoire DEPUIS LE DEBUT, gardee a part : c'est une
    // autre histoire que celle de la journee, et elle merite sa phrase.
    const trajectoire = [...fiches]
      .filter((f) => f.progression > 0 && f.etapes.length >= 3)
      .sort((a, b) => b.progression - a.progression || a.rang - b.rang)[0] ?? null;

    // La meilleure journee du groupe, celle dont on parle le lendemain.
    const meilleureJournee = [...fiches]
      .sort((a, b) => b.derniereJournee - a.derniereJournee || a.rang - b.rang)[0] ?? null;

    // DENSITE — combien se tiennent dans un mouchoir derriere le leader.
    const tete = fiches[0]?.points ?? 0;
    const groupe = fiches.filter((f) => tete - f.points <= 3);
    const densite = groupe.length >= 3
      ? { joueurs: groupe.length, points: tete - groupe[groupe.length - 1].points }
      : null;

    // Les ex aequo en tete : c'est ce qui rend un classement haletant.
    const exAequoTete = fiches.filter((f) => f.points === tete).length;

    return {
      journeesJouees: journeesJouees.length,
      derniereJournee: Math.max(...journeesJouees.map((j) => j.numero)),
      fiches,
      parId,
      top10: fiches.slice(0, 10),
      remontees,
      chutes,
      trajectoire,
      meilleureJournee,
      densite,
      exAequoTete,
    };
  }, [rankedPlayers, journees, pointsFor, predictionsByUser, matchesById]);

  // LE TEXTE — ecrit a partir des chiffres du grand bilan.
  const recit = useMemo(() => {
    if (!grandBilan) return null;
    return ecrireRecit({
      journeesJouees: grandBilan.journeesJouees,
      numeroDerniereJournee: grandBilan.derniereJournee,
      fiches: grandBilan.fiches,
      remontees: grandBilan.remontees,
      chutes: grandBilan.chutes,
      trajectoire: grandBilan.trajectoire,
      meilleureJournee: grandBilan.meilleureJournee,
      densite: grandBilan.densite,
      exAequoTete: grandBilan.exAequoTete,
    });
  }, [grandBilan]);










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
                  Le bilan
                </span>
                <h1 className="mt-1.5 font-display text-[3.25rem] font-black uppercase leading-[.82] tracking-[-.05em] text-white md:text-[4.5rem] lg:text-[5.5rem]">
                  Le Debrief
                </h1>
                <p className="mt-3.5 font-mono text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">
                  <span className="capitalize">
                    {new Date(clock).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  {/* La journee RACONTEE, pas celle du calendrier : pendant
                      que la J5 se joue, le Debrief parle encore de la J4. */}
                  {grandBilan ? (
                    <span className="text-slate-600"> · Journée {grandBilan.derniereJournee}</span>
                  ) : null}
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
              L'ARTICLE
              ============================================================
              Un vrai texte, pas des blocs de donnees avec des etiquettes.
              Les phrases sont ecrites par ecrireRecit() (src/lib/recitDebrief.ts),
              qui ne calcule rien : il recoit des chiffres deja etablis et les
              met en francais, accords compris. Ici on ne fait que la mise en
              page — largeur de lecture, interlignage, hierarchie. */}
          {!recit ? (
            <section className="px-5 py-10 md:px-10">
              <EditorialEmptyState
                icon={Newspaper}
                title="Le bilan arrive"
                description="Dès les premiers résultats, le Debrief racontera la saison journée après journée."
              />
            </section>
          ) : (
            <>
              {/* LE CHAPEAU */}
              <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-emerald-500/[.10] via-transparent to-fuchsia-500/[.06] px-5 py-9 md:px-10 md:py-12">
                <p className="font-mono text-[10px] font-black uppercase tracking-[.24em] text-emerald-300">
                  {recit.surtitre}
                </p>
                <h2 className="mt-3 max-w-[20ch] font-display text-[2rem] font-black uppercase leading-[.95] tracking-[-.03em] text-white md:text-[3.25rem]">
                  <span className="mr-2" aria-hidden>
                    {recit.emoji}
                  </span>
                  {recit.titre}
                </h2>
                {/* Le chapeau : plus gros que le corps, c'est lui qui donne
                    envie de lire la suite. `max-w` en `ch` et non en pixels —
                    une ligne de lecture confortable se mesure en caracteres. */}
                <p className="mt-5 max-w-[62ch] text-[17px] font-medium leading-[1.65] text-slate-200 md:text-lg">
                  {morceaux(recit.chapeau).map((bout, i) =>
                    bout.accent ? (
                      <strong key={i} className="font-black text-emerald-300">
                        {bout.texte}
                      </strong>
                    ) : (
                      <span key={i}>{bout.texte}</span>
                    ),
                  )}
                </p>
              </section>

              {/* LE CORPS DE L'ARTICLE
                  Une couleur par section — l'or pour la tete, le vert pour
                  ceux qui montent, le rouge pour ceux qui tombent, le bleu
                  pour la suite. Le texte, lui, ne connait pas Tailwind : il
                  ne donne qu'un nom de ton (voir recitDebrief.ts). */}
              {recit.sections.map((section) => {
                const couleurs = TONS[section.ton];
                return (
                  <section
                    key={section.kicker}
                    className={`border-b border-slate-800 px-5 py-8 md:px-10 md:py-10 ${couleurs.fond}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl leading-none md:text-3xl" aria-hidden>
                        {section.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className={`font-mono text-[9px] font-black uppercase tracking-[.2em] ${couleurs.kicker}`}>
                          {section.kicker}
                        </p>
                        <h3 className="mt-0.5 font-display text-xl font-black uppercase tracking-[-.02em] text-white md:text-2xl">
                          {section.titre}
                        </h3>
                      </div>
                    </div>

                    {/* Le filet colore rattache les paragraphes a leur section
                        — sans lui, quatre blocs de texte se ressemblent tous. */}
                    <div className={`mt-4 max-w-[68ch] space-y-4 border-l-2 pl-4 ${couleurs.filet}`}>
                      {section.paragraphes.map((paragraphe, index) => (
                        <p
                          key={index}
                          className="text-[15px] leading-[1.75] text-slate-300 md:text-base"
                        >
                          {morceaux(paragraphe).map((bout, i) =>
                            bout.accent ? (
                              <strong key={i} className={`font-bold ${couleurs.accent}`}>
                                {bout.texte}
                              </strong>
                            ) : (
                              <span key={i}>{bout.texte}</span>
                            ),
                          )}
                        </p>
                      ))}
                    </div>

                    {/* LE PARCOURS, MONTRE ET PAS SEULEMENT RACONTE.
                        Une phrase dit « 17e, puis 9e, puis 6e, et enfin 1er ».
                        L'echelle ci-dessous ajoute ce que la phrase ne peut
                        pas porter sans devenir illisible : les points de
                        chaque journee, et le sens de chaque mouvement. */}
                    {(section.echelles ?? []).length > 0 && (
                      <div className="mt-5 grid max-w-[68ch] gap-3 sm:grid-cols-2">
                        {(section.echelles ?? []).map((echelle) => (
                          <div
                            key={echelle.nom}
                            className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
                          >
                            <p className="truncate font-display text-xs font-black uppercase tracking-[.08em] text-white">
                              {echelle.nom}
                            </p>
                            <div className="mt-2 space-y-1">
                              {echelle.etapes.map((etape, i) => {
                                const avant = i > 0 ? echelle.etapes[i - 1].rang : null;
                                const delta = avant == null ? 0 : avant - etape.rang;
                                return (
                                  <div
                                    key={etape.numero}
                                    className="flex min-w-0 items-center gap-2 font-mono text-[11px] tabular-nums"
                                  >
                                    <span className="w-5 shrink-0 text-center" aria-hidden>
                                      {delta > 0 ? "⬆️" : delta < 0 ? "⬇️" : avant == null ? "" : "➡️"}
                                    </span>
                                    <span className="w-7 shrink-0 font-black text-slate-500">
                                      J{etape.numero}
                                    </span>
                                    <span
                                      className={`w-10 shrink-0 font-black ${
                                        etape.rang === 1
                                          ? "text-amber-300"
                                          : etape.rang <= 3
                                            ? "text-slate-200"
                                            : "text-slate-400"
                                      }`}
                                    >
                                      {etape.rang === 1
                                        ? "🥇"
                                        : etape.rang === 2
                                          ? "🥈"
                                          : etape.rang === 3
                                            ? "🥉"
                                            : `${etape.rang}e`}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-right text-slate-400">
                                      <span className="font-black text-slate-200">{etape.points}</span> pts
                                      {etape.gainJournee > 0 && (
                                        <span className="ml-1.5 text-emerald-400">+{etape.gainJournee}</span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}

              {/* LE CLASSEMENT — un journal a aussi ses tableaux. */}
              {grandBilan && (
                <section className="border-b border-slate-800 px-5 py-8 md:px-10">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl leading-none md:text-3xl" aria-hidden>
                      📊
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] font-black uppercase tracking-[.2em] text-amber-300">
                        Le classement
                      </p>
                      <h3 className="mt-0.5 font-display text-xl font-black uppercase text-white md:text-2xl">
                        Le top {grandBilan.top10.length}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 max-w-[68ch] space-y-1.5">
                    {grandBilan.top10.map((joueur) => (
                      <div
                        key={joueur.id}
                        className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          joueur.rang === 1
                            ? "border-amber-400/40 bg-amber-400/[.08]"
                            : joueur.rang <= 3
                              ? "border-slate-300/20 bg-white/[.03]"
                              : "border-slate-800"
                        }`}
                      >
                        <span className="w-7 shrink-0 text-center font-display text-sm font-black tabular-nums text-slate-500">
                          {joueur.rang === 1
                            ? "🥇"
                            : joueur.rang === 2
                              ? "🥈"
                              : joueur.rang === 3
                                ? "🥉"
                                : joueur.rang}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-display text-sm font-black text-white">
                          {joueur.name}
                        </span>
                        {/* Le mouvement SUR la journee racontee — la meme
                            mesure que les sections de l'article. Une fleche
                            qui parlerait de la saison entiere contredirait
                            le texte juste au-dessus. */}
                        {joueur.mouvement !== 0 && (
                          <span
                            className={`shrink-0 font-mono text-[10px] font-black tabular-nums ${
                              joueur.mouvement > 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {joueur.mouvement > 0
                              ? `↑${joueur.mouvement}`
                              : `↓${Math.abs(joueur.mouvement)}`}
                          </span>
                        )}
                        <span className="w-10 shrink-0 text-right font-display text-base font-black tabular-nums text-white">
                          {joueur.points}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/classement"
                    className="tap mt-4 inline-block rounded-xl border border-slate-700 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.12em] text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-200"
                  >
                    Voir tout le classement →
                  </Link>
                </section>
              )}
            </>
          )}

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