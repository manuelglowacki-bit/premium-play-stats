import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { 
  Newspaper, 
  Sparkles, 
  Trophy, 
  Flame, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  MessageSquare 
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/gazette")({
  head: () => ({
    meta: [
      { title: "La Gazette — Prono Ligue 1" },
      { name: "description", content: "Le journal de bord et les indiscrétions de notre ligue de pronostics." },
    ],
  }),
  component: GazettePage,
});

const matchdaysGazette = ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10", "J11", "J12", "J13", "J14"];

function GazettePage() {
  const [selectedDay, setSelectedDay] = useState(0); // J1 par défaut pour le début de saison
  const [supportersStats, setSupportersStats] = useState<{ favorite_team: string; count: number }[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSupporters() {
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_team')
        .not('favorite_team', 'is', null);

      if (!error && data) {
        // Grouper et compter les supporters par équipe
        const counts: Record<string, number> = {};
        data.forEach(row => {
          if (row.favorite_team) {
            counts[row.favorite_team] = (counts[row.favorite_team] || 0) + 1;
          }
        });
        const formatted = Object.entries(counts)
          .map(([favorite_team, count]) => ({ favorite_team, count }))
          .sort((a, b) => b.count - a.count);
        setSupportersStats(formatted);
      }
    }
    fetchSupporters();
  }, []);

  // Génération de la phrase éditoriale dynamique de début de saison (Phase 7)
  const renderSeasonIntro = () => {
    if (supportersStats.length === 0) {
      return "Cette saison, la course aux pronostics s'annonce palpitante entre tous les passionnés !";
    }
    const parts = supportersStats.map(s => {
      const teamName = s.favorite_team.toUpperCase();
      const prefix = teamName === "OM" ? "l'OM" : teamName === "PSG" ? "le PSG" : `le ${s.favorite_team}`;
      return `${s.count} ${s.count > 1 ? "joueurs soutiennent" : "joueur soutient"} ${prefix}`;
    });
    
    if (parts.length === 1) return `Cette saison, ${parts[0]}...`;
    if (parts.length === 2) return `Cette saison, ${parts[0]} et ${parts[1]}...`;
    return `Cette saison, ${parts.slice(0, -1).join(", ")}, et ${parts[parts.length - 1]}...`;
  };

  const scroll = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 140, behavior: "smooth" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 pb-32">

        {/* ================= EN-TÊTE GAZETTE ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.7)]">
          <div className="absolute top-0 right-0 w-full md:w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                SAISON 2026—2027
              </span>
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Newspaper size={24} />
                </div>
                <h1 className="font-display text-3xl md:text-4xl text-white tracking-tight">
                  La Gazette
                </h1>
              </div>
              <p className="text-sm text-slate-400">
                Ce qu'il faut retenir de la journée, vu depuis la ligue.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#060b16] px-4 py-2 font-mono text-xs text-slate-300 shadow-inner">
              <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
              ÉDITION {matchdaysGazette[selectedDay]} EN LIGNE
            </div>
          </div>
        </section>

        {/* ================= SÉLECTEUR DE JOURNÉE HORIZONTAL ================= */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:p-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll(-1)}
              className="tap grid size-10 shrink-0 place-items-center rounded-2xl border border-slate-800 bg-[#060b16] text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
              aria-label="Précédent"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div
              ref={scrollerRef}
              className="flex flex-1 gap-2.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1"
            >
              {matchdaysGazette.map((j, i) => {
                const active = i === selectedDay;
                return (
                  <button
                    key={j}
                    onClick={() => setSelectedDay(i)}
                    className={`tap flex shrink-0 items-center justify-center rounded-2xl border px-6 py-3 font-display text-sm font-bold transition-all ${
                      active
                        ? "border-emerald-400 bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        : "border-slate-800 bg-[#060b16] text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/60"
                    }`}
                  >
                    {j}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => scroll(1)}
              className="tap grid size-10 shrink-0 place-items-center rounded-2xl border border-slate-800 bg-[#060b16] text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
              aria-label="Suivant"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>

        {/* ================= GRID SUPÉRIEUR : ÉDITO & JOUEUR DE LA SEMAINE ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">

          {/* CARTE ÉDITO À LA UNE (Phase 7 : Intégration des supporters) */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-10 translate-y-10">
              <Flame size={280} className="text-amber-400" />
            </div>

            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                <Sparkles size={12} /> ÉDITO — DÉBUT DE SAISON
              </span>

              <h2 className="font-display text-3xl md:text-4xl text-white tracking-tight leading-tight">
                Les forces en présence
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                {renderSeasonIntro()}
              </p>
            </div>

            <div className="relative z-10 pt-8 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>La Rédac • 3 min de lecture</span>
              <span className="text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer">
                Lire l'article <ArrowRight size={14} />
              </span>
            </div>
          </section>

          {/* CARTE JOUEUR DE LA SEMAINE (HUGO) */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-amber-500/40 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(245,158,11,0.15)]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10 text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                <Trophy size={12} /> JOUEUR DE LA SEMAINE
              </div>

              <div className="relative mx-auto size-24 rounded-full p-1 bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-xl flex items-center justify-center">
                <div className="size-full rounded-full bg-[#060b16] border-2 border-amber-400 flex items-center justify-center text-amber-400">
                  <span className="font-display text-3xl font-black">H</span>
                </div>
              </div>

              <div>
                <h3 className="font-display text-2xl text-white font-bold">Hugo</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed px-2">
                  Une régularité impressionnante ! Avec un total sécurisé de <strong className="text-amber-400">136 points</strong>, il réalise la performance majeure de cette édition.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-3">
              <button className="tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300 hover:border-amber-500/50 transition-colors">
                🔥 <span>14</span>
              </button>
              <button className="tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300 hover:border-amber-500/50 transition-colors">
                👏 <span>8</span>
              </button>
            </div>
          </section>

        </div>

        {/* ================= GRID INFÉRIEUR : ARTICLES SECONDAIRES ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-7 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                <Target size={12} /> LE DUEL DU HAUT DE TABLEAU
              </span>

              <h3 className="font-display text-xl text-white">
                Éric & Samuel : À égalité parfaite pour la première place
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                Les deux leaders ne se lâchent plus et imposent une cadence infernale au reste de la ligue. Mais attention dans le rétroviseur : Jo B est solidement accroché à la 2ème place, prêt à sévir à la moindre erreur.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">3 min</span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300">🤯 5</span>
                <span className="px-2.5 py-1 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300">📈 12</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-7 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold">
                <MessageSquare size={12} /> ANALYSE
              </span>

              <h3 className="font-display text-xl text-white">
                Pourquoi tout le monde se trompe sur Toulouse
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                Le TFC est l'équipe la plus mal pronostiquée de la ligue. Les chiffres montrent une régularité que les parieurs refusent de voir.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">4 min</span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300">😳 7</span>
                <span className="px-2.5 py-1 rounded-full bg-[#060b16] border border-slate-800 text-xs font-mono text-slate-300">🤔 4</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}