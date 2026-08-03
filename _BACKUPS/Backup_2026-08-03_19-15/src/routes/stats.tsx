import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/prono/AppShell";
import { BarChart3, Award } from "lucide-react";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Mes statistiques — Prono Ligue 1" },
      {
        name: "description",
        content: "Retrouve tes statistiques détaillées, ta moyenne de points et tes performances journée par journée.",
      },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const statsData = {
    successRate: "68%",
    successSub: "34 / 50 pronos",
    exactScores: "2",
    exactSub: "4% des pronos",
    avgPoints: "22.4",
    avgSub: "Par journée",
    bestDay: "41",
    bestDaySub: "Points • J3",
    playedDays: "5 / 34",
    playedSub: "15% de la saison",
  };

  const chartData = [
    { day: "J1", points: 18, height: "45%" },
    { day: "J2", points: 24, height: "60%" },
    { day: "J3", points: 41, height: "100%", isBest: true },
    { day: "J4", points: 12, height: "30%" },
    { day: "J5", points: 17, height: "42%" },
  ];

  return (
    <AppShell>
      {/* Effets de lumière d'arrière-plan */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute left-1/3 top-10 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute right-10 top-1/2 h-96 w-96 rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl pb-20 space-y-8">
        
        {/* EN-TÊTE */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-3xl border border-slate-800/80 bg-[#060b16]/50 p-6 md:p-8 backdrop-blur-sm">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              Saison en cours
            </p>
            <h1 className="font-display text-4xl tracking-tight text-white md:text-5xl">
              Mes statistiques
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Tes performances journée par journée, analysées en détail.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 font-mono text-[10px] font-bold text-slate-300">
              <BarChart3 size={14} className="text-emerald-400" />
              5 JOURNÉES ANALYSÉES
            </span>
          </div>
        </header>

        {/* GRILLE DES 5 CARTES CLÉS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          {/* Carte 1 : Bons pronos */}
          <div className="group rounded-2xl border border-slate-800 bg-[#0d1322] p-5 transition-all hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Bons pronos</span>
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
            <div>
              <div className="font-display text-3xl text-emerald-400 mb-1">{statsData.successRate}</div>
              <div className="text-[11px] text-slate-500 font-mono">{statsData.successSub}</div>
            </div>
          </div>

          {/* Carte 2 : Scores exacts */}
          <div className="group rounded-2xl border border-slate-800 bg-[#0d1322] p-5 transition-all hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Scores exacts</span>
              <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </div>
            <div>
              <div className="font-display text-3xl text-blue-400 mb-1">{statsData.exactScores}</div>
              <div className="text-[11px] text-slate-500 font-mono">{statsData.exactSub}</div>
            </div>
          </div>

          {/* Carte 3 : Points moyens */}
          <div className="group rounded-2xl border border-slate-800 bg-[#0d1322] p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Points moyens</span>
              <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            </div>
            <div>
              <div className="font-display text-3xl text-amber-400 mb-1">{statsData.avgPoints}</div>
              <div className="text-[11px] text-slate-500 font-mono">{statsData.avgSub}</div>
            </div>
          </div>

          {/* Carte 4 : Meilleure journée */}
          <div className="group rounded-2xl border border-slate-800 bg-[#0d1322] p-5 transition-all hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Meilleure journée</span>
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            </div>
            <div>
              <div className="font-display text-3xl text-indigo-400 mb-1">{statsData.bestDay}</div>
              <div className="text-[11px] text-slate-500 font-mono">{statsData.bestDaySub}</div>
            </div>
          </div>

          {/* Carte 5 : Journées jouées */}
          <div className="group col-span-2 md:col-span-1 rounded-2xl border border-slate-800 bg-[#0d1322] p-5 transition-all hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.1)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Journées jouées</span>
              <div className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
            </div>
            <div>
              <div className="font-display text-3xl text-sky-400 mb-1">{statsData.playedDays}</div>
              <div className="text-[11px] text-slate-500 font-mono">{statsData.playedSub}</div>
            </div>
          </div>

        </div>

        {/* SECTION GRAPHIQUE : POINTS PAR JOURNÉE */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-8">
            <div>
              <h2 className="font-display text-2xl text-white">Points par journée</h2>
              <p className="text-xs text-slate-400 mt-1">Ta meilleure performance reste la J3 avec 41 points.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full w-max">
              <Award size={14} /> Record : 41 pts (J3)
            </div>
          </div>

          {/* Barres du graphique */}
          <div className="grid grid-cols-5 gap-3 md:gap-6 h-64 items-end pt-6 pb-2 px-2 border-b border-slate-800">
            {chartData.map((item) => (
              <div key={item.day} className="flex flex-col items-center h-full justify-end group">
                <span className="font-display text-sm md:text-lg text-slate-300 mb-2 group-hover:text-white transition-colors">
                  {item.points}
                </span>
                <div 
                  className={`w-full max-w-[80px] rounded-t-xl transition-all duration-500 relative overflow-hidden ${
                    item.isBest 
                      ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] border-t border-emerald-300" 
                      : "bg-gradient-to-t from-blue-950 to-blue-600/60 hover:to-blue-500 border-t border-blue-400/30"
                  }`}
                  style={{ height: item.height }}
                >
                  {item.isBest && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2">
                      <Award size={16} className="text-slate-950 fill-emerald-300" />
                    </div>
                  )}
                </div>
                <span className="mt-3 font-mono text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION : RÉPARTITION DE TES PRONOS */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8">
          <h2 className="font-display text-2xl text-white mb-6">Répartition de tes pronos</h2>

          <div className="space-y-6">
            
            {/* Ligne 1 : Bon vainqueur */}
            <div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Bon vainqueur
                </span>
                <span className="font-display text-emerald-400 text-lg">68%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: "68%" }} />
              </div>
            </div>

            {/* Ligne 2 : Score exact */}
            <div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Score exact
                </span>
                <span className="font-display text-blue-400 text-lg">4%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: "4%" }} />
              </div>
            </div>

            {/* Ligne 3 : Pronos ratés */}
            <div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span> Pronos ratés
                </span>
                <span className="font-display text-slate-400 text-lg">32%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
                <div className="h-full rounded-full bg-slate-600" style={{ width: "32%" }} />
              </div>
            </div>

          </div>
        </section>

      </div>
    </AppShell>
  );
}