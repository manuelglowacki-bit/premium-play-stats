import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { 
  Trophy, 
  Medal, 
  ArrowRight, 
  Camera, 
  Heart,
  Check,
  Zap,
  ChevronRight,
  Crown,
  Sparkles
} from "lucide-react";
import { ranking } from "@/lib/prono-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Prono Ligue 1 LM" },
      { name: "description", content: "Tableau de bord principal de ta ligue de pronostics entre amis." },
    ],
  }),
  component: IndexPage,
});

// Les 18 clubs officiels pointant vers ton dossier local public/clubs/
const OFFICIAL_L1_CLUBS = [
  { id: "angers", name: "Angers SCO", crestUrl: "/clubs/angers.png" },
  { id: "monaco", name: "AS Monaco", crestUrl: "/clubs/monaco.png" },
  { id: "auxerre", name: "AJ Auxerre", crestUrl: "/clubs/auxerre.png" },
  { id: "brest", name: "Stade Brestois 29", crestUrl: "/clubs/brest.png" },
  { id: "lehavre", name: "Le Havre AC", crestUrl: "/clubs/lehavre.png" },
  { id: "lemans", name: "Le Mans FC", crestUrl: "/clubs/lemans.png" },
  { id: "lens", name: "RC Lens", crestUrl: "/clubs/lens.png" },
  { id: "lorient", name: "FC Lorient", crestUrl: "/clubs/lorient.png" },
  { id: "lille", name: "LOSC Lille", crestUrl: "/clubs/lille.png" },
  { id: "ol", name: "Olympique Lyonnais", crestUrl: "/clubs/ol.png" },
  { id: "om", name: "Olympique de Marseille", crestUrl: "/clubs/om.png" },
  { id: "parisfc", name: "Paris FC", crestUrl: "/clubs/parisfc.png" },
  { id: "psg", name: "Paris Saint-Germain", crestUrl: "/clubs/psg.png" },
  { id: "rennes", name: "Stade Rennais FC", crestUrl: "/clubs/rennes.png" },
  { id: "strasbourg", name: "RC Strasbourg Alsace", crestUrl: "/clubs/strasbourg.png" },
  { id: "tfc", name: "Toulouse FC", crestUrl: "/clubs/tfc.png" },
  { id: "troyes", name: "ESTAC Troyes", crestUrl: "/clubs/troyes.png" },
  { id: "nice", name: "OGC Nice", crestUrl: "/clubs/nice.png" }
];

