import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gem,
  Heart,
  Info,
  Lock,
  Save,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { CountdownBlocksIconic } from "@/components/prono/Countdown";
import { matchday, matches } from "@/lib/prono-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Mes pronostics J1 — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Saisis tes pronostics de la journée : résultats, équipe de cœur et matchs bonus.",
      },
      { property: "og:title", content: "Mes pronostics de la journée" },
      {
        property: "og:description",
        content: "Saisis tes pronos avant le coup d'envoi et grimpe au classement.",
      },
    ],
  }),
  component: PronosticsPage,
});

type Pick = "1" | "N" | "2";
type Score = { home: string; away: string };

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

function ClubCrest({ club, size = "size-8" }: { club: typeof OFFICIAL_L1_CLUBS[number]; size?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = club.name
    .replace(/^(AS|AJ|RC|FC|OGC|ESTAC|LOSC|Olympique|Stade|Le)\s+/i, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative ${size} shrink-0 rounded-lg overflow-hidden bg-white/5 border border-slate-800 flex items-center justify-center`}>
      {broken && (
        <span className="font-mono text-[10px] font-bold text-slate-300">{initials}</span>
      )}
      {!broken && (
        <img
          src={club.crestUrl}
          alt={club.name}
          className="size-full object-contain p-1"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

const matchdaysList = [
  { code: "J1", range: "21 - 23 AOÛT", year: "2026" },
  { code: "J2", range: "28 - 30 AOÛT", year: "2026" },
  { code: "J3", range: "5 SEPT", year: "2026" },
  { code: "J4", range: "11 - 13 SEPT", year: "2026" },
  { code: "J5", range: "19 - 20 SEPT", year: "2026" },
  { code: "J6", range: "10 OCT", year: "2026" },
  { code: "J7", range: "17 OCT", year: "2026" },
  { code: "J8", range: "24 - 25 OCT", year: "2026" },
  { code: "J9", range: "31 OCT - 1 NOV", year: "2026" },
  { code: "J10", range: "7 - 8 NOV", year: "2026" },
  { code: "J11", range: "21 - 22 NOV", year: "2026" },
  { code: "J12", range: "28 - 29 NOV", year: "2026" },
  { code: "J13", range: "5 - 6 DÉC", year: "2026" },
  { code: "J14", range: "12 - 13 DÉC", year: "2026" },
  { code: "J15", range: "19 - 20 DÉC", year: "2026" },
  { code: "J16", range: "9 - 10 JANV", year: "2027" },
  { code: "J17", range: "16 - 17 JANV", year: "2027" },
  { code: "J18", range: "23 - 24 JANV", year: "2027" },
  { code: "J19", range: "6 - 7 FÉVR", year: "2027" },
  { code: "J20", range: "13 - 14 FÉVR", year: "2027" },
  { code: "J21", range: "20 - 21 FÉVR", year: "2027" },
  { code: "J22", range: "27 - 28 FÉVR", year: "2027" },
  { code: "J23", range: "6 - 7 MARS", year: "2027" },
  { code: "J24", range: "13 - 14 MARS", year: "2027" },
  { code: "J25", range: "20 - 21 MARS", year: "2027" },
  { code: "J26", range: "3 - 4 AVR", year: "2027" },
  { code: "J27", range: "10 - 11 AVR", year: "2027" },
  { code: "J28", range: "17 - 18 AVR", year: "2027" },
  { code: "J29", range: "24 - 25 AVR", year: "2027" },
  { code: "J30", range: "1 - 2 MAI", year: "2027" },
  { code: "J31", range: "8 - 9 MAI", year: "2027" },
  { code: "J32", range: "15 - 16 MAI", year: "2027" },
  { code: "J33", range: "22 MAI", year: "2027" },
  { code: "J34", range: "29 MAI", year: "2027" }
];

function PronosticsPage() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [coeurScore, setCoeurScore] = useState<Score>({ home: "", away: "" });
  const [saved, setSaved] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const filled = Object.keys(picks).length;
  const total = matches.length;
  const progressPct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const allDone = filled === total && total > 0;

  const pick = (id: string, value: Pick) => {
    setSaved(false);
    setPicks((prev) => ({ ...prev, [id]: value }));
  };

  const setCoeurValue = (side: "home" | "away", value: string) => {
    setSaved(false);
    setCoeurScore((prev) => ({ ...prev, [side]: value.replace(/[^0-9]/g, "").slice(0, 2) }));
  };

  const scroll = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  const handleSave = async () => {
    try {
      const predictionsToSave = Object.entries(picks).map(([matchId, pickValue]) => ({
        match_id: matchId,
        matchday: matchdaysList[selectedDay].code,
        pick: pickValue,
      }));

      if (predictionsToSave.length > 0) {
        const { error } = await supabase
          .from('predictions')
          .upsert(predictionsToSave, { onConflict: 'match_id, matchday' });

        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erreur lors de l'enregistrement des pronos :", err);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  const coeurMatch = matches.find((m) => m.home === "tfc" || m.away === "tfc") ?? matches[0];
  const coeurHome = clubOf(coeurMatch.home);
  const coeurAway = clubOf(coeurMatch.away);
  const favoriteClub = clubOf("lens");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-32">

        {/* ================= EN-TÊTE PREMIUM ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060b16] p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:p-9">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 65% 55% at 88% -10%, rgba(16,185,129,0.20), transparent 70%), radial-gradient(ellipse 45% 40% at 10% 110%, rgba(56,189,248,0.12), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-72 w-[28rem] rotate-[18deg] bg-gradient-to-b from-white/10 via-white/5 to-transparent blur-2xl"
          />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    JOURNÉE {matchday.number}
                    <Gem className="size-3" />
                    LIGUE 1
                  </span>
                  <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1">
                    <ClubCrest club={favoriteClub} size="size-5" />
                    <span className="font-mono text-[10px] text-slate-300">{favoriteClub.name}</span>
                  </div>
                </div>

                <h1 className="mt-3 font-display text-[clamp(2rem,6vw,3.6rem)] uppercase leading-none tracking-tight text-white">
                  Mes pronostics
                </h1>
                <p className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-400">
                  <Trophy className="size-4 text-amber-400" />
                  {matchday.label.toUpperCase()}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <div className="relative inline-flex size-20 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="url(#progGrad)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - progressPct / 100)}`}
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="progGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex flex-col items-center">
                    <span className="font-display text-lg font-black text-white leading-none">{filled}/{total}</span>
                  </div>
                </div>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {allDone ? "Tout est saisi !" : "Pronostics saisis"}
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CountdownBlocksIconic />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-800 bg-white/[0.02] px-4 py-2.5">
              <Info className="size-3.5 shrink-0 text-emerald-400" />
              <p className="text-xs text-slate-400">
                Complète tous tes pronostics avant le coup d'envoi. Bonne chance !
              </p>
            </div>
          </div>
        </section>

        {/* ================= SÉLECTEUR DE JOURNÉE ================= */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:p-5">
          <p className="mb-3 font-mono text-[10px] font-bold tracking-[0.18em] text-slate-500">
            SÉLECTIONNE TA JOURNÉE
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll(-1)}
              className="tap grid size-9 shrink-0 place-items-center rounded-full border border-slate-800 bg-[#060b16] text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
              aria-label="Journées précédentes"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div
              ref={scrollerRef}
              className="flex flex-1 gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {matchdaysList.map((md, i) => {
                const active = i === selectedDay;
                return (
                  <button
                    key={md.code}
                    onClick={() => setSelectedDay(i)}
                    className={`tap flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-5 py-3 transition-all ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                        : "border-slate-800 bg-[#060b16] hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <span
                      className={`font-display text-xl leading-none ${
                        active ? "text-emerald-400" : "text-white"
                      }`}
                    >
                      {md.code}
                    </span>
                    <span className="whitespace-nowrap font-mono text-[9px] text-slate-500">
                      {md.range}
                    </span>
                    <span className="font-mono text-[9px] text-slate-600">{md.year}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scroll(1)}
              className="tap grid size-9 shrink-0 place-items-center rounded-full border border-slate-800 bg-[#060b16] text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
              aria-label="Journées suivantes"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>

        {/* ================= CONTENU PRINCIPAL ================= */}
        <div className="space-y-6">

          {/* Liste des matchs 1N2 (Ligue 1) */}
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-400">
                  <Target className="size-4" />
                </span>
                <h2 className="font-display text-xl tracking-wide text-white">Ligue 1 McDonald's</h2>
              </div>
              <span className="rounded-full border border-slate-800 bg-[#060b16] px-3 py-1 font-mono text-[10px] text-slate-500">
                1 PT SI BON RÉSULTAT
              </span>
            </div>
            <div className="my-5 h-px bg-slate-800" />

            <div className="space-y-2">
              {matches.map((match) => {
                const home = clubOf(match.home);
                const away = clubOf(match.away);
                const current = picks[match.id];
                return (
                  <div
                    key={match.id}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 transition-all sm:p-4 ${
                      current
                        ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                        : "border-slate-800/80 bg-[#060b16]/60"
                    }`}
                  >
                    <div className="w-16 shrink-0 font-mono text-[10px] text-slate-500">
                      <div>{match.date}</div>
                      <div className="font-bold text-blue-400">{match.time}</div>
                    </div>

                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <ClubCrest club={home} size="size-8" />
                      <b className="truncate text-sm font-semibold text-white">{home.name}</b>
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      {(["1", "N", "2"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => pick(match.id, k)}
                          className={`tap grid size-10 place-items-center rounded-xl border font-display text-sm font-bold transition-all ${
                            current === k
                              ? "border-emerald-400 bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                              : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-3 min-w-0">
                      <b className="truncate text-sm font-semibold text-white text-right">{away.name}</b>
                      <ClubCrest club={away} size="size-8" />
                    </div>

                    <button
                      className="tap grid size-7 shrink-0 place-items-center rounded-full border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                      aria-label="Infos match"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Équipe de cœur avec logo mis en avant */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-red-500/30 bg-[#0d1322] p-5 shadow-[0_0_35px_rgba(244,63,94,0.1)] sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background: "radial-gradient(ellipse 50% 60% at 100% 0%, rgba(244,63,94,0.10), transparent 70%)",
              }}
            />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-500/15 p-1 border border-red-500/30">
                  <ClubCrest club={favoriteClub} size="size-9" />
                </div>
                <div>
                  <h2 className="font-display text-lg tracking-wide text-white">Ton équipe de cœur</h2>
                  <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <Heart className="size-3.5 fill-red-400 text-red-400" /> {favoriteClub.name}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-slate-800 bg-[#060b16] px-3 py-1 font-mono text-[10px] text-slate-500">
                SCORE EXACT = 2 PTS · RÉSULTAT = 1 PT
              </span>
            </div>

            <div className="relative z-10 my-5 h-px bg-slate-800" />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="font-mono text-[10px] text-slate-500">
                <div>{coeurMatch.date}</div>
                <div className="font-bold text-blue-400">{coeurMatch.time}</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <ClubCrest club={coeurHome} size="size-10" />
                  <b className="text-xs font-semibold text-white">{coeurHome.name}</b>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    aria-label={`Score ${coeurHome.name}`}
                    value={coeurScore.home}
                    onChange={(e) => setCoeurValue("home", e.target.value)}
                    className="size-12 rounded-xl border border-slate-800 bg-[#060b16] text-center font-display text-xl text-white outline-none transition-colors focus:border-red-400"
                  />
                  <span className="font-display text-slate-600">-</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Score ${coeurAway.name}`}
                    value={coeurScore.away}
                    onChange={(e) => setCoeurValue("away", e.target.value)}
                    className="size-12 rounded-xl border border-slate-800 bg-[#060b16] text-center font-display text-xl text-white outline-none transition-colors focus:border-red-400"
                  />
                </div>

                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <ClubCrest club={coeurAway} size="size-10" />
                  <b className="text-xs font-semibold text-white">{coeurAway.name}</b>
                </div>
              </div>

              <button
                className="tap grid size-7 shrink-0 place-items-center rounded-full border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                aria-label="Infos"
              >
                <Info className="size-3.5" />
              </button>
            </div>
            <p className="relative z-10 mt-4 flex items-center gap-1.5 font-mono text-[10px] font-bold text-red-400">
              <Sparkles className="size-3" /> CHOISIS LE SCORE EXACT
            </p>
          </section>

          {/* Matchs bonus - 4 grands championnats */}
          <section className="rounded-3xl border border-slate-800 bg-[#0d1322] p-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Flame className="size-4" />
                </span>
                <h2 className="font-display text-lg tracking-wide text-white">
                  Matchs bonus <span className="font-mono text-xs font-normal text-slate-500">(1 match par championnat)</span>
                </h2>
              </div>
              <span className="rounded-full border border-slate-800 bg-[#060b16] px-3 py-1 font-mono text-[10px] text-slate-500">
                SCORE EXACT = 3 PTS · RÉSULTAT = 2 PTS
              </span>
            </div>

            <div className="h-px bg-slate-800" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  id: "PL", 
                  name: "Premier League", 
                  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", 
                  color: "from-purple-500/20 to-indigo-500/10", 
                  border: "border-indigo-500/30", 
                  text: "text-indigo-400",
                  match: null 
                },
                { 
                  id: "BL", 
                  name: "Bundesliga", 
                  flag: "🇩🇪", 
                  color: "from-red-500/20 to-amber-500/10", 
                  border: "border-red-500/30", 
                  text: "text-red-400",
                  match: null 
                },
                { 
                  id: "SA", 
                  name: "Serie A", 
                  flag: "🇮🇹", 
                  color: "from-blue-500/20 to-cyan-500/10", 
                  border: "border-blue-500/30", 
                  text: "text-blue-400",
                  match: null 
                },
                { 
                  id: "L1", 
                  name: "Ligue 1", 
                  flag: "🇫🇷", 
                  color: "from-emerald-500/20 to-teal-500/10", 
                  border: "border-emerald-500/30", 
                  text: "text-emerald-400",
                  match: null 
                },
              ].map((league) => (
                <div
                  key={league.id}
                  className={`relative overflow-hidden rounded-2xl border ${league.border} bg-gradient-to-br ${league.color} p-4 flex flex-col justify-between gap-3 shadow-lg transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{league.flag}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-300 border border-slate-800">
                      {league.name}
                    </span>
                  </div>

                  <div className="py-2">
                    {league.match ? (
                      <div className="space-y-1">
                        <div className="font-display text-sm font-bold text-white">
                          {league.match.home} vs {league.match.away}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">{league.match.time}</div>
                      </div>
                    ) : (
                      <div>
                        <h3 className={`font-display text-base font-bold ${league.text}`}>{league.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-1">Aucun match importé</p>
                      </div>
                    )}
                  </div>

                  <button className="w-full mt-2 py-2 rounded-xl bg-slate-900/90 border border-slate-800 font-display text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors">
                    Pronostiquer
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-slate-500 pt-1">
              Tu ne peux choisir qu'un seul match bonus par championnat.
            </p>
          </section>

        </div>
      </div>

      {/* ================= BARRE D'ACTION FLOTTANTE PREMIUM ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 sm:px-6">
        <div className="pointer-events-auto w-full max-w-3xl rounded-3xl border border-slate-800 bg-[#0d1322]/90 p-3 shadow-[0_10px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 min-w-0">
              {allDone ? (
                <Check className="size-3.5 shrink-0 text-emerald-400" />
              ) : (
                <Lock className="size-3.5 shrink-0 text-slate-500" />
              )}
              <span className="truncate font-mono text-[10px] text-slate-400">
                {allDone ? "Tous les pronostics sont saisis" : `${filled}/${total} matchs pronostiqués`}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-400">{progressPct}%</span>
          </div>
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={handleSave}
              className="tap flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-emerald-400 px-6 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-500"
            >
              {saved ? <Check className="size-4" /> : <Save className="size-4" />}
              {saved ? "Pronostics enregistrés" : "Valider mes pronos"}
            </button>
            <button
              onClick={() => {
                setPicks({});
                setCoeurScore({ home: "", away: "" });
                setSaved(false);
              }}
              className="tap flex items-center justify-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/20 px-6 py-3.5 font-display text-sm font-bold text-red-400 transition-all hover:bg-red-950/40"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}