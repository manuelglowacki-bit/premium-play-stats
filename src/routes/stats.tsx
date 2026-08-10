import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/prono/AppShell";
import {
  BarChart3,
  CalendarDays,
  Crosshair,
  Minus,
  Trophy,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type Supporter = {
  team: string;
  count: number;
};

type MatchRow = {
  id: string;
  matchday: string | null;
  status: string | null;
};

type PredictionRow = {
  match_id: string;
  points: number | null;
  exact_score: boolean | null;
  bonus_used: boolean | null;
};

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

function StatsPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [stats, setStats] = useState<StatsState>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(5);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");

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

      setUserEmail(user.email || "");

      const [
        { data: matches, error: matchesError },
        { data: predictions, error: predictionsError },
        { data: supportersData, error: supportersError },
      ] = await Promise.all([
        supabase
          .from("matches")
          .select("id, matchday, status")
          .eq("status", "finished"),
        supabase
          .from("predictions")
          .select("match_id, points, exact_score, bonus_used")
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("favorite_team")
          .not("favorite_team", "is", null),
      ]);

      if (matchesError) throw matchesError;
      if (predictionsError) throw predictionsError;

      const finishedMatches = (matches || []) as MatchRow[];
      const userPredictions = (predictions || []) as PredictionRow[];

      const matchDayById = new Map<string, string>();
      finishedMatches.forEach((match) => {
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
        const exact = Boolean(prediction.exact_score);
        const bonus = Boolean(prediction.bonus_used);

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

      if (!supportersError && supportersData) {
        const counts: Record<string, number> = {};

        supportersData.forEach((row: { favorite_team: string | null }) => {
          if (row.favorite_team) {
            counts[row.favorite_team] =
              (counts[row.favorite_team] || 0) + 1;
          }
        });

        setSupporters(
          Object.entries(counts)
            .map(([team, count]) => ({ team, count }))
            .sort((a, b) => b.count - a.count)
        );
      }
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

  const progress = Math.min(
    100,
    Math.round((stats.playedDays / stats.seasonDays) * 100)
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

  const metrics = [
    {
      label: "Points total",
      value: stats.totalPoints,
      sub: stats.bestDay
        ? `Meilleur score : ${stats.bestDay} pts`
        : "Aucune journée",
      icon: Crosshair,
      tone: "violet",
    },
    {
      label: "Moyenne / journée",
      value: stats.average.toFixed(2),
      sub: `Sur ${stats.playedDays} journées`,
      icon: TrendingUp,
      tone: "green",
    },
    {
      label: "Victoires",
      value: stats.wins,
      sub: `${stats.playedDays ? Math.round((stats.wins / stats.playedDays) * 100) : 0}% des journées`,
      icon: Trophy,
      tone: "cyan",
    },
    {
      label: "Nuls",
      value: stats.draws,
      sub: `${stats.playedDays ? Math.round((stats.draws / stats.playedDays) * 100) : 0}% des journées`,
      icon: Minus,
      tone: "blue",
    },
    {
      label: "Défaites",
      value: stats.losses,
      sub: `${stats.playedDays ? Math.round((stats.losses / stats.playedDays) * 100) : 0}% des journées`,
      icon: X,
      tone: "violet",
    },
  ];

  // `supporters` est trié par count décroissant (voir loadStats) : le
  // premier élément porte donc le maximum, utilisé pour calibrer la largeur
  // relative des barres de la section "Communauté".
  const maxSupporter = supporters[0]?.count || 1;

  return (
    <AppShell>
      <div className="relative min-h-full overflow-hidden bg-[#020914]">
        <main className="relative z-10 mx-auto max-w-[1500px] space-y-5 px-3 pb-20 sm:px-5 lg:px-7">
          {/* HERO */}
          <section
            className="relative min-h-[330px] overflow-hidden rounded-[28px] border border-white/[0.09] shadow-[0_25px_80px_rgba(0,0,0,.22)] md:min-h-[390px]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(3,12,24,.17) 0%, rgba(3,12,24,.08) 52%, rgba(3,12,24,.19) 100%), url('/page%20statistique%20bloc%20stat.png')",
              backgroundPosition: "center center",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(34,211,238,.05),transparent_25%),radial-gradient(circle_at_68%_50%,rgba(16,185,129,.08),transparent_35%)]" />

            <div className="relative flex min-h-[330px] flex-col justify-center px-7 py-8 md:min-h-[390px] md:px-10 lg:px-12">
              <div className="max-w-[780px]">
                <div className="mb-5 flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.34em] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.9)]" />
                  Saison en cours
                </div>

                <h1 className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-[48px] font-medium leading-[0.95] tracking-[-0.045em] text-transparent sm:text-6xl md:text-7xl lg:text-[78px]">
                  Mes statistiques
                </h1>

                <div className="mt-5 h-px w-12 bg-gradient-to-r from-emerald-400 to-cyan-400" />

                <p className="mt-5 max-w-[620px] text-sm leading-6 text-slate-200/90 md:text-[16px]">
                  Tes performances, tes tendances et tes records
                  <span className="text-emerald-300"> réunis </span>
                  dans un seul espace.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("stats-evolution")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-md transition hover:border-emerald-300/60 hover:bg-emerald-400/[0.12]"
                  >
                    <BarChart3 size={14} />
                    Performance
                  </button>
                  <button
                    type="button"
                    onClick={loadStats}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/[0.05] px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200 backdrop-blur-md transition hover:border-blue-300/60 hover:bg-blue-500/[0.10] disabled:cursor-wait disabled:opacity-60"
                  >
                    <CalendarDays size={14} />
                    {loading ? "Actualisation..." : "Saison 2026–2027"}
                  </button>
                </div>
              </div>

              <div className="absolute bottom-7 right-7 hidden items-end gap-5 xl:flex">
                <div className="pb-2 text-right">
                  <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-slate-300/60">
                    Record actuel
                  </div>
                  <div className="mt-1 flex items-baseline justify-end gap-2">
                    <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-6xl font-black text-transparent">
                      {stats.bestDay}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">
                      pts · {stats.bestDayLabel}
                    </span>
                  </div>
                </div>

                <div className="w-[205px] rounded-[22px] border border-emerald-400/25 bg-[#04121a]/85 p-4 shadow-[0_0_45px_rgba(16,185,129,.10)] backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-emerald-300">
                      Analyse
                    </span>
                    <BarChart3 size={15} className="text-emerald-300" />
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-4xl font-black text-white">
                      {String(stats.playedDays).padStart(2, "0")}
                    </span>
                    <span className="pb-1 font-mono text-[8px] uppercase tracking-wider text-emerald-300">
                      journées
                    </span>
                  </div>

                  <div className="mt-1 font-mono text-[8px] uppercase tracking-wider text-slate-400">
                    analysées
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 shadow-[0_0_14px_rgba(52,211,153,.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between font-mono text-[7px] uppercase tracking-wider text-slate-500">
                    <span>Progression saison</span>
                    <span className="text-emerald-300">{progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {errorMessage && (
            <section className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-5 py-3 text-xs text-red-200">
              {errorMessage}
            </section>
          )}

          {/* METRICS STRIP — PREMIUM */}
          <section className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#07101c]/78 shadow-[0_24px_70px_rgba(0,0,0,.24)] backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_50%,rgba(139,92,246,.06),transparent_22%),radial-gradient(circle_at_50%_50%,rgba(34,211,238,.035),transparent_28%),radial-gradient(circle_at_88%_50%,rgba(16,185,129,.045),transparent_22%)]"
            />

            {loading && (
              <div className="absolute right-4 top-3 z-20 font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-300">
                Synchronisation Supabase…
              </div>
            )}

            <div className="relative grid grid-cols-1 overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-5"
                style={{
                  background:
                    "radial-gradient(circle at 10% 50%, rgba(139,92,246,.10), transparent 20%), radial-gradient(circle at 30% 50%, rgba(16,185,129,.09), transparent 20%), radial-gradient(circle at 50% 50%, rgba(34,211,238,.09), transparent 20%), radial-gradient(circle at 70% 50%, rgba(59,130,246,.09), transparent 20%), radial-gradient(circle at 90% 50%, rgba(168,85,247,.10), transparent 20%)",
                }}
              />
              {metrics.map((metric, index) => {
                const Icon = metric.icon;

                const accent =
                  metric.tone === "green"
                    ? {
                        ring: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300",
                        glow: "bg-emerald-400",
                        line: "from-emerald-400 to-cyan-400",
                        value: "text-emerald-300",
                      }
                    : metric.tone === "cyan"
                      ? {
                          ring: "border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300",
                          glow: "bg-cyan-400",
                          line: "from-cyan-400 to-blue-500",
                          value: "text-cyan-300",
                        }
                      : metric.tone === "blue"
                        ? {
                            ring: "border-blue-400/25 bg-blue-400/[0.07] text-blue-300",
                            glow: "bg-blue-400",
                            line: "from-blue-400 to-indigo-500",
                            value: "text-blue-300",
                          }
                        : {
                            ring: "border-violet-400/25 bg-violet-400/[0.07] text-violet-300",
                            glow: "bg-violet-400",
                            line: "from-violet-400 to-fuchsia-400",
                            value: "text-violet-300",
                          };

                const backgroundPosition =
                  index === 0
                    ? "left center"
                    : index === 1
                      ? "25% center"
                      : index === 2
                        ? "50% center"
                        : index === 3
                          ? "75% center"
                          : "right center";

                return (
                  <div
                    key={metric.label}
                    className={`group relative min-h-[184px] overflow-hidden bg-[#06101b] px-6 py-7 transition-all duration-300 hover:brightness-110 sm:px-7 ${
                      index > 0 ? "border-l border-white/[0.08]" : ""
                    } ${index === 2 ? "col-span-2 lg:col-span-1" : ""}`}
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(3,10,20,.12), rgba(3,10,20,.12)), url('/bloc%20performance%20de%20la%20saison.png')",
                      backgroundPosition,
                      backgroundSize: "500% 100%",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-black/[0.06]" />
                    <div
                      className={`absolute left-0 right-0 top-0 h-px bg-gradient-to-r ${accent.line} opacity-0 transition-opacity duration-300 group-hover:opacity-80`}
                    />

                    <div className="relative z-10 flex h-full items-center gap-5">
                      <div className="relative shrink-0">
                        <div
                          className={`absolute inset-0 scale-125 rounded-full ${accent.glow} opacity-10 blur-xl`}
                        />
                        <div
                          className={`relative flex h-[58px] w-[58px] items-center justify-center rounded-2xl border ${accent.ring} shadow-[inset_0_0_20px_rgba(255,255,255,.025)]`}
                        >
                          <Icon size={23} strokeWidth={1.8} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            {metric.label}
                          </span>
                          <span
                            className={`hidden h-1 w-1 rounded-full ${accent.glow} shadow-[0_0_8px_currentColor] sm:block`}
                          />
                        </div>

                        <div className="mt-1 flex items-baseline gap-2">
                          <span
                            className={`text-[39px] font-semibold leading-none tracking-[-0.045em] text-white`}
                          >
                            {metric.value}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                          <span
                            className={`h-1 w-1 rounded-full ${accent.glow}`}
                          />
                          <span>{metric.sub}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </section>

          {/* CHART + DONUT */}
          <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            {/* évolution */}
            <article
              id="stats-evolution"
              className="relative overflow-hidden rounded-[24px] border border-white/[0.10] p-5 shadow-[0_24px_70px_rgba(0,0,0,.35)] md:p-7"
            >
              <img
                src="/evolutions des points.jpg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
              />
              {/* Premium readability veil: darker behind the graph, brighter at the stadium edges */}
              <div className="pointer-events-none absolute inset-0 z-[1] bg-[#020914]/[0.09]" />
              <div
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{
                  background:
                    "radial-gradient(ellipse 58% 58% at 52% 54%, rgba(2,8,18,.24) 0%, rgba(2,8,18,.14) 46%, rgba(2,8,18,.04) 74%, transparent 100%)",
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-16 z-[1] bg-gradient-to-t from-[#020914]/[0.15] via-transparent to-[#020914]/[0.03]" />

              <div className="relative z-10 mb-7 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <BarChart3 size={18} />
                    <h2 className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-base font-semibold uppercase tracking-wide text-transparent">
                      Évolution des points
                    </h2>
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                  <select
                    value={selectedRange}
                    onChange={(event) =>
                      setSelectedRange(Number(event.target.value))
                    }
                    className="cursor-pointer appearance-none bg-transparent pr-1 text-[9px] uppercase tracking-wider text-slate-300 outline-none"
                    aria-label="Nombre de journées affichées"
                  >
                    {[5, 10, 15, 20, 34]
                      .filter((value) => value <= Math.max(5, stats.dayStats.length) || value === 5)
                      .map((value) => (
                        <option
                          key={value}
                          value={value}
                          className="bg-[#07101c] text-slate-200"
                        >
                          {value} journées
                        </option>
                      ))}
                  </select>
                  <span className="text-emerald-300">⌄</span>
                </label>
              </div>

              <div className="relative z-10 h-[290px]">
                <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
                  {Array.from({ length: 6 }, (_, index) =>
                    Math.round((maxPoints / 5) * (5 - index))
                  ).map((value) => (
                    <div key={value} className="flex items-center gap-3">
                      <span className="w-5 text-right text-[9px] text-slate-500">
                        {value}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.09]" />
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
                        <stop offset="0%" stopColor="#39ff88" />
                        <stop offset="28%" stopColor="#19e6a0" />
                        <stop offset="52%" stopColor="#20d9ff" />
                        <stop offset="76%" stopColor="#4387ff" />
                        <stop offset="100%" stopColor="#b56cff" />
                      </linearGradient>
                      <linearGradient id="statsFill" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#39ff88" stopOpacity=".16" />
                        <stop offset="30%" stopColor="#19e6a0" stopOpacity=".11" />
                        <stop offset="55%" stopColor="#20d9ff" stopOpacity=".10" />
                        <stop offset="78%" stopColor="#4387ff" stopOpacity=".09" />
                        <stop offset="100%" stopColor="#b56cff" stopOpacity=".13" />
                      </linearGradient>
                      <filter id="statsLineGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3.2" result="blur" />
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
                            strokeWidth="10"
                            opacity=".30"
                            filter="url(#statsLineGlow)"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d={linePath}
                            fill="none"
                            stroke="url(#statsLine)"
                            strokeWidth="3.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      );
                    })()}                  </svg>

                  {visibleDays.map((item, index) => {
                    const left =
                      visibleDays.length === 1
                        ? 50
                        : (index / (visibleDays.length - 1)) * 100;
                    const top = 100 - (item.points / maxPoints) * 100;

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
                        <div className="mb-2 -translate-y-5 text-center text-sm font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.85)] drop-shadow-[0_0_10px_rgba(255,255,255,.28)]">
                          {item.points}
                        </div>
                        <div
                          className={`h-4 w-4 rounded-full border-2 border-[#06101b] ${
                            index === 0
                              ? "bg-emerald-300 shadow-[0_0_20px_rgba(57,255,136,.95)]"
                              : index === 1
                                ? "bg-cyan-300 shadow-[0_0_20px_rgba(32,217,255,.95)]"
                                : index === 2
                                  ? "bg-white shadow-[0_0_24px_rgba(32,217,255,1)]"
                                  : index === 3
                                    ? "bg-blue-300 shadow-[0_0_20px_rgba(67,135,255,.95)]"
                                    : "bg-purple-300 shadow-[0_0_22px_rgba(181,108,255,.95)]"
                          }`}
                        />
                      </div>
                    );
                  })}

                  <div className="absolute -bottom-7 inset-x-0 flex justify-between">
                    {visibleDays.map((item) => (
                      <span
                        key={item.day}
                        className="text-[10px] font-semibold text-slate-300 drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]"
                      >
                        {item.day}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            {/* donut */}
            <article className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#07101c]/62 p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)] backdrop-blur-md md:p-7">
              <div className="absolute right-[-70px] top-[-70px] h-64 w-64 rounded-full bg-blue-500/[0.045] blur-[80px]" />

              <div className="relative mb-8 flex items-center gap-2 text-emerald-300">
                <TrendingUp size={18} />
                <h2 className="text-base font-medium uppercase tracking-wide text-slate-200">
                  Répartition des points
                </h2>
              </div>

              <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-center">
                <div
                  className="relative h-44 w-44 shrink-0 rounded-full p-[18px]"
                  style={{
                    background: `conic-gradient(
                      #22d3ee 0deg ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                      #34d399 ${Math.round((stats.standardPoints / Math.max(totalPointsForDistribution, 1)) * 360)}deg ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg,
                      #3b82f6 ${Math.round(((stats.standardPoints + stats.exactPoints) / Math.max(totalPointsForDistribution, 1)) * 360)}deg 360deg
                    )`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#07101c]">
                    <span className="text-3xl font-semibold text-white">
                      {stats.totalPoints}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                      PTS
                    </span>
                  </div>
                </div>

                <div className="w-full max-w-[280px] space-y-5">
                  {distribution.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
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
                      <span className="shrink-0 text-sm font-medium text-slate-200">
                        {item.value} pts · {item.percent}%
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-white/[0.07] pt-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-500">
                      <span>Total</span>
                      <span className="font-semibold text-white">
                        {stats.totalPoints} pts
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>
          {/* SUPPORTERS — compact, connected to real data */}
          <section className="rounded-[24px] border border-white/[0.07] bg-[#07101c]/62 p-5 backdrop-blur-md md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users size={17} className="text-emerald-300" />
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-300">
                Communauté
              </h2>
              <button
                type="button"
                onClick={loadStats}
                disabled={loading}
                className="ml-auto rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[8px] uppercase tracking-wider text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-300 disabled:opacity-50"
              >
                {loading ? "..." : "Actualiser"}
              </button>
            </div>

            {supporters.length === 0 ? (
              <div className="text-xs text-slate-500">
                Aucun supporter enregistré pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {supporters.slice(0, 4).map((item, index) => {
                  const width = Math.max(8, (item.count / maxSupporter) * 100);

                  return (
                    <div key={item.team}>
                      <div className="mb-1.5 flex justify-between text-[10px]">
                        <span className="text-slate-300">
                          <span className="mr-2 font-mono text-slate-600">
                            0{index + 1}
                          </span>
                          {item.team}
                        </span>
                        <span className="text-emerald-300">
                          {item.count}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}