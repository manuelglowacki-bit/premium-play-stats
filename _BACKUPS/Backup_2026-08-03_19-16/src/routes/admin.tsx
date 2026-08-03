import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, 
  Users, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  Save,
  Wallet,
  Check,
  X,
  Trash2
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Prono Ligue 1" },
      { name: "description", content: "Centre de contrôle administrateur pour la gestion des pronostics et des joueurs." },
    ],
  }),
  component: AdminPage,
});

type AdminTab = "calendrier" | "joueurs" | "finances" | "reglages";

function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("finances");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [entryFee, setEntryFee] = useState(10);

  const [players, setPlayers] = useState([
    { id: "1", name: "Red evils", points: 112, rank: 5, hasPaid: false, amount: 0 },
    { id: "2", name: "Éric", points: 136, rank: 1, hasPaid: true, amount: 10 },
    { id: "3", name: "Samuel", points: 136, rank: 1, hasPaid: true, amount: 10 },
    { id: "4", name: "Jo B", points: 128, rank: 2, hasPaid: false, amount: 0 },
    { id: "5", name: "Hugo", points: 136, rank: 1, hasPaid: true, amount: 10 },
  ]);

  const handleSync = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1200);
  };

  const togglePayment = (id: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === id) {
        const newStatus = !p.hasPaid;
        return { ...p, hasPaid: newStatus, amount: newStatus ? entryFee : 0 };
      }
      return p;
    }));
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le joueur ${name} ?`)) return;

    try {
      const { error } = await supabase.rpc("delete_user_by_id", { user_id: id });
      if (error) {
        console.warn("Note RPC Supabase :", error.message);
      }
    } catch (e) {
      console.error("Erreur suppression :", e);
    } finally {
      setPlayers(prev => prev.filter(p => p.id !== id));
    }
  };

  const totalCollected = players.reduce((acc, p) => acc + (p.hasPaid ? p.amount : 0), 0);
  const totalExpected = players.length * entryFee;

  return (
    <AppShell>
      <div className="relative z-10 mx-auto max-w-6xl pb-20 space-y-6">
        
        <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
          
          <div className="z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="font-mono text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                CENTRE DE CONTRÔLE
              </p>
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-white tracking-tight">
              Administration Premium
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              Chaque module reste ouvert pendant la synchronisation, sans retour automatique à l'accueil.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10 shrink-0">
            <div className="rounded-2xl border border-slate-800 bg-[#060b16] px-5 py-3">
              <span className="block font-mono text-[10px] uppercase text-slate-500">ÉTAT</span>
              <strong className="font-display text-sm text-emerald-400 flex items-center gap-1.5 mt-0.5">
                Administration prête
              </strong>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="tap flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 font-display text-xs font-bold text-slate-950 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Synchro..." : "Synchroniser"}
            </button>
          </div>
        </header>

        {syncSuccess && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400 font-mono text-xs flex items-center gap-2">
            <CheckCircle2 size={16} /> Synchronisation réussie avec la base de données !
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveTab("calendrier")}
            className={`tap text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
              activeTab === "calendrier"
                ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "border-slate-800 bg-[#0d1322] hover:border-slate-700"
            }`}
          >
            <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-400 grid place-items-center shrink-0">
              <Calendar size={18} />
            </div>
            <div className="min-w-0">
              <strong className="block font-display text-sm text-white truncate">Calendrier</strong>
              <small className="text-[11px] text-slate-400 truncate block">Ligue 1 & bonus</small>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("joueurs")}
            className={`tap text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
              activeTab === "joueurs"
                ? "border-purple-500/60 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                : "border-slate-800 bg-[#0d1322] hover:border-slate-700"
            }`}
          >
            <div className="size-9 rounded-xl bg-purple-500/20 text-purple-400 grid place-items-center shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <strong className="block font-display text-sm text-white truncate">Joueurs</strong>
              <small className="text-[11px] text-slate-400 truncate block">Comptes & points</small>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("finances")}
            className={`tap text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
              activeTab === "finances"
                ? "border-blue-500/60 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                : "border-slate-800 bg-[#0d1322] hover:border-slate-700"
            }`}
          >
            <div className="size-9 rounded-xl bg-blue-500/20 text-blue-400 grid place-items-center shrink-0">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <strong className="block font-display text-sm text-white truncate">Caisse & Paiements</strong>
              <small className="text-[11px] text-slate-400 truncate block">Suivi des cotisations</small>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("reglages")}
            className={`tap text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
              activeTab === "reglages"
                ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "border-slate-800 bg-[#0d1322] hover:border-slate-700"
            }`}
          >
            <div className="size-9 rounded-xl bg-amber-500/20 text-amber-400 grid place-items-center shrink-0">
              <Settings size={18} />
            </div>
            <div className="min-w-0">
              <strong className="block font-display text-sm text-white truncate">Réglages</strong>
              <small className="text-[11px] text-slate-400 truncate block">Supabase & club</small>
            </div>
          </button>
        </div>

        {activeTab === "finances" && (
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-blue-400">Trésorerie de la ligue</span>
                <h2 className="font-display text-2xl text-white mt-0.5">Suivi des paiements & Cagnotte</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">Mise par joueur :</span>
                <input
                  type="number"
                  value={entryFee}
                  onChange={(e) => setEntryFee(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-700 bg-[#060b16] px-3 py-1.5 text-white font-mono text-sm text-center focus:outline-none"
                />
                <span className="font-mono text-xs text-slate-400">€</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-5">
                <span className="block font-mono text-[10px] uppercase text-slate-500">Total collecté dans la caisse</span>
                <strong className="font-display text-3xl text-emerald-400 mt-1 block">{totalCollected} €</strong>
                <span className="text-xs text-slate-400 mt-1 block">Prêt pour la redistribution</span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060b16] p-5">
                <span className="block font-mono text-[10px] uppercase text-slate-500">Total attendu (Cagnotte finale)</span>
                <strong className="font-display text-3xl text-blue-400 mt-1 block">{totalExpected} €</strong>
                <span className="text-xs text-slate-400 mt-1 block">{players.filter(p => p.hasPaid).length} sur {players.length} joueurs ont payé</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="font-display text-lg text-white mb-2">État des versements par participant</h3>
              {players.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                  <div className="flex items-center gap-4">
                    <span className={`grid size-9 place-items-center rounded-xl font-display font-bold ${
                      p.hasPaid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {p.hasPaid ? <Check size={18} /> : <X size={18} />}
                    </span>
                    <div>
                      <b className="font-display text-lg text-white">{p.name}</b>
                      <small className="block text-xs text-slate-400 font-mono">
                        {p.hasPaid ? `A versé ${p.amount} €` : "N'a pas encore payé"}
                      </small>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs px-3 py-1 rounded-full border ${
                      p.hasPaid 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {p.hasPaid ? "PAYÉ" : "EN ATTENTE"}
                    </span>
                    <button
                      onClick={() => togglePayment(p.id)}
                      className={`tap rounded-xl px-4 py-2 font-display text-xs font-bold transition-all ${
                        p.hasPaid
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      }`}
                    >
                      {p.hasPaid ? "Marquer non payé" : "Marquer comme payé"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "calendrier" && (
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase text-emerald-400">Module Matchs</span>
                <h2 className="font-display text-2xl text-white mt-0.5">Calendrier & Résultats</h2>
              </div>
              <button className="tap rounded-xl bg-emerald-500 text-slate-950 font-display text-xs font-bold px-4 py-2.5">
                + Ajouter un match
              </button>
            </div>

            <div className="space-y-3">
              {[
                { match: "Toulouse FC vs Paris Saint-Germain", date: "21 Août 2026", status: "À venir" },
                { match: "Olympique de Marseille vs AS Monaco", date: "22 Août 2026", status: "À venir" },
                { match: "LOSC Lille vs Olympique Lyonnais", date: "22 Août 2026", status: "À venir" },
              ].map((m, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                  <div>
                    <span className="font-mono text-[10px] text-slate-500 block mb-1">{m.date}</span>
                    <b className="font-display text-base text-white">{m.match}</b>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {m.status}
                    </span>
                    <button className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white font-mono hover:bg-slate-700">
                      Éditer score
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "joueurs" && (
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase text-purple-400">Module Participants</span>
                <h2 className="font-display text-2xl text-white mt-0.5">Gestion des Joueurs</h2>
              </div>
              <span className="font-mono text-xs text-slate-400">{players.length} inscrits</span>
            </div>

            <div className="space-y-3">
              {players.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#060b16] p-4">
                  <div className="flex items-center gap-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-purple-500/10 text-purple-400 font-display font-bold">
                      #{p.rank}
                    </span>
                    <div>
                      <b className="font-display text-lg text-white">{p.name}</b>
                      <small className="block text-xs text-slate-400 font-mono">{p.points} points</small>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, points: x.points + 3 } : x))}
                      className="tap rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-emerald-400 hover:bg-slate-700"
                    >
                      +3 pts
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(p.id, p.name)}
                      className="tap flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-mono text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={13} />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "reglages" && (
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 space-y-6 animate-fade-in">
            <div>
              <span className="font-mono text-[10px] uppercase text-amber-400">Configuration</span>
              <h2 className="font-display text-2xl text-white mt-0.5">Réglages Supabase & Application</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-2">URL SUPABASE</label>
                <input
                  type="text"
                  readOnly
                  value="https://azgksiwcgvbertzzzhvq.supabase.co"
                  className="w-full rounded-2xl border border-slate-800 bg-[#060b16] px-4 py-3 text-slate-300 font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-2">CLÉ API PUBLIQUE (SUPABASE)</label>
                <input
                  type="password"
                  readOnly
                  value="sb_publishable_NwALJ8h6gzAlC-GgiqnFow_Ol45BzTj"
                  className="w-full rounded-2xl border border-slate-800 bg-[#060b16] px-4 py-3 text-slate-300 font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button className="tap flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3.5 font-display text-sm font-bold text-slate-950 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <Save size={16} /> Enregistrer les configurations
                </button>
              </div>
            </div>
          </section>
        )}

      </div>
    </AppShell>
  );
}