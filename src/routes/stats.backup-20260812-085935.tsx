import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/prono/AppShell";
import {
  Activity,
  Award,
  BarChart3,
  Crosshair,
  PieChart,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/stats/backup-20260812-085935")({
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
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  // Vraie colonne de `matches` (confirmée via le schéma Supabase réel) :
  // identifie les 4 matchs bonus (un par championnat PL/PD/SA/BL1) proposés
  // à la journée. Aucune colonne équivalente n'existe sur `predictions` —
  // voir isBonusPrediction ci-dessous.
  is_bonus: boolean | null;
};

type PredictionRow = {
  match_id: string;
  points: number | null;
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
};

// Sélecteur de plage du graphique d'évolution — 3 options sobres plutôt que
// la liste dynamique précédente (présentation uniquement, la donnée
// affichée reste `stats.dayStats`, calcul inchangé).
const RANGE_OPTIONS = [
  { value: 5, label: "5 journées" },
  { value: 10, label: "10 journées" },
  { value: 34, label: "Saison" },
];

// Chiffre principal d'une carte statistique : blanc, dégradé très léger,
// glow discret assorti à la carte — même principe que la Gazette (StatValue)
// pour rester cohérent avec la nouvelle direction artistique du site.
function StatValue({
  value,
  accent = "cyan",
  size = "text-4xl md:text-[40px]",
}: {
  value: string | number;
  accent?: "cyan" | "emerald";
  size?: string;
}) {
  const glow =
    accent === "emerald"
      ? "drop-shadow(0 0 16px rgba(110,231,183,.35))"
      : "drop-shadow(0 0 16px rgba(96,165,250,.32))";
  return (
    <span
      className={`bg-gradient-to-b from-white to-white/85 bg-clip-text font-display ${size} font-black leading-none text-transparent`}
      style={{ filter: glow }}
    >
      {value}
    </span>
  );
}

