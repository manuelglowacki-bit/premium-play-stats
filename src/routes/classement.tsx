import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { 
  Crown, 
  Target, 
  Heart, 
  Flame, 
  Minus 
} from "lucide-react";

export const Route = createFileRoute("/classement")({
  head: () => ({
    meta: [
      { title: "Classement Général — Prono Ligue 1" },
      { name: "description", content: "Classement général et statistiques de la ligue de pronostics." },
    ],
  }),
  component: ClassementPage,
});

// La liste officielle exacte des 18 clubs avec leurs logos locaux (public/clubs)
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

function clubOf(key: string) {
  const normalized = key.toLowerCase();
  return (
    OFFICIAL_L1_CLUBS.find((c) => c.id === normalized) ||
    OFFICIAL_L1_CLUBS.find((c) => c.name.toLowerCase().includes(normalized)) ||
    OFFICIAL_L1_CLUBS[5]
  );
}

// Composant blason avec fallback par initiales si l'image ne charge pas
function ClubCrest({ club, size = "size-5" }: { club: typeof OFFICIAL_L1_CLUBS[number]; size?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = club.name
    .replace(/^(AS|AJ|RC|FC|OGC|ESTAC|LOSC|Olympique|Stade|Le)\s+/i, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative ${size} shrink-0 rounded-md overflow-hidden bg-white/5 border border-slate-800 flex items-center justify-center`}>
      {broken && (
        <span className="font-mono text-[8px] font-bold text-slate-300">{initials}</span>
      )}
      {!broken && (
        <img
          src={club.crestUrl}
          alt={club.name}
          className="size-full object-contain p-0.5"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

// Données officielles avec l'équipe de cœur et les symboles
const playersRanking = [
  { 
    rank: 1, 
    name: "Samuel", 
    initials: "S", 
    points: 150, 
    exacts: 150, 
    favoriteClub: "om",
    symbols: ["🎯", "💎"],
    color: "from-amber-400 to-yellow-600" 
  },
  { 
    rank: 2, 
    name: "Eric", 
    initials: "E", 
    points: 150, 
    exacts: 150, 
    favoriteClub: "psg",
    symbols: ["⚡"],
    color: "from-blue-400 to-cyan-600" 
  },
  { 
    rank: 3, 
    name: "Jo B", 
    initials: "J", 
    points: 145, 
    exacts: 145, 
    favoriteClub: "lens",
    symbols: [],
    color: "from-orange-400 to-amber-600" 
  },
  { 
    rank: 4, 
    name: "Hugo", 
    initials: "H", 
    points: 136, 
    exacts: 136, 
    favoriteClub: "ol",
    symbols: [],
    color: "from-slate-400 to-slate-600" 
  },
  { 
    rank: 5, 
    name: "Red evils", 
    initials: "R", 
    points: 112, 
    exacts: 112, 
    favoriteClub: "tfc",
    symbols: [],
    color: "from-emerald-400 to-teal-600", 
    isMe: true 
  },
];

function ClassementPage() {
  const topThree = [playersRanking[1], playersRanking[0], playersRanking[2]]; // Eric (#2), Samuel (#1), Jo B (#3)

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 pb-32">

        {/* ================= EN-TÊTE PREMIUM ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060b16] p-6 md:p-8 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 65% 55% at 88% -10%, rgba(16,185,129,0.20), transparent 70%), radial-gradient(ellipse 45% 40% at 10% 110%, rgba(56,189,248,0.12), transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CLASSEMENT OFFICIEL
              </span>
              <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.2rem)] uppercase leading-none tracking-tight text-white">
                Classement Général
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Saison 2026/2027 • Après la J1
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-slate-800 bg-[#0d1322] px-5 py-3 text-right shadow-inner">
                <span className="font-mono text-[10px] uppercase text-slate-500 block">Leader Actuel</span>
                <span className="font-display text-lg font-bold text-amber-400">Samuel & Eric</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PODIUM PREMIUM (2 - 1 - 3) ================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-6">
          {topThree.map((player) => {
            const isFirst = player.rank === 1;
            const club = clubOf(player.favoriteClub);
            return (
              <div
                key={player.name}
                className={`relative overflow-visible rounded-3xl border bg-[#0d1322] p-6 text-center transition-all ${
                  isFirst
                    ? "border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.2)] md:-translate-y-4"
                    : player.rank === 2
                    ? "border-blue-500/40 shadow-[0_0_30px_rgba(56,189,248,0.15)]"
                    : "border-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.15)]"
                }`}
              >
                {isFirst && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
                    <Crown size={32} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.9)] animate-bounce" />
                  </div>
                )}

                {/* Cercle Avatar / Initiales */}
                <div className="relative mx-auto mb-4 size-20 rounded-full p-1 bg-gradient-to-tr from-slate-800 to-slate-700 shadow-xl flex items-center justify-center">
                  <div className={`size-full rounded-full bg-[#060b16] border-2 flex items-center justify-center ${
                    isFirst ? "border-amber-400 text-amber-400" : player.rank === 2 ? "border-blue-400 text-blue-400" : "border-orange-400 text-orange-400"
                  }`}>
                    <span className="font-display text-2xl font-black">{player.initials}</span>
                  </div>
                  <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full font-mono text-xs font-bold text-slate-950 shadow-lg ${
                    isFirst ? "bg-amber-400" : player.rank === 2 ? "bg-blue-400" : "bg-orange-400"
                  }`}>
                    #{player.rank}
                  </span>
                </div>

                <h3 className="font-display text-xl text-white font-bold tracking-tight">{player.name}</h3>
                
                {/* Équipe de cœur avec logo sur le podium */}
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  <ClubCrest club={club} size="size-5" />
                  <span className="text-xs text-slate-400 font-medium">{club.name}</span>
                </div>

                {/* Affichage des points directement sur la carte podium */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-around">
                  <div className="text-center">
                    <span className={`font-display text-2xl font-black block ${isFirst ? "text-amber-400" : "text-emerald-400"}`}>
                      {player.points} <span className="text-xs font-normal text-slate-500">pts</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{player.exacts} exact(s)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ================= TABLEAU GRAND FORMAT DU CLASSEMENT ================= */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.6)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Classement général</span>
              <h2 className="font-display text-2xl md:text-3xl text-white tracking-tight mt-0.5">Tableau des scores</h2>
            </div>
            
            {/* LÉGENDE DES SYMBOLES & DÉPARTAGE */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl">
              <span className="text-slate-300 font-bold">Légende :</span>
              <span title="Roi du 1N2">🎯 1N2</span>
              <span title="Scores exacts">💎 Exact</span>
              <span title="Top journée">⚡ Top J</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">Départage : points puis scores exacts</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 font-mono text-[10px] uppercase text-slate-500">
                  <th className="py-3 px-4">Place</th>
                  <th className="py-3 px-4 text-center">Évolution</th>
                  <th className="py-3 px-4">Joueur & Club</th>
                  <th className="py-3 px-4 text-right">Points</th>
                  <th className="py-3 px-4 text-right">Scores exacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans text-sm">
                {playersRanking.map((p) => {
                  const club = clubOf(p.favoriteClub);
                  return (
                    <tr key={p.name} className={`transition-colors hover:bg-slate-900/40 ${p.isMe ? "bg-emerald-500/[0.04]" : ""}`}>
                      <td className="py-4 px-4 font-display font-bold text-white">
                        <span className={`inline-flex size-8 items-center justify-center rounded-xl text-xs font-bold ${
                          p.rank === 1 ? "bg-amber-400/20 text-amber-400 border border-amber-400/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                          p.rank === 2 ? "bg-blue-400/20 text-blue-400 border border-blue-400/30" :
                          p.rank === 3 ? "bg-orange-400/20 text-orange-400 border border-orange-400/30" :
                          "bg-slate-800 text-slate-400"
                        }`}>
                          {p.rank}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-500">
                        <Minus size={14} className="mx-auto" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3.5">
                          <div className="size-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-display text-sm font-extrabold text-white shadow">
                            {p.initials}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Logo du club + Nom du joueur + Symboles émojis épurés */}
                            <div className="flex items-center gap-2.5">
                              <ClubCrest club={club} size="size-6" />
                              <span className="font-display font-bold text-white text-base">{p.name}</span>
                              {p.symbols.length > 0 && (
                                <span className="flex items-center gap-1 text-sm tracking-wide">
                                  {p.symbols.join(" ")}
                                </span>
                              )}
                            </div>

                            {p.isMe && <span className="font-mono text-[9px] text-emerald-400 uppercase font-semibold block w-full">Mon profil</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-display text-xl font-black text-emerald-400">
                        {p.points} <span className="text-xs font-normal text-slate-500">pts</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm font-bold text-slate-300">
                        {p.exacts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= SECTION DES SPÉCIALISTES (EN DESSOUS) ================= */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.6)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Résumé par catégories</span>
              <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight mt-0.5">Les spécialistes</h3>
            </div>
            <p className="text-xs text-slate-400">Meilleurs joueurs par domaine depuis le début de la saison</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Spécialiste 1N2 */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-5 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                  <Target size={14} /> 1N2
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Roi du 1N2 🎯</span>
              </div>
              <div className="flex items-center gap-3.5 mt-4">
                <div className="size-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-display font-bold text-emerald-400 text-lg">
                  S
                </div>
                <div>
                  <h4 className="font-display text-lg text-white font-bold">Samuel</h4>
                  <p className="text-xs text-emerald-400 font-mono font-semibold">0 bon résultat</p>
                </div>
              </div>
            </div>

            {/* Spécialiste Équipe de cœur */}
            <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.03] p-5 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs font-bold">
                  <Heart size={14} className="fill-red-400" /> CŒUR
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Équipe de cœur ❤️</span>
              </div>
              <div className="flex items-center gap-3.5 mt-4">
                <div className="size-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center font-display font-bold text-red-400 text-lg">
                  S
                </div>
                <div>
                  <h4 className="font-display text-lg text-white font-bold">Samuel</h4>
                  <p className="text-xs text-red-400 font-mono font-semibold">0 score exact</p>
                </div>
              </div>
            </div>

            {/* Spécialiste Match Bonus */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] p-5 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold">
                  <Flame size={14} /> BONUS
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Match bonus 🔥</span>
              </div>
              <div className="flex items-center gap-3.5 mt-4">
                <div className="size-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-display font-bold text-amber-400 text-lg">
                  S
                </div>
                <div>
                  <h4 className="font-display text-lg text-white font-bold">Samuel</h4>
                  <p className="text-xs text-amber-400 font-mono font-semibold">0 score exact</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}