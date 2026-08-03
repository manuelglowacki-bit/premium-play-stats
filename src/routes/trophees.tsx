import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, CheckCircle, Lock } from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { fetchUserTrophies } from "@/lib/supabase-service";

export const Route = createFileRoute("/trophees")({
  component: TropheesPage,
});

const ALL_TROPHIES = [
  { id: "t1", name: "Premier prono", desc: "Valider ton premier pronostic", goal: 1 },
  { id: "t2", name: "Œil de lynx", desc: "Trouver 5 scores exacts", goal: 5 },
  { id: "t3", name: "Série parfaite", desc: "3 journées consécutives au-dessus de 30 pts", goal: 3 },
  { id: "t4", name: "Fidèle", desc: "Pronostiquer 10 journées d'affilée", goal: 10 },
  { id: "t5", name: "Supporter", desc: "Choisir ton club de cœur", goal: 1 },
  { id: "t6", name: "Roi de la journée", desc: "Finir 1er d'une journée", goal: 1 },
];

function TropheesPage() {
  const [userTrophies, setUserTrophies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const userId = "current-user-uuid"; 
      const data = await fetchUserTrophies(userId);
      setUserTrophies(data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-32 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Trophy className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-white">Trophées & Succès</h1>
            <p className="text-xs text-slate-400">Progression synchronisée avec Supabase</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-mono text-sm">Chargement des trophées...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_TROPHIES.map((trophy) => {
              const userTrophy = userTrophies.find((t: any) => t.trophy_id === trophy.id);
              const unlocked = userTrophy?.unlocked || false;
              const progress = userTrophy?.progress || 0;

              return (
                <div
                  key={trophy.id}
                  className={`rounded-3xl border p-5 transition-all ${
                    unlocked
                      ? "border-emerald-500/40 bg-emerald-500/[0.04] shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      : "border-slate-800 bg-[#0d1322]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-lg font-bold text-white">{trophy.name}</span>
                    {unlocked ? (
                      <CheckCircle className="size-5 text-emerald-400" />
                    ) : (
                      <Lock className="size-5 text-slate-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{trophy.desc}</p>
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                    <span>Progression</span>
                    <span className="font-bold text-white">{progress} / {trophy.goal}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (progress / trophy.goal) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