function StatsPage() {
  const [stats, setStats] = useState<StatsState>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(5);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadStats() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setStats(EMPTY_STATS);
        setErrorMessage("Connecte-toi pour afficher tes statistiques personnelles.");
        return;
      }

      const [
        { data: matches, error: matchesError },
        { data: predictions, error: predictionsError },
      ] = await Promise.all([
        supabase
          .from("matches")
          .select("id, matchday, status, home_score, away_score, is_bonus")
          .eq("status", "finished"),
        supabase
          .from("predictions")
          .select("match_id, points, home_prediction, away_prediction")
          .eq("user_id", user.id),
      ]);

      if (matchesError) throw matchesError;
      if (predictionsError) throw predictionsError;

      const finishedMatches = (matches || []) as MatchRow[];
      const userPredictions = (predictions || []) as PredictionRow[];

      const matchDayById = new Map<string, string>();
      const matchById = new Map<string, MatchRow>();
      finishedMatches.forEach((match) => {
        matchById.set(String(match.id), match);
        if (match.matchday) {
          matchDayById.set(String(match.id), String(match.matchday));
        }
      });

      const byDay = new Map<string, DayStat>();

      let totalPoints = 0;
      let exactScores = 0;
      let totalPredictions = 0;
      let successfulPredictions = 0;
      let standardPoints = 0;
      let exactPoints = 0;
      let bonusPoints = 0;

      userPredictions.forEach((prediction) => {
        const day = matchDayById.get(String(prediction.match_id));
        if (!day) return;

        const points = Number(prediction.points || 0);
        const match = matchById.get(String(prediction.match_id));
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

        totalPoints += points;
        totalPredictions += 1;

        if (points > 0) successfulPredictions += 1;
        if (exact) exactScores += 1;

        // Exclusive breakdown so the donut always totals exactly totalPoints.
        if (bonus) {
          current.bonusPoints += points;
          bonusPoints += points;
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
          Number(b.day.replace(/\D/g, ""))
      );

      const playedDays = dayStats.length;
      const average = playedDays ? totalPoints / playedDays : 0;
      const bestDayEntry =
        dayStats.reduce<DayStat | null>(
          (best, item) => (!best || item.points > best.points ? item : best),
          null
        );

      // "Victoires / Nuls / Défaites" are performance states for each
      // completed matchday, based on the player's own average.
      const epsilon = 0.0001;
      const wins = dayStats.filter(
        (item) => item.points > average + epsilon
      ).length;
      const draws = dayStats.filter(
        (item) => Math.abs(item.points - average) <= epsilon
      ).length;
      const losses = Math.max(0, playedDays - wins - draws);

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
      });
    } catch (error: any) {
      console.error("Erreur chargement statistiques:", error);
      setErrorMessage(
        error?.message ||
          "Impossible de charger les statistiques depuis Supabase."
      );
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadStats();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const visibleDays = useMemo(() => {
    return stats.dayStats.slice(-selectedRange);
  }, [stats.dayStats, selectedRange]);

  const maxPoints = Math.max(
    50,
    Math.ceil(
      Math.max(...visibleDays.map((item) => item.points), 0) / 10
    ) * 10
  );

  const totalPointsForDistribution =
    stats.standardPoints + stats.exactPoints + stats.bonusPoints;

  const distribution = useMemo(() => {
    const total = totalPointsForDistribution || 1;

    return [
      {
        label: "Résultats L1 / autres",
        value: stats.standardPoints,
        color: "cyan",
        percent: Math.round((stats.standardPoints / total) * 100),
      },
      {
        label: "Scores exacts",
        value: stats.exactPoints,
        color: "green",
        percent: Math.round((stats.exactPoints / total) * 100),
      },
      {
        label: "Match bonus",
        value: stats.bonusPoints,
        color: "blue",
        percent: Math.round((stats.bonusPoints / total) * 100),
      },
    ];
  }, [
    stats.standardPoints,
    stats.exactPoints,
    stats.bonusPoints,
    totalPointsForDistribution,
  ]);

  // Les 4 statistiques principales — même identité visuelle pour les 4
  // (voir StatValue), le vert n'accentue que la carte "record" (valeur
  // positive par nature).
  const kpis = [
    {
      label: "Total points",
      value: stats.totalPoints,
      sub: `${stats.playedDays} journée${stats.playedDays > 1 ? "s" : ""} jouée${stats.playedDays > 1 ? "s" : ""}`,
      icon: Crosshair,
      accent: "cyan" as const,
    },
    {
      label: "Moyenne / journée",
      value: stats.average.toFixed(2),
      sub: "Points par journée",
      icon: BarChart3,
      accent: "cyan" as const,
    },
    {
      label: "Scores exacts",
      value: stats.exactScores,
      sub: `Sur ${stats.totalPredictions} pronostic${stats.totalPredictions > 1 ? "s" : ""}`,
      icon: Target,
      accent: "cyan" as const,
    },
    {
      label: "Meilleure journée",
      value: stats.bestDay,
      sub: stats.bestDayLabel !== "—" ? stats.bestDayLabel : "Aucune donnée",
      icon: Trophy,
      accent: "emerald" as const,
    },
  ];

  // Records personnels — uniquement des valeurs déjà calculées par
  // loadStats ci-dessus (aucune nouvelle métrique inventée).
  const records = [
    {
      label: "Meilleure journée",
      value: stats.bestDay,
      unit: "pts",
      sub: stats.bestDayLabel !== "—" ? stats.bestDayLabel : undefined,
    },
    { label: "Scores exacts", value: stats.exactScores },
    { label: "Moyenne / journée", value: stats.average.toFixed(2), unit: "pts" },
    {
      label: "Journées jouées",
      value: stats.playedDays,
      sub: `sur ${stats.seasonDays}`,
    },
  ];

  // Taux de réussite et tendance de la dernière journée : dérivés en
  // affichage uniquement à partir de stats déjà calculées (successful/total
  // Predictions, dayStats, average) — même principe que `distribution`
  // ci-dessus, aucun nouveau calcul métier.
  const successRatePct = stats.totalPredictions
    ? Math.round((stats.successfulPredictions / stats.totalPredictions) * 100)
    : 0;

  const lastDay = stats.dayStats[stats.dayStats.length - 1];
  const trend = useMemo(() => {
    if (!lastDay) return { label: "Pas encore de données", tone: "text-slate-500" };
    const epsilon = 0.0001;
    if (lastDay.points > stats.average + epsilon) {
      return { label: "Au-dessus de ta moyenne", tone: "text-emerald-300" };
    }
    if (Math.abs(lastDay.points - stats.average) <= epsilon) {
      return { label: "Dans ta moyenne", tone: "text-cyan-300" };
    }
    return { label: "En dessous de ta moyenne", tone: "text-slate-300" };
  }, [lastDay, stats.average]);

  const regularityTotal = Math.max(1, stats.playedDays);

  return (
    <AppShell>
      <div className="relative min-h-full overflow-hidden bg-[#020914]">
        <main className="relative z-10 mx-auto max-w-[1400px] space-y-7 px-3 pb-16 sm:px-5 lg:px-7">
          {/* HERO — compact, une seule présence discrète du logo Ligue 1 */}
          <section
            className="relative overflow-hidden rounded-[22px] border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,.3)]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(2,9,20,.95) 0%, rgba(2,9,20,.90) 55%, rgba(2,9,20,.96) 100%), url('/page%20statistique%20bloc%20stat.png')",
              backgroundPosition: "center center",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
            }}
          >
            {/* Filigrane discret, coin opposé au label "Saison 2026-2027"
                pour ne jamais chevaucher le texte du hero. */}
            <img
              src="/logo%20ligue%201%20white.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 right-4 h-11 w-11 object-contain opacity-[0.05] md:h-14 md:w-14"
            />

            <div className="relative flex min-h-[132px] flex-col justify-center gap-2.5 px-6 py-6 md:min-h-[152px] md:px-9">
              <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" />
                Saison en cours
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <h1
                  className="bg-gradient-to-b from-white via-white to-[color-mix(in_oklab,var(--sky)_32%,white)] bg-clip-text font-display text-3xl font-black uppercase leading-none tracking-[-0.02em] text-transparent md:text-5xl"
                  style={{
                    filter:
                      "drop-shadow(0 1px 0 rgba(0,0,0,.35)) drop-shadow(0 0 18px rgba(22,82,240,.16))",
                  }}
                >
                  Mes statistiques
                </h1>

                <span className="hidden font-mono text-[9px] uppercase tracking-[.2em] text-slate-500 sm:block">
                  Saison 2026–2027
                </span>
              </div>

              <p className="max-w-md text-sm text-slate-400">
                Tes performances au fil de la saison.
              </p>
            </div>
          </section>

          {errorMessage && (
            <section className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-5 py-3 text-xs text-red-200">
              {errorMessage}
            </section>
          )}

          {/* 4 STATISTIQUES PRINCIPALES — même identité visuelle */}
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const ring =
                kpi.accent === "emerald"
                  ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300"
                  : "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-300";

              return (
                <article
                  key={kpi.label}
                  className="relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060d18] p-5 shadow-[0_14px_36px_rgba(0,0,0,.25)]"
                >
                  <div
                    className={`mb-4 inline-flex size-9 items-center justify-center rounded-xl border ${ring}`}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">
                    {kpi.label}
                  </div>
                  <div className="mt-1.5">
                    <StatValue value={kpi.value} accent={kpi.accent} />
                  </div>
                  <div className="mt-2 truncate text-[11px] text-slate-500">
                    {kpi.sub}
                  </div>
                </article>
              );
            })}
          </section>

          {/* LIGNE 1 — Évolution des points / Répartition des points */}
          <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <article
              id="stats-evolution"
              className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#060d18] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)] md:p-7"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <BarChart3 size={16} />
                  <h2 className="text-sm font-semibold uppercase tracking-[.18em] text-white">
                    Évolution des points
                  </h2>
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-1">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedRange(opt.value)}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition ${
                        selectedRange === opt.value
                          ? "bg-cyan-400/15 text-cyan-300"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative z-10 h-[260px] flex-1">
                {visibleDays.length === 0 && (
                  // Centré sur la même zone que la grille/le graphique
                  // (top-0 bottom-8), pas sur toute la hauteur de la carte —
                  // sinon le message paraît décalé vers le bas à cause de la
                  // bande réservée aux libellés de journées.
                  <div className="absolute inset-x-0 top-0 bottom-8 z-20 flex items-center justify-center">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                      Pas encore de données
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
                  {Array.from({ length: 6 }, (_, index) =>
                    Math.round((maxPoints / 5) * (5 - index))
                  ).map((value) => (
                    <div key={value} className="flex items-center gap-3">
                      <span className="w-5 text-right text-[9px] text-slate-600">
                        {value}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.04]" />
                    </div>
                  ))}
                </div>

                <div className="absolute left-10 right-3 top-0 bottom-8">
                  <svg
                    viewBox="0 0 500 220"
                    className="absolute inset-0 h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="statsLine" x1="0" x2="1">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                      <linearGradient id="statsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity=".16" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                      </linearGradient>
                      <filter id="statsLineGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.4" result="blur" />
                      </filter>
                    </defs>

                    {visibleDays.length > 0 && (() => {
                      const width = 500;
                      const height = 220;
                      const step =
                        visibleDays.length === 1
                          ? 0
                          : width / (visibleDays.length - 1);

                      const points = visibleDays.map((item, index) => {
                        const x = index * step;
                        const y =
                          height - (item.points / Math.max(maxPoints, 1)) * height;
                        return { x, y };
                      });

                      const linePath = points
                        .map((point, index) =>
                          `${index === 0 ? "M" : "L"}${point.x} ${point.y}`
                        )
                        .join(" ");

                      const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

                      return (
                        <>
                          <path d={areaPath} fill="url(#statsFill)" />
                          <path
                            d={linePath}
                            fill="none"
                            stroke="url(#statsLine)"
                            strokeWidth="6"
                            opacity=".25"
                            filter="url(#statsLineGlow)"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d={linePath}
                            fill="none"
                            stroke="url(#statsLine)"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      );
                    })()}
                  </svg>

                  {visibleDays.map((item, index) => {
                    const left =
                      visibleDays.length === 1
                        ? 50
                        : (index / (visibleDays.length - 1)) * 100;
                    const top = 100 - (item.points / maxPoints) * 100;
                    const isLast = index === visibleDays.length - 1;

                    return (
                      <div
                        key={item.day}
                        className="absolute"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="mb-2 -translate-y-5 text-center text-xs font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.85)]">
                          {item.points}
                        </div>
                        <div
                          className={`rounded-full border-2 border-[#060d18] ${
                            isLast
                              ? "h-3.5 w-3.5 bg-white shadow-[0_0_16px_rgba(255,255,255,.85)]"
                              : "h-3 w-3 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.75)]"
                          }`}
                        />
                      </div>
                    );
                  })}

                  <div className="absolute -bottom-7 inset-x-0 flex justify-between">
                    {visibleDays.map((item) => (
                      <span
                        key={item.day}
                        className="text-[10px] font-semibold text-slate-400"
                      >
                        {item.day}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#060d18] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)] md:p-7">
              <div className="mb-6 flex items-center gap-2 text-cyan-300">
                <PieChart size={16} />
                <h2 className="text-sm font-semibold uppercase tracking-[.18em] text-white">
                  Répartition des points
                </h2>
              </div>

              <div className="flex flex-1 flex-col items-center gap-7 sm:flex-row sm:items-center">
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full p-3"
                  style={{
                    background: `conic-gradient(
                      #22d3ee 0deg ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                      #34d399 ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                      #3b82f6 ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg 360deg
                    )`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#060d18]">
                    <span className="text-2xl font-black text-white">
                      {stats.totalPoints}
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                      pts
                    </span>
                  </div>
                </div>

                <div className="w-full flex-1 space-y-3.5">
                  {distribution.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            item.color === "cyan"
                              ? "bg-cyan-400"
                              : item.color === "green"
                                ? "bg-emerald-400"
                                : "bg-blue-500"
                          }`}
                        />
                        <span className="truncate text-xs text-slate-300">
                          {item.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-white">
                        {item.value}{" "}
                        <span className="text-slate-500">· {item.percent}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">
                  Total
                </span>
                <span className="text-xl font-black text-white">
                  {stats.totalPoints}{" "}
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    pts
                  </span>
                </span>
              </div>
            </article>
          </section>

          {/* LIGNE 2 — Records personnels / Performance */}
          <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <article className="flex h-full flex-col rounded-[22px] border border-white/[0.08] bg-[#060d18] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)] md:p-7">
              <div className="mb-6 flex items-center gap-2 text-cyan-300">
                <Award size={16} />
                <h2 className="text-sm font-semibold uppercase tracking-[.18em] text-white">
                  Records personnels
                </h2>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-7">
                {records.map((record) => (
                  <div key={record.label}>
                    <div className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">
                      {record.label}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white">
                        {record.value}
                      </span>
                      {record.unit && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          {record.unit}
                        </span>
                      )}
                    </div>
                    {record.sub && (
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {record.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>

            <article className="flex h-full flex-col rounded-[22px] border border-white/[0.08] bg-[#060d18] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)] md:p-7">
              <div className="mb-6 flex items-center gap-2 text-cyan-300">
                <Activity size={16} />
                <h2 className="text-sm font-semibold uppercase tracking-[.18em] text-white">
                  Performance
                </h2>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-6">
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">
                      Régularité
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {stats.playedDays} journée{stats.playedDays > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${(stats.wins / regularityTotal) * 100}%` }}
                    />
                    <div
                      className="bg-cyan-400/60"
                      style={{ width: `${(stats.draws / regularityTotal) * 100}%` }}
                    />
                    <div
                      className="bg-white/15"
                      style={{ width: `${(stats.losses / regularityTotal) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                    <span>{stats.wins} au-dessus</span>
                    <span>{stats.draws} dans la moyenne</span>
                    <span>{stats.losses} en dessous</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">
                    Taux de réussite
                  </span>
                  <span className="text-lg font-black text-white">
                    {successRatePct}%
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">
                    Dernière journée
                  </span>
                  <span className={`text-xs font-semibold ${trend.tone}`}>
                    {trend.label}
                  </span>
                </div>
              </div>
            </article>
          </section>
        </main>
      </div>
    </AppShell>
  );
}
