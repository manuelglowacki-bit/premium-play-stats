import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/prono/AppShell";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Crosshair,
  PieChart,
  Target,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeLeagueStats, type LeagueMatch, type LeagueProfile, type LeagueBonusOption } from "@/lib/leaderboardStats";
import { rankPlayers } from "@/lib/leaderboardRanking";
import { fetchLiveApiMatches, reconcileMatchesWithLive, markLiveMatchesScorable } from "@/lib/liveMatches";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Mes statistiques — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Retrouve tes performances, tes records et ton évolution journée après journée.",
      },
    ],
  }),
  component: StatsPage,
});

type MatchRow = {
  id: string;
  matchday: string | null;
  matchday_id?: string | null;
  status: string | null;
  finished?: boolean | null;
  kickoff?: string | null;
  api_fixture_id?: number | null;
  home_score: number | null;
  away_score: number | null;
  // Vraie colonne de `matches` (confirmée via le schéma Supabase réel) :
  // identifie les 4 matchs bonus (un par championnat PL/PD/SA/BL1) proposés
  // à la journée. Aucune colonne équivalente n'existe sur `predictions` —
  // voir isBonusPrediction ci-dessous.
  is_bonus: boolean | null;
  // Ajoutés pour le recalcul réel des points (voir computeLeagueStats plus
  // bas) — nécessaires pour détecter un match favori.
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_team?: string | null;
  away_team?: string | null;
};

type PredictionRow = {
  user_id: string | null;
  match_id: string;
  // `points` n'est plus lu : cette colonne n'est jamais mise à jour par
  // l'application (column_default 0, aucun trigger, vérifié en base — voir
  // le commentaire dans src/lib/leaderboardStats.ts). Les points affichés
  // viennent désormais de computeLeagueStats(), même moteur que le
  // Classement/Accueil/Profil.
  // Il n'existe pas de colonne `exact_score` en base : un score exact se
  // déduit en comparant home_prediction/away_prediction au score réel du
  // match (voir isExactPrediction ci-dessous).
  home_prediction: number | null;
  away_prediction: number | null;
};

// Un pronostic est "exact" quand le score prédit (home_prediction/
// away_prediction) correspond exactement au score final du match
// (matches.home_score/away_score). Les deux doivent être renseignés.
function isExactPrediction(prediction: PredictionRow, match: MatchRow | undefined): boolean {
  if (!match) return false;
  if (prediction.home_prediction == null || prediction.away_prediction == null) return false;
  if (match.home_score == null || match.away_score == null) return false;
  return (
    Number(prediction.home_prediction) === Number(match.home_score) &&
    Number(prediction.away_prediction) === Number(match.away_score)
  );
}

// Il n'existe pas de colonne `bonus_used` (ni `prediction_type` /
// `bonus_option_id`) sur `predictions` : un pronostic est "bonus" quand le
// match pronostiqué est lui-même marqué bonus, via `matches.is_bonus` (seule
// colonne réelle qui porte cette information — confirmée par
// `supabase gen types typescript`).
function isBonusPrediction(match: MatchRow | undefined): boolean {
  return Boolean(match?.is_bonus);
}

type DayStat = {
  day: string;
  points: number;
  predictions: number;
  exactScores: number;
  bonusPoints: number;
  standardPoints: number;
};

type StatsState = {
  totalPoints: number;
  average: number;
  wins: number;
  draws: number;
  losses: number;
  playedDays: number;
  seasonDays: number;
  exactScores: number;
  totalPredictions: number;
  successfulPredictions: number;
  bestDay: number;
  bestDayLabel: string;
  dayStats: DayStat[];
  standardPoints: number;
  exactPoints: number;
  bonusPoints: number;
  bonusSuccessful: number;
};

type LeaderboardPlayer = {
  userId: string;
  rank: number;
  name: string;
  avatarUrl: string;
  totalPoints: number;
  exactScores: number;
};

const EMPTY_STATS: StatsState = {
  totalPoints: 0,
  average: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  playedDays: 0,
  seasonDays: 34,
  exactScores: 0,
  totalPredictions: 0,
  successfulPredictions: 0,
  bestDay: 0,
  bestDayLabel: "—",
  dayStats: [],
  standardPoints: 0,
  exactPoints: 0,
  bonusPoints: 0,
  bonusSuccessful: 0,
};

// Sélecteur de plage du graphique d'évolution — nombre de journées affichées
// (présentation uniquement, la donnée affichée reste `stats.dayStats`,
// calcul inchangé ; visibleDays = stats.dayStats.slice(-selectedRange) gère
// déjà nativement le cas où moins de journées existent que la valeur
// choisie, sans donnée fictive).
const RANGE_OPTIONS = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 15, label: "15" },
  { value: 20, label: "20" },
  { value: 25, label: "25" },
  { value: 30, label: "30" },
  { value: 34, label: "34" },
];