function IndexPage() {
  const [clubId, setClubId] = useState("lens");
  const [savedClubId, setSavedClubId] = useState("lens");
  const [isSaved, setIsSaved] = useState(false);

  const activeClub = OFFICIAL_L1_CLUBS.find((c) => c.id === savedClubId) || OFFICIAL_L1_CLUBS[6];
  const me = ranking?.find((p) => p.current) || { rank: 5, score: 112, name: "Red evils" };

  const handleSaveClub = () => {
    setSavedClubId(clubId);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <AppShell>
      <div className="relative z-10 mx-auto max-w-6xl pb-20 space-y-6">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322] p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.7)]">
          <div className="absolute top-0 right-0 w-full md:w-2/3 h-full bg-gradient-to-l from-emerald-500/10 via-blue-500/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 font-mono text-[10px] font-bold text-emerald-400 tracking-wider">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                SAISON 2026—2027 • LIGUE 1 MCDONALD'S
              </div>
              <h1 className="font-display text-4xl md:text-6xl text-white tracking-tight leading-none">
                PRÉDIS LES RÉSULTATS <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400">
                  DE LA LIGUE 1
                </span>
              </h1>
              <p className="text-sm md:text-base text-slate-400 max-w-xl">
                Affronte tes amis (Éric, Samuel, Jo B, Hugo, Alexis, Jean Marc), fais les bons pronos et deviens le champion incontesté de la saison.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/pronostics"
                  className="tap flex items-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-500 px-7 py-4 font-display text-sm font-bold text-slate-950 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                >
                  <Medal size={18} /> Faire mes pronos <ArrowRight size={16} />
                </Link>
                <Link
                  to="/classement"
                  className="tap flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-7 py-4 font-display text-sm font-bold text-white transition-all"
                >
                  <Trophy size={18} className="text-amber-400" /> Voir le classement
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* LIGNE : PROFIL & COMPTE À REBOURS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="size-20 rounded-2xl p-1 bg-gradient-to-tr from-emerald-500 via-blue-500 to-indigo-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                    <div className="size-full rounded-xl bg-[#060b16] flex items-center justify-center overflow-hidden border border-slate-800">
                      <span className="font-display text-xl font-extrabold text-red-500 tracking-wider">MU</span>
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-lg bg-emerald-500 text-slate-950 text-xs font-mono font-bold shadow-lg">
                    ✓
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Profil Actif</span>
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">Red evils</h3>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                      <Trophy size={12} /> #{me.rank} du classement
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-xs font-bold">
                      <Zap size={12} /> {me.score} pts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">Avatar & personnalisation</span>
              <Link 
                to="/profil" 
                className="tap group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-display font-bold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <Camera size={14} className="text-emerald-400" /> Gérer mon profil <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Prochaine journée</span>
                <h3 className="font-display text-xl text-white mt-0.5">J1 • Vendredi 21 août 2026</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> EN APPROCHE
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 my-2">
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-3 text-center">
                <strong className="font-display text-2xl text-emerald-400 block">19</strong>
                <span className="font-mono text-[10px] text-slate-500 uppercase">Jours</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-3 text-center">
                <strong className="font-display text-2xl text-blue-400 block">04</strong>
                <span className="font-mono text-[10px] text-slate-500 uppercase">Heures</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-3 text-center">
                <strong className="font-display text-2xl text-amber-400 block">39</strong>
                <span className="font-mono text-[10px] text-slate-500 uppercase">Min</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-3 text-center">
                <strong className="font-display text-2xl text-indigo-400 block">48</strong>
                <span className="font-mono text-[10px] text-slate-500 uppercase">Sec</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Verrouillage avant le coup d'envoi</span>
              <Link to="/pronostics" className="font-mono text-xs text-emerald-400 hover:underline">
                Voir les matchs →
              </Link>
            </div>
          </div>

        </div>

        {/* SECTION : CHOISIR ÉQUIPE DE CŒUR EN TRÈS GRAND AVEC DOSSIER LOCAL */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 space-y-6 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-2xl bg-red-500/20 text-red-400 grid place-items-center">
                <Heart size={20} />
              </span>
              <div>
                <span className="font-mono text-[10px] uppercase text-red-400 font-bold">Équipe favorite</span>
                <h3 className="font-display text-2xl text-white">Choisir ton équipe de cœur (Saison 2026/2027)</h3>
              </div>
            </div>

            {/* APERÇU EN TRÈS GRAND ET BIEN VISIBLE */}
            <div className="flex items-center gap-5 bg-[#060b16] border-2 border-emerald-500/70 px-8 py-4 rounded-2xl shadow-[0_0_35px_rgba(16,185,129,0.35)]">
              <div className="size-16 rounded-2xl flex items-center justify-center p-2 bg-white/5 border border-slate-800 shadow-inner shrink-0">
                <img 
                  src={activeClub.crestUrl} 
                  alt={activeClub.name} 
                  className="size-full object-contain"
                />
              </div>
              <div>
                <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest block font-bold mb-0.5">Équipe de cœur enregistrée</span>
                <span className="font-display text-2xl md:text-3xl text-white font-black tracking-wide">{activeClub.name}</span>
              </div>
            </div>
          </div>

          {isSaved && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400 font-mono text-xs flex items-center gap-2 animate-fade-in">
              <Check size={16} /> Équipe de cœur enregistrée avec succès ! Ton blason et tes couleurs sont mis à jour.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center pt-2">
            <div className="relative">
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-[#060b16] px-5 py-4 text-white font-display text-base focus:border-emerald-500 focus:outline-none transition-all cursor-pointer appearance-none pr-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
              >
                {OFFICIAL_L1_CLUBS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveClub}
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-500 px-7 py-4 font-display text-sm font-bold text-slate-950 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] shrink-0"
            >
              <Check size={16} /> Enregistrer
            </button>
          </div>

          <div className="pt-1 text-right">
            <span className="font-mono text-[11px] text-slate-500">
              Date butoir : vendredi 21 août 2026 à 20h45
            </span>
          </div>
        </section>

        {/* SECTION : PODIUM & STATS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className="text-amber-400 animate-pulse" />
                  <span className="font-mono text-[10px] uppercase text-amber-400 font-bold tracking-widest">À l'issue de la J5</span>
                </div>
                <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">Classement général</h3>
              </div>
              <Link 
                to="/classement" 
                className="tap rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2 font-mono text-xs text-slate-200 hover:text-white hover:border-amber-500/50 transition-all shadow-md"
              >
                Complet →
              </Link>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3 items-end pt-10 pb-2 text-center">
              
              <div className="group relative rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800/40 via-[#060b16] to-[#060b16] p-4 flex flex-col items-center justify-end pb-6 h-36 transition-all hover:scale-105">
                <span className="absolute -top-3 size-6 rounded-full bg-slate-700 text-white font-mono font-bold text-[10px] grid place-items-center shadow">
                  #2
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1">2ème</span>
                <b className="font-display text-base text-white tracking-tight truncate w-full">Jo B</b>
                <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-bold">
                  142 pts
                </div>
              </div>

              <div className="group relative rounded-2xl border border-amber-500/60 bg-gradient-to-b from-amber-500/25 via-[#0a0f1d] to-[#060b16] p-4 flex flex-col items-center justify-end pb-6 -translate-y-5 h-48 shadow-[0_0_35px_rgba(245,158,11,0.25)] transition-all hover:scale-105">
                <div className="absolute -top-4 size-8 rounded-full bg-amber-400 text-slate-950 font-display font-black text-sm grid place-items-center shadow-xl">
                  <Crown size={16} className="fill-slate-950" />
                </div>
                <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">#1 ex-aequo</span>
                <div className="flex flex-col items-center justify-center w-full">
                  <b className="font-display text-sm md:text-base text-white tracking-tight truncate">Samuel</b>
                  <span className="text-amber-400 font-mono text-[10px] my-0.5">&</span>
                  <b className="font-display text-sm md:text-base text-white tracking-tight truncate">Éric</b>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                  160 pts
                </div>
              </div>

              <div className="group relative rounded-2xl border border-slate-700/80 bg-gradient-to-b from-amber-900/20 via-[#060b16] to-[#060b16] p-4 flex flex-col items-center justify-end pb-6 h-28 transition-all hover:scale-105">
                <span className="absolute -top-3 size-6 rounded-full bg-amber-900/60 text-amber-200 font-mono font-bold text-[10px] grid place-items-center shadow">
                  #3
                </span>
                <span className="font-mono text-[10px] text-amber-500/80 uppercase tracking-wider mb-1">3ème</span>
                <b className="font-display text-base text-white tracking-tight truncate w-full">Hugo</b>
                <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold">
                  136 pts
                </div>
              </div>

            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Ligue ultra serrée en tête !</span>
              <span className="text-amber-400 font-bold">Cagnotte : 50 €</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="font-mono text-[10px] uppercase text-blue-400 font-bold">Tes performances</span>
                <h3 className="font-display text-2xl text-white mt-0.5">Statistiques personnelles</h3>
              </div>
              <Link to="/stats" className="tap rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 font-mono text-xs text-slate-300 hover:text-white">
                Tout voir →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                <span className="font-mono text-[10px] uppercase text-slate-500 block mb-1">Bons pronos</span>
                <strong className="font-display text-3xl text-emerald-400">68%</strong>
                <span className="text-[11px] text-slate-400 block mt-1">34 / 50 pronos</span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                <span className="font-mono text-[10px] uppercase text-slate-500 block mb-1">Scores exacts</span>
                <strong className="font-display text-3xl text-blue-400">2</strong>
                <span className="text-[11px] text-slate-400 block mt-1">4% des pronos</span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                <span className="font-mono text-[10px] uppercase text-slate-500 block mb-1">Points moyens</span>
                <strong className="font-display text-3xl text-amber-400">22.4</strong>
                <span className="text-[11px] text-slate-400 block mt-1">Par journée</span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                <span className="font-mono text-[10px] uppercase text-slate-500 block mb-1">Meilleure journée</span>
                <strong className="font-display text-3xl text-indigo-400">41</strong>
                <span className="text-[11px] text-slate-400 block mt-1">Points • J3</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