// Chiffre principal d'une carte statistique : blanc, dégradé très léger,
// glow discret assorti à la carte — même principe que la Gazette (StatValue)
// pour rester cohérent avec la nouvelle direction artistique du site.
function StatValue({
  value,
  accent = "emerald",
  size = "text-4xl md:text-[40px]",
}: {
  value: string | number;
  accent?: "emerald";
  size?: string;
}) {
  const glow = "drop-shadow(0 0 16px rgba(52,211,153,.30))";
  return (
    <span
      className={`bg-gradient-to-b from-white to-white/85 bg-clip-text font-display ${size} font-black leading-none text-transparent`}
      style={{ filter: glow }}
    >
      {value}
    </span>
  );
}


function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof BarChart3;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div>
        <div className="font-mono text-[9px] font-semibold uppercase tracking-[.2em] text-emerald-300/80">
          {eyebrow}
        </div>
        <h2 className="mt-0.5 text-base font-bold uppercase tracking-[.08em] text-white">
          {title}
        </h2>
      </div>
    </div>
  );
}

function PodiumPlayer({
  player,
  place,
}: {
  player: LeaderboardPlayer;
  place: 1 | 2 | 3;
}) {
  const medal =
    place === 1
      ? {
          label: "🥇 1ER",
          accent: "border-amber-300/45 bg-amber-300/[0.08] text-amber-200",
          glow: "shadow-[0_0_34px_rgba(251,191,36,.14)]",
        }
      : place === 2
        ? {
            label: "🥈 2E",
            accent: "border-slate-300/25 bg-slate-300/[0.06] text-slate-200",
            glow: "shadow-[0_0_28px_rgba(148,163,184,.10)]",
          }
        : {
            label: "🥉 3E",
            accent: "border-orange-300/30 bg-orange-300/[0.06] text-orange-200",
            glow: "shadow-[0_0_28px_rgba(251,146,60,.10)]",
          };

  return (
    <article
      className={`group relative min-w-[170px] flex-1 overflow-hidden rounded-[18px] border ${medal.accent} ${medal.glow} bg-black/25 p-3 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,.10),transparent_58%)]" />
      <div className="relative flex items-center gap-2.5">
        <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <Users size={16} className="text-slate-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[8px] font-bold uppercase tracking-[.16em] text-slate-500">
            {medal.label}
          </div>
          <div className="mt-0.5 truncate text-xs font-bold text-white">
            {player.name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-slate-500">
            <span>{player.exactScores} exact{player.exactScores > 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-lg font-black text-white">{player.totalPoints}</div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-emerald-300/70">
            pts
          </div>
        </div>
      </div>
    </article>
  );
}


function StatsPage() {
  const [stats, setStats] = useState<StatsState>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(5);
  const statsRequestSeq = useRef(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);

  async function loadStats() {
    const requestId = ++statsRequestSeq.current;

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (requestId !== statsRequestSeq.current) return;

      if (authError) throw authError;

      if (!user) {
        setStats(EMPTY_STATS);
        setLeaderboard([]);
        setErrorMessage("Connecte-toi pour afficher tes statistiques personnelles.");
        return;
      }

      const [
        { data: matches, error: matchesError },
        { data: allPredictionsData, error: predictionsError },
        { data: profiles, error: profilesError },
        { data: bonusOptionsData, error: bonusOptionsError },
        { data: matchdaysData, error: matchdaysError },
        { data: competitionsData, error: competitionsError },
        { data: favoriteHistoryData, error: favoriteHistoryError },
        apiLiveMatches,
      ] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "id, matchday, matchday_id, status, finished, kickoff, api_fixture_id, home_score, away_score, is_bonus, home_team_id, away_team_id, home_team, away_team",
          ),
        // Tous les joueurs (pas seulement le compte connecté) : nécessaire
        // pour recalculer le Top joueurs via computeLeagueStats(), même
        // moteur que le Classement — remplace l'ancienne requête sur la vue
        // `user_rankings` (inexistante en base, confirmée HTTP 404) et sur
        // des colonnes `profiles.username/player_name/account_status` qui
        // n'existent pas non plus (confirmée HTTP 400).
        supabase
          .from("predictions")
          .select("user_id, match_id, home_prediction, away_prediction, created_at"),
        supabase
          .from("profiles")
          .select("id, pseudo, avatar_url, favorite_team_id, favorite_team"),
        supabase.from("bonus_options").select("matchday_id, match_id"),
        // Saison par journée + équipe favorite historisée par saison (Lot 4).
        // competition_id en plus : nécessaire pour isoler les vraies journées
        // Ligue 1 des journées bonus (PL/PD/SA/BL1), même logique que
        // index.tsx / profil.tsx / classement.tsx.
        supabase.from("matchdays").select("id, season_id, season, competition_id"),
        supabase.from("competitions").select("id, code, external_code"),
        supabase.from("user_season_favorite_teams").select("user_id, season_id, favorite_team_id"),
        // Même fetcher que toutes les autres pages (src/lib/liveMatches.ts).
        fetchLiveApiMatches(),
      ]);

      if (matchesError) throw matchesError;
      if (predictionsError) throw predictionsError;
      if (profilesError) console.warn("Erreur chargement profils (Top joueurs) :", profilesError);
      if (bonusOptionsError) console.warn("Erreur chargement bonus (recalcul points) :", bonusOptionsError);
      if (matchdaysError) console.warn("Erreur chargement journées (favori historique) :", matchdaysError);
      if (competitionsError) console.warn("Erreur chargement compétitions (filtre Ligue 1) :", competitionsError);
      if (favoriteHistoryError) console.warn("Historique équipe favorite non chargé :", favoriteHistoryError);

      if (requestId !== statsRequestSeq.current) return;

      const allMatches = (matches || []) as MatchRow[];

      // Direct live : Supabase reste la source du calendrier, tandis que
      // l'API fournit le score/statut courant. Un match 0-0 en cours est donc
      // immédiatement utilisable par le même moteur de points que le
      // Classement — fusion + garde anti-régression + fenêtre "match
      // commencé -> scorable" centralisées dans src/lib/liveMatches.ts.
      const matchesWithLiveScore = reconcileMatchesWithLive(allMatches, apiLiveMatches);

      if (requestId !== statsRequestSeq.current) return;

      const liveScoringMatches = markLiveMatchesScorable(matchesWithLiveScore);

      const allPredictions = (allPredictionsData || []) as PredictionRow[];
      const userPredictions = allPredictions.filter((p) => p.user_id === user.id);

      const matchById = new Map<string, MatchRow>();
      liveScoringMatches.forEach((match) => {
        matchById.set(String(match.id), match);
      });

      // Points réels — même moteur que Classement/Accueil/Profil. Matchs
      // Ligue 1 classiques (non-bonus) d'un côté, matchs bonus réellement
      // sélectionnés (via bonus_options) de l'autre, exactement comme
      // computeLeagueStats l'attend.
      const bonusOptions = (bonusOptionsData || []) as LeagueBonusOption[];
      const bonusMatchIdSet = new Set(bonusOptions.map((o) => String(o.match_id)));

      // Vraies journées Ligue 1 (FL1) — même construction que classement.tsx,
      // index.tsx et profil.tsx.
      // BUG CORRIGÉ : sans ce filtre, Stats versait dans le lot "Ligue 1"
      // n'importe quel match non-bonus ayant un score, y compris ceux des 4
      // championnats bonus (PL/PD/SA/BL1) que le Classement exclut — et un
      // match bonus stocké avec is_bonus = false était même compté DEUX fois
      // (une fois au barème standard ici, une fois au barème bonus juste en
      // dessous). Le lot est désormais identique à celui des trois autres
      // pages : mêmes matchs en entrée, donc mêmes points en sortie.
      const ligue1CompetitionIds = new Set(
        (competitionsData ?? [])
          .filter((c: any) => c.code === "FL1" || c.external_code === "FL1")
          .map((c: any) => String(c.id)),
      );
      const ligue1MatchdayIds = new Set(
        (matchdaysData ?? [])
          .filter(
            (md: any) => !md.competition_id || ligue1CompetitionIds.has(String(md.competition_id)),
          )
          .map((md: any) => String(md.id)),
      );

      const ligue1MatchesForScoring: LeagueMatch[] = liveScoringMatches
        .filter(
          (m) =>
            !m.is_bonus &&
            m.home_score != null &&
            m.away_score != null &&
            m.finished &&
            m.matchday_id &&
            ligue1MatchdayIds.has(String(m.matchday_id)),
        )
        .map((m) => ({
          id: m.id,
          matchday_id: m.matchday_id ?? m.matchday,
          home_team_id: m.home_team_id ?? null,
          away_team_id: m.away_team_id ?? null,
          home_team: m.home_team ?? null,
          away_team: m.away_team ?? null,
          home_score: m.home_score,
          away_score: m.away_score,
        }));
      const bonusMatchesForScoring: LeagueMatch[] = liveScoringMatches
        .filter((m) => bonusMatchIdSet.has(String(m.id)) && m.home_score != null && m.away_score != null)
        .map((m) => ({
          id: m.id,
          matchday_id: m.matchday_id ?? m.matchday,
          home_team_id: m.home_team_id ?? null,
          away_team_id: m.away_team_id ?? null,
          home_team: m.home_team ?? null,
          away_team: m.away_team ?? null,
          home_score: m.home_score,
          away_score: m.away_score,
          is_bonus: true,
        }));

      const allProfilesForStats = (profiles || []) as LeagueProfile[];

      // Saison par journée + équipe favorite HISTORISÉE par saison (Lot 4)
      // — même construction que Classement/Accueil/Profil, pour que le
      // barème favori (2/1/0) d'un pronostic passé utilise le club
      // réellement favori à cette époque.
      const seasonByMatchdayId: Record<string, string> = {};
      (matchdaysData ?? []).forEach((md: any) => {
        if (!md?.id) return;
        seasonByMatchdayId[String(md.id)] = String(md.season_id || md.season || "unknown");
      });
      const favoriteTeamBySeason: Record<string, string> = {};
      (favoriteHistoryData ?? []).forEach((row: any) => {
        if (!row?.user_id || !row?.season_id || !row?.favorite_team_id) return;
        favoriteTeamBySeason[`${row.user_id}:${row.season_id}`] = row.favorite_team_id;
      });

      if (requestId !== statsRequestSeq.current) return;

      const leagueStats = computeLeagueStats(
        ligue1MatchesForScoring,
        bonusMatchesForScoring,
        bonusOptions,
        allPredictions,
        allProfilesForStats,
        {},
        { seasonByMatchdayId, favoriteTeamBySeason },
      );

      const realPointsFor = (prediction: PredictionRow) =>
        leagueStats.pointsByPredictionKey[`${user.id}:${prediction.match_id}`] ?? 0;

      // ------------------------------------------------------------------
      // TOTAUX PERSONNELS — LA MÊME SOURCE QUE CLASSEMENT/ACCUEIL/PROFIL.
      // BUG CORRIGÉ : ces totaux étaient auparavant ré-additionnés localement
      // dans la boucle par journée ci-dessous, filtrée par une résolution de
      // journée (match.matchday / matchday_id) qui pouvait exclure des
      // pronostics du calcul (ex. matchs bonus, dont matchday_id pointe vers
      // une AUTRE compétition) — d'où un "Total points" à 0 alors que
      // computeLeagueStats() (utilisé par le Classement) trouvait bien 2.
      // On lit maintenant directement les agrégats du moteur, pour CE joueur,
      // sans aucun recalcul ni filtre supplémentaire : mêmes chiffres que
      // rankableRows plus bas (Top joueurs) et que le Classement.
      // ------------------------------------------------------------------
      const totalPoints = leagueStats.pointsByUser[user.id] ?? 0;
      const exactScores = leagueStats.exactScoresByUser[user.id] ?? 0;
      const totalPredictions = leagueStats.predictionsCountByUser[user.id] ?? 0;
      const successfulPredictions = leagueStats.regularitySuccessByUser[user.id] ?? 0;

      // ------------------------------------------------------------------
      // RÉPARTITION PAR JOURNÉE (graphique, meilleure journée, bonus/standard/
      // exact) — détail que computeLeagueStats() n'expose pas par match, donc
      // reconstruit ici à partir de pointsByPredictionKey (valeurs déjà
      // calculées par le moteur, jamais réinventées). La journée d'un match
      // BONUS est celle qui l'a sélectionné (bonus_options.matchday_id),
      // JAMAIS son propre matchday_id (qui pointe vers PL/PD/SA/BL1) — même
      // résolution que pointsByUserAndMatchday côté moteur, même logique que
      // le Profil (voir "Meilleure journée").
      // ------------------------------------------------------------------
      const bonusMatchdayByMatchId = new Map<string, string>();
      bonusOptions.forEach((option) => {
        bonusMatchdayByMatchId.set(String(option.match_id), String(option.matchday_id));
      });

      const dayLabelById = new Map<string, string>();
      liveScoringMatches.forEach((match) => {
        const matchdayId = bonusMatchdayByMatchId.get(String(match.id)) ?? match.matchday_id;
        if (!matchdayId || dayLabelById.has(String(matchdayId))) return;
        if (match.matchday == null) return;
        dayLabelById.set(String(matchdayId), `J${match.matchday}`);
      });

      const byDay = new Map<string, DayStat>();
      let standardPoints = 0;
      let exactPoints = 0;
      let bonusPoints = 0;
      let bonusSuccessful = 0;

      userPredictions.forEach((prediction) => {
        const match = matchById.get(String(prediction.match_id));
        const matchdayId = bonusMatchdayByMatchId.get(String(prediction.match_id)) ?? match?.matchday_id;
        if (!matchdayId) return;
        const day = dayLabelById.get(String(matchdayId)) ?? String(matchdayId);

        const points = realPointsFor(prediction);
        const exact = isExactPrediction(prediction, match);
        const bonus = isBonusPrediction(match);

        if (!byDay.has(day)) {
          byDay.set(day, {
            day,
            points: 0,
            predictions: 0,
            exactScores: 0,
            bonusPoints: 0,
            standardPoints: 0,
          });
        }

        const current = byDay.get(day)!;
        current.points += points;
        current.predictions += 1;
        if (exact) current.exactScores += 1;

        if (bonus) {
          current.bonusPoints += points;
          bonusPoints += points;
          if (points > 0) bonusSuccessful += 1;
        } else if (exact) {
          exactPoints += points;
        } else {
          current.standardPoints += points;
          standardPoints += points;
        }
      });

      const dayStats = Array.from(byDay.values()).sort(
        (a, b) =>
          Number(a.day.replace(/\D/g, "")) -
          Number(b.day.replace(/\D/g, "")),
      );

      const playedDays = dayStats.length;
      const average = playedDays ? totalPoints / playedDays : 0;
      const bestDayEntry = dayStats.reduce<DayStat | null>(
        (best, item) => (!best || item.points > best.points ? item : best),
        null,
      );

      const epsilon = 0.0001;
      const wins = dayStats.filter(
        (item) => item.points > average + epsilon,
      ).length;
      const draws = dayStats.filter(
        (item) => Math.abs(item.points - average) <= epsilon,
      ).length;
      const losses = Math.max(0, playedDays - wins - draws);

      if (requestId !== statsRequestSeq.current) return;

      setStats({
        totalPoints,
        average,
        wins,
        draws,
        losses,
        playedDays,
        seasonDays: 34,
        exactScores,
        totalPredictions,
        successfulPredictions,
        bestDay: bestDayEntry?.points || 0,
        bestDayLabel: bestDayEntry?.day || "—",
        dayStats,
        standardPoints,
        exactPoints,
        bonusPoints,
        bonusSuccessful,
      });

      // Top joueurs — même moteur que Classement/Accueil/Profil
      // (computeLeagueStats + rankPlayers, calculées plus haut), au lieu de
      // l'ancienne vue `user_rankings` (inexistante en base — voir le
      // commentaire sur le fetch plus haut pour la preuve HTTP 404/400).
      if (!profilesError) {
        const rankableRows = allProfilesForStats.map((profile) => ({
          userId: profile.id,
          avatarUrl: profile.avatar_url || "",
          pseudo: profile.pseudo || "Joueur",
          points: leagueStats.pointsByUser[profile.id] ?? 0,
          exactScores: leagueStats.exactScoresByUser[profile.id] ?? 0,
          predictionsCount: leagueStats.predictionsCountByUser[profile.id] ?? 0,
          regularitySuccess: leagueStats.regularitySuccessByUser[profile.id] ?? 0,
        }));

        const ranked = rankPlayers(rankableRows).slice(0, 5);

        if (requestId !== statsRequestSeq.current) return;

        setLeaderboard(
          ranked.map((row) => ({
            userId: row.userId,
            rank: row.rank,
            name: row.pseudo,
            avatarUrl: row.avatarUrl,
            totalPoints: row.points,
            exactScores: row.exactScores,
          })),
        );
      } else {
        setLeaderboard([]);
      }
    } catch (error: any) {
      if (requestId !== statsRequestSeq.current) return;
      console.error("Erreur chargement statistiques:", error);
      setErrorMessage(
        error?.message ||
          "Impossible de charger les statistiques depuis Supabase.",
      );
      setStats(EMPTY_STATS);
      setLeaderboard([]);
    } finally {
      if (requestId === statsRequestSeq.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadStats();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadStats();
    });

    // Les statistiques suivent les scores sans attendre la fin du match.
    // Recalcul automatique toutes les 15 secondes (même cadence que
    // Classement/Accueil/Gazette, cf. src/lib/liveMatches.ts — compromis
    // charge API / fraîcheur live) + rafraîchissement immédiat lorsque
    // l'utilisateur revient sur l'onglet.
    const liveRefreshTimer = window.setInterval(() => {
      loadStats();
    }, 15_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadStats();
      }
    };

    const handleFocus = () => {
      loadStats();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      ++statsRequestSeq.current;
      window.clearInterval(liveRefreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const visibleDays = useMemo(
    () => stats.dayStats.slice(-selectedRange),
    [stats.dayStats, selectedRange],
  );

  const maxPoints = Math.max(
    50,
    Math.ceil(Math.max(...visibleDays.map((item) => item.points), 0) / 10) * 10,
  );

  const totalPointsForDistribution =
    stats.standardPoints + stats.exactPoints + stats.bonusPoints;

  const distribution = useMemo(() => {
    const total = totalPointsForDistribution || 1;
    return [
      {
        label: "Résultats 1N2",
        value: stats.standardPoints,
        percent: Math.round((stats.standardPoints / total) * 100),
        color: "#34d399",
      },
      {
        label: "Scores exacts",
        value: stats.exactPoints,
        percent: Math.round((stats.exactPoints / total) * 100),
        color: "#a7f3d0",
      },
      {
        label: "Match bonus",
        value: stats.bonusPoints,
        percent: Math.round((stats.bonusPoints / total) * 100),
        color: "#10b981",
      },
    ];
  }, [
    stats.standardPoints,
    stats.exactPoints,
    stats.bonusPoints,
    totalPointsForDistribution,
  ]);

  const successRatePct = stats.totalPredictions
    ? Math.round(
        (stats.successfulPredictions / stats.totalPredictions) * 100,
      )
    : 0;

  // Pourcentage de scores exacts — dérivé des mêmes champs déjà calculés
  // (stats.exactScores / stats.totalPredictions), aucune nouvelle logique
  // de calcul, juste un ratio d'affichage pour le bloc "Scores exacts".
  const exactRatePct = stats.totalPredictions
    ? Math.round((stats.exactScores / stats.totalPredictions) * 100)
    : 0;

  // Colonne "Total" du tableau des dernières journées : cumul des points
  // journée après journée (somme glissante de stats.dayStats, déjà calculé
  // plus haut, dans l'ordre chronologique) — pas une nouvelle règle de
  // score, juste un total cumulé affiché en plus de la colonne "Points"
  // (qui reste le score de la seule journée concernée).
  const dayStatsWithCumulative = useMemo(() => {
    let running = 0;
    return stats.dayStats.map((day) => {
      running += day.points;
      return { ...day, cumulative: running };
    });
  }, [stats.dayStats]);

  const latestDays = [...dayStatsWithCumulative].slice(-5).reverse();

  const kpis = [
    {
      label: "Total points",
      value: stats.totalPoints,
      sub: `${stats.playedDays} journée${stats.playedDays > 1 ? "s" : ""} jouée${stats.playedDays > 1 ? "s" : ""}`,
      icon: Crosshair,
    },
    {
      label: "Scores exacts",
      value: stats.exactScores,
      sub: `${stats.totalPredictions} pronostic${stats.totalPredictions > 1 ? "s" : ""}`,
      icon: Target,
    },
    {
      label: "Bonus réussis",
      value: stats.bonusSuccessful,
      sub: `${stats.bonusPoints} point${stats.bonusPoints > 1 ? "s" : ""} bonus`,
      icon: Trophy,
    },
    {
      label: "Meilleure journée",
      value: stats.bestDay,
      sub: stats.bestDayLabel !== "—" ? stats.bestDayLabel : "Aucune donnée",
      icon: TrendingUp,
    },
  ];

  // Top joueurs : uniquement le podium (3 premiers) sur cette page — le
  // classement complet reste la page dédiée /classement (lien "Voir le
  // classement" plus bas), pas question de la reconstruire ici.
  const podium = leaderboard.slice(0, 3);

  return (
    <AppShell>
      {/* overflow-hidden retiré : depuis qu'AppShell donne à <main> une
          hauteur réellement définie (--app-vh, voir AppShell.tsx — nécessaire
          pour le Vestiaire), ce wrapper n'avait plus une hauteur "auto" qui
          grandit avec le contenu mais une hauteur fixe héritée de <main> —
          combiné à overflow-hidden, tout ce qui dépassait (Précision,
          Dernières journées, Top joueurs, Répartition, Indicateurs) était
          silencieusement DÉCOUPÉ au lieu de faire défiler la page. Rien à
          voir avec le JSX (toutes les sections étaient bien là) : c'était
          un vrai bug d'overflow, corrigé ici sans toucher au CSS pour
          "faire semblant" — la vraie cause était cette règle. */}
      <div className="relative min-h-full">

        <main className="relative z-10 mx-auto max-w-[1400px] space-y-4 px-3 pb-14 sm:space-y-5 sm:px-5 lg:px-7">
          {/* HERO — compact : plus de badges saison/J1 dupliqués depuis le
              header d'AppShell (déjà là, voir logo/Saison 2026-2027/J1•2026
              en haut de toutes les pages), juste titre + sous-titre + fond
              stade, comme demandé. */}
          <section
            className="relative overflow-hidden rounded-[22px] border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,.35)]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(2,9,20,.90) 0%, rgba(2,9,20,.52) 55%, rgba(2,9,20,.90) 100%), url('/arriere%20plan%20general.png')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_15%,rgba(52,211,153,.20),transparent_36%)]" />
            <img
              src="/logo%20ligue%201%20white.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-4 h-10 w-10 object-contain opacity-[0.08] md:h-14 md:w-14"
            />

            <div className="relative flex min-h-[110px] flex-col justify-center gap-1.5 px-5 py-5 md:min-h-[140px] md:px-8">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[.24em] text-emerald-300">
                Performance personnelle
              </div>
              <h1 className="max-w-2xl bg-gradient-to-b from-white via-white to-emerald-100/75 bg-clip-text font-display text-[28px] font-black uppercase leading-[.92] tracking-[-.02em] text-transparent md:text-5xl">
                Mes statistiques
              </h1>
              <p className="max-w-lg text-xs text-slate-300/80 md:text-sm">
                Vos performances, vos tendances, vos records.
              </p>
            </div>
          </section>

          {errorMessage && (
            <section className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-200">
              {errorMessage}
            </section>
          )}

          {/* VUE D'ENSEMBLE */}
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="font-mono text-[9px] font-semibold uppercase tracking-[.2em] text-emerald-300/80">
                  Dashboard
                </div>
                <h2 className="mt-0.5 text-base font-bold uppercase tracking-[.08em] text-white">
                  Vue d'ensemble
                </h2>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600">
                {stats.playedDays}/{stats.seasonDays} journées
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article
                    key={kpi.label}
                    className="group relative min-h-[104px] overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-3 shadow-[0_12px_30px_rgba(0,0,0,.22)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(52,211,153,.10),transparent_38%)]" />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[8px] font-semibold uppercase tracking-[.14em] text-slate-500">
                          {kpi.label}
                        </span>
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300">
                          <Icon size={12} strokeWidth={1.8} />
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <StatValue value={kpi.value} size="text-3xl md:text-[32px]" />
                      </div>
                      <div className="mt-auto pt-1.5 text-[9px] text-slate-500">
                        {kpi.sub}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* PROGRESSION */}
          <section className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_14px_40px_rgba(0,0,0,.26)] backdrop-blur-xl md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader icon={BarChart3} eyebrow="Évolution" title="Progression" />
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRange(opt.value)}
                    className={`rounded-lg px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-wider transition ${
                      selectedRange === opt.value
                        ? "border border-emerald-400/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,.30)]"
                        : "border border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {opt.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-[190px]">
              {visibleDays.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center">
                  <span className="font-display text-base font-black uppercase tracking-wide text-white md:text-lg">
                    Ta saison commence maintenant 🔥
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                    Reviens ici après ta première journée pronostiquée !
                  </span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
                    {Array.from({ length: 5 }, (_, index) =>
                      Math.round((maxPoints / 4) * (4 - index)),
                    ).map((value) => (
                      <div key={value} className="flex items-center gap-2.5">
                        <span className="w-5 text-right text-[8px] text-slate-600">
                          {value}
                        </span>
                        <div className="h-px flex-1 bg-white/[0.045]" />
                      </div>
                    ))}
                  </div>

                  <div className="absolute left-9 right-2 top-0 bottom-8">
                    <svg
                      viewBox="0 0 500 180"
                      className="absolute inset-0 size-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="statsLineGreen" x1="0" x2="1">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#a7f3d0" />
                        </linearGradient>
                        <linearGradient id="statsFillGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity=".18" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                        </linearGradient>
                        <filter id="statsGlowGreen" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="2.4" result="blur" />
                        </filter>
                      </defs>

                      {(() => {
                        const width = 500;
                        const height = 180;
                        const step =
                          visibleDays.length === 1 ? 0 : width / (visibleDays.length - 1);

                        const points = visibleDays.map((item, index) => ({
                          x: index * step,
                          y: height - (item.points / Math.max(maxPoints, 1)) * height,
                        }));

                        const linePath = points
                          .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
                          .join(" ");

                        const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

                        return (
                          <>
                            <path d={areaPath} fill="url(#statsFillGreen)" />
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#34d399"
                              strokeWidth="7"
                              opacity=".22"
                              filter="url(#statsGlowGreen)"
                              vectorEffect="non-scaling-stroke"
                            />
                            <path
                              d={linePath}
                              fill="none"
                              stroke="url(#statsLineGreen)"
                              strokeWidth="2.5"
                              vectorEffect="non-scaling-stroke"
                            />
                          </>
                        );
                      })()}
                    </svg>

                    {visibleDays.map((item, index) => {
                      const left =
                        visibleDays.length === 1 ? 50 : (index / (visibleDays.length - 1)) * 100;
                      const top = 100 - (item.points / maxPoints) * 100;

                      return (
                        <div
                          key={item.day}
                          className="absolute"
                          style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
                        >
                          <div className="mb-1.5 -translate-y-4 text-center text-[11px] font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.85)]">
                            {item.points}
                          </div>
                          <div className="size-2.5 rounded-full border-2 border-[#07111c] bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,.85)]" />
                        </div>
                      );
                    })}

                    <div className="absolute -bottom-6 inset-x-0 flex justify-between">
                      {visibleDays.map((item) => (
                        <span key={item.day} className="text-[9px] font-semibold text-slate-400">
                          {item.day}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* PRÉCISION — une seule section, deux blocs compacts côte à côte
              (plus deux grandes cartes verticales séparées comme avant). */}
          <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_14px_40px_rgba(0,0,0,.26)] backdrop-blur-xl md:p-5">
            <SectionHeader icon={Crosshair} eyebrow="Analyse" title="Précision" />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.05] bg-black/15 px-3 py-4">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[.14em] text-slate-500">
                  <Crosshair size={11} className="text-emerald-300" /> Régularité
                </div>
                <div
                  className="relative flex size-20 items-center justify-center rounded-full md:size-24"
                  style={{
                    background: `conic-gradient(#34d399 ${successRatePct * 3.6}deg, rgba(255,255,255,.06) ${successRatePct * 3.6}deg 360deg)`,
                  }}
                >
                  <div className="flex size-[62px] flex-col items-center justify-center rounded-full border border-white/[0.05] bg-[#06101b] md:size-[76px]">
                    <span className="text-lg font-black text-white md:text-xl">
                      {successRatePct}%
                    </span>
                    <span className="mt-0.5 font-mono text-[6px] uppercase tracking-[.16em] text-slate-500">
                      réussite
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-center text-[10px] font-semibold text-white">
                  {stats.successfulPredictions} réussis / {stats.totalPredictions} joués
                </div>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-white/[0.05] bg-black/15 px-3 py-4">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[.14em] text-slate-500">
                  <Target size={11} className="text-emerald-300" /> Scores exacts
                </div>
                <div
                  className="relative flex size-20 items-center justify-center rounded-full md:size-24"
                  style={{
                    background: `conic-gradient(#a7f3d0 ${exactRatePct * 3.6}deg, rgba(255,255,255,.06) ${exactRatePct * 3.6}deg 360deg)`,
                  }}
                >
                  <div className="flex size-[62px] flex-col items-center justify-center rounded-full border border-white/[0.05] bg-[#06101b] md:size-[76px]">
                    <span className="text-lg font-black text-white md:text-xl">
                      {stats.exactScores}
                    </span>
                    <span className="mt-0.5 font-mono text-[6px] uppercase tracking-[.16em] text-slate-500">
                      exacts
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-center text-[10px] font-semibold text-white">
                  {stats.exactScores} score{stats.exactScores > 1 ? "s" : ""} exact{stats.exactScores > 1 ? "s" : ""}
                  <div className="mt-0.5 text-[9px] font-normal text-slate-500">
                    sur {stats.totalPredictions} pronostic{stats.totalPredictions > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* VOS DERNIÈRES JOURNÉES */}
          <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] shadow-[0_14px_40px_rgba(0,0,0,.26)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
              <SectionHeader icon={CalendarDays} eyebrow="Historique" title="Vos dernières journées" />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300"
              >
                Voir toutes les journées
                <ChevronRight size={12} />
              </button>
            </div>

            <div className="overflow-x-auto px-4 pb-4 md:px-5 md:pb-5">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[.7fr_1fr_1fr_1fr_1fr] gap-3 border-b border-white/[0.07] px-3 pb-2 pt-3 font-mono text-[8px] font-semibold uppercase tracking-[.15em] text-slate-600">
                  <span>Journée</span>
                  <span>Points</span>
                  <span>Exacts</span>
                  <span>Bonus</span>
                  <span>Total</span>
                </div>

                <div className="divide-y divide-white/[0.05]">
                  {latestDays.length === 0 ? (
                    <div className="px-3 py-7 text-center">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                        Pas encore de journée terminée
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        Joue ta première journée pour voir tes stats ici !
                      </div>
                    </div>
                  ) : (
                    latestDays.map((day) => (
                      <div
                        key={day.day}
                        className="grid grid-cols-[.7fr_1fr_1fr_1fr_1fr] items-center gap-3 px-3 py-3"
                      >
                        <span className="font-bold text-white">{day.day}</span>
                        <span className="font-black text-emerald-300">{day.points} pts</span>
                        <span className="text-sm text-slate-300">{day.exactScores}</span>
                        <span className="text-sm text-slate-300">{day.bonusPoints} pts</span>
                        <span className="text-sm font-semibold text-white">{day.cumulative} pts</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* TOP JOUEURS — uniquement le podium (3 premiers), le classement
              complet reste sur /classement (jamais reconstruit ici). */}
          <section className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_14px_40px_rgba(0,0,0,.26)] backdrop-blur-xl md:p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,.08),transparent_38%)]" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <SectionHeader icon={Trophy} eyebrow="Classement" title="Top joueurs" />
                <Link
                  to="/classement"
                  className="inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[.16em] text-emerald-300/80 transition hover:text-emerald-300"
                >
                  Voir le classement <ChevronRight size={11} />
                </Link>
              </div>

              {podium.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-black/15 px-5 py-8 text-center font-mono text-[9px] uppercase tracking-widest text-slate-600">
                  Classement indisponible pour le moment
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {podium.map((player, index) => (
                    <PodiumPlayer
                      key={player.userId}
                      player={player}
                      place={(index + 1) as 1 | 2 | 3}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RÉPARTITION DES POINTS */}
          <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_14px_40px_rgba(0,0,0,.26)] backdrop-blur-xl md:p-5">
            <SectionHeader icon={PieChart} eyebrow="Répartition" title="Répartition des points" />

            <div className="grid items-center gap-5 md:grid-cols-[150px_1fr]">
              <div
                className="relative mx-auto flex size-32 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(
                    #34d399 0deg ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                    #a7f3d0 ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                    #10b981 ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg 360deg
                  )`,
                }}
              >
                <div className="flex size-24 flex-col items-center justify-center rounded-full border border-white/[0.05] bg-[#06101b]">
                  <span className="text-2xl font-black text-white">{stats.totalPoints}</span>
                  <span className="mt-0.5 font-mono text-[7px] uppercase tracking-widest text-slate-500">
                    points
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {distribution.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/[0.05] bg-black/15 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full shadow-[0_0_10px_rgba(52,211,153,.45)]"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-xs font-medium text-slate-300">{item.label}</span>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-white">{item.value} pts</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-emerald-400/70"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span className="font-mono text-[8px] text-slate-600">{item.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* INDICATEURS FINAUX — uniquement basés sur les données existantes */}
          <section className="grid gap-2.5 sm:grid-cols-2">
            <article className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.035] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={15} className="text-emerald-300" />
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[.18em] text-emerald-300/70">
                    Dernière tendance
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    {stats.playedDays
                      ? `${stats.dayStats[stats.dayStats.length - 1]?.day || "—"} : ${stats.dayStats[stats.dayStats.length - 1]?.points || 0} points`
                      : "Pas encore de données"}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Crosshair size={15} className="text-emerald-300" />
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[.18em] text-slate-600">
                    Moyenne / journée
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    {stats.average.toFixed(2)} points
                  </div>
                </div>
              </div>
            </article>
          </section>
        </main>
      </div>
    </AppShell>
  );
}