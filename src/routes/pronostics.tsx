import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Lock,
  Save,
  Sparkles,
  Trophy,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { CountdownBlocksIconic } from "@/components/prono/Countdown";
import { matchday, matches } from "@/lib/prono-data";
import { supabase } from "@/lib/supabase";
import { useTeamTheme } from "@/hooks/useTeamTheme";
import { withAlpha } from "@/lib/team-theme";

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Mes pronostics J1 | Prono Ligue 1" },
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
  { id: "angers", name: "Angers SCO", crestUrl: "/logos/ligue1/angers.png" },
  { id: "monaco", name: "AS Monaco", crestUrl: "/logos/ligue1/monaco.png" },
  { id: "auxerre", name: "AJ Auxerre", crestUrl: "/logos/ligue1/auxerre.png" },
  { id: "brest", name: "Stade Brestois 29", crestUrl: "/logos/ligue1/brest.png" },
  { id: "lehavre", name: "Le Havre AC", crestUrl: "/logos/ligue1/lehavre.png" },
  { id: "lemans", name: "Le Mans FC", crestUrl: "/logos/ligue1/lemans.png" },
  { id: "lens", name: "RC Lens", crestUrl: "/logos/ligue1/lens.png" },
  { id: "lorient", name: "FC Lorient", crestUrl: "/logos/ligue1/lorient.png" },
  { id: "lille", name: "LOSC Lille", crestUrl: "/logos/ligue1/lille.png" },
  { id: "ol", name: "Olympique Lyonnais", crestUrl: "/logos/ligue1/ol.png" },
  { id: "om", name: "Olympique de Marseille", crestUrl: "/logos/ligue1/om.png" },
  { id: "parisfc", name: "Paris FC", crestUrl: "/logos/ligue1/parisfc.png" },
  { id: "psg", name: "Paris Saint-Germain", crestUrl: "/logos/ligue1/psg.png" },
  { id: "rennes", name: "Stade Rennais FC", crestUrl: "/logos/ligue1/rennes.png" },
  { id: "strasbourg", name: "RC Strasbourg Alsace", crestUrl: "/logos/ligue1/strasbourg.png" },
  { id: "tfc", name: "Toulouse FC", crestUrl: "/logos/ligue1/tfc.png" },
  { id: "troyes", name: "ESTAC Troyes", crestUrl: "/logos/ligue1/troyes.png" },
  { id: "nice", name: "OGC Nice", crestUrl: "/logos/ligue1/nice.png" }
];

function clubOf(key: string) {
  if (!key) return OFFICIAL_L1_CLUBS[6];
  const normalized = key.toLowerCase();
  return (
    OFFICIAL_L1_CLUBS.find((c) => c.id === normalized) ||
    OFFICIAL_L1_CLUBS.find((c) => c.name.toLowerCase().includes(normalized)) ||
    OFFICIAL_L1_CLUBS[6]
  );
}

function ClubCrest({ club, size = "size-8", className = "" }: { club: typeof OFFICIAL_L1_CLUBS[number]; size?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = club.name
    .replace(/^(AS|AJ|RC|FC|OGC|ESTAC|LOSC|Olympique|Stade|Le)\s+/i, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative ${size} shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
      {broken && (
        <span className="font-mono text-[10px] font-bold text-slate-300">{initials}</span>
      )}
      {!broken && (
        <img
          src={club.crestUrl}
          alt={club.name}
          className="size-full object-contain"
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
  const [logoFailed, setLogoFailed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Design system par équipe favorite (background, couleurs, glow, gradient,
  // bouton) — même source de vérité et même hook que la page d'accueil, voir
  // src/lib/team-theme.ts et src/hooks/useTeamTheme.ts. Le hook lit
  // `profiles.favorite_team_id` via useFavoriteTeam et se resynchronise
  // automatiquement dès qu'un autre composant change de club (ex. /profil),
  // y compris après un rechargement de page.
  const {
    clubId: favoriteClubIdOrNull,
    theme,
    backgroundUrl: teamBg,
    backgroundFailed: teamBgFailed,
    onBackgroundError: handleTeamBgError,
  } = useTeamTheme();
  const favoriteClubId = favoriteClubIdOrNull ?? "lens";
  const favoriteClub = clubOf(favoriteClubId);

  const filled = Object.keys(picks).length + (coeurScore.home !== "" && coeurScore.away !== "" ? 1 : 0);
  const total = matches.length + 1;
  const progressPct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Vous devez être connecté pour enregistrer vos pronostics.");
        return;
      }

      const predictionsToSave = Object.entries(picks).map(([matchId, pickValue]) => ({
        user_id: user.id,
        match_id: matchId,
        matchday: matchdaysList[selectedDay].code,
        pick: pickValue,
      }));

      if (predictionsToSave.length > 0) {
        const { error } = await supabase
          .from('predictions')
          .upsert(predictionsToSave, { onConflict: 'user_id, match_id, matchday' });

        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erreur lors de l'enregistrement des pronos :", err);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  const foundCoeurMatch = matches.find(
    (m) => m.home.toLowerCase() === favoriteClubId || m.away.toLowerCase() === favoriteClubId
  );
  const coeurMatch = foundCoeurMatch ?? matches[0];
  const coeurHome = clubOf(coeurMatch.home);
  const coeurAway = clubOf(coeurMatch.away);

  const sortedMatches = [...matches].sort((a, b) => {
    const isFav = (m: typeof matches[0]) =>
      m.home.toLowerCase() === favoriteClubId || m.away.toLowerCase() === favoriteClubId;
    if (isFav(a) && !isFav(b)) return -1;
    if (!isFav(a) && isFav(b)) return 1;
    return 0;
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-32">

        {/* ================= EN-TÊTE PREMIUM ================= */}
        <section
          className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060b16] p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:p-9"
          style={{
            backgroundImage: "url('/prono-hero-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
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

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
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

          <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CountdownBlocksIconic />
          </div>

          <div className="relative z-10 mt-6 flex items-center gap-2 rounded-2xl border border-slate-800 bg-white/[0.02] px-4 py-2.5">
            <Sparkles className="size-3.5 shrink-0 text-emerald-400" />
            <p className="text-xs text-slate-400">
              Complète tous tes pronostics avant le coup d'envoi. Bonne chance !
            </p>
          </div>
        </section>

        {/* ================= SÉLECTEUR DE JOURNÉE - EA SPORTS HUD ================= */}
        <section
          className="relative overflow-hidden rounded-3xl border border-slate-800/80 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.6)] sm:p-5"
        >
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: "url('/bg-journee.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: "scale(1.04)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[#030712]/50" />
          <p className="relative z-10 mb-3 font-mono text-[10px] font-bold tracking-[0.18em] text-slate-300">
            SÉLECTIONNE TA JOURNÉE
          </p>

          <div className="relative z-10 flex items-center gap-2">
            <button
              onClick={() => scroll(-1)}
              className="tap grid size-9 shrink-0 place-items-center rounded-full border border-slate-700/50 bg-[#060b16]/60 text-slate-400 backdrop-blur-md transition-colors hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-[#060b16]/80"
              aria-label="Journées précédentes"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div
              ref={scrollerRef}
              className="flex flex-1 gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden relative py-2"
            >
              {matchdaysList.map((md, i) => {
                const active = i === selectedDay;
                return (
                  <button
                    key={md.code}
                    onClick={() => setSelectedDay(i)}
                    className={`tap relative flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-5 py-3 transition-all duration-300 backdrop-blur-md ${
                      active
                        ? "border-emerald-400/80 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105 z-10"
                        : "border-slate-800/60 bg-[#060b16]/40 hover:border-slate-600 hover:bg-[#060b16]/60"
                    }`}
                  >
                    {active && (
                      <div className="absolute inset-0 -z-10 rounded-2xl bg-emerald-500/25 blur-xl pointer-events-none" />
                    )}
                    <span
                      className={`font-display text-xl leading-none transition-colors ${
                        active ? "text-emerald-400" : "text-white"
                      }`}
                    >
                      {md.code}
                    </span>
                    <span className={`whitespace-nowrap font-mono text-[9px] transition-colors ${
                        active ? "text-emerald-200" : "text-slate-400"
                      }`}>
                      {md.range}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scroll(1)}
              className="tap grid size-9 shrink-0 place-items-center rounded-full border border-slate-700/50 bg-[#060b16]/60 text-slate-400 backdrop-blur-md transition-colors hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-[#060b16]/80"
              aria-label="Journées suivantes"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>

        {/* ================= CONTENU PRINCIPAL ================= */}
        <div className="space-y-8">

          {/* ================= MATCHS 1N2 LIGUE 1 - INTERFACE BROADCAST / EA SPORTS ================= */}
          <section className="relative overflow-hidden rounded-[28px] border border-[#1E3356] bg-[#050A14] shadow-[0_40px_80px_rgba(0,0,0,0.9)] p-4 sm:p-8">
            
            <style>{`
              .hud-dots {
                background-image: radial-gradient(circle, #33B5FF 1px, transparent 1px);
                background-size: 24px 24px;
                mask-image: radial-gradient(ellipse at center, transparent 40%, black 100%);
                -webkit-mask-image: radial-gradient(ellipse at center, transparent 40%, black 100%);
              }
            `}</style>

            <div
              className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
              style={{
                backgroundImage: "url('/match ligue 1.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <div className="absolute inset-0 z-0 pointer-events-none hud-dots opacity-25" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-64 bg-[#33B5FF]/10 blur-[120px] pointer-events-none z-0" />
            <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-[#050A14]/70 to-[#050A14]" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-[#1E3356]/40 pb-5">
              <div className="flex items-center gap-4">
                <div className="size-12 md:size-14 shrink-0 rounded-2xl bg-[#081221] border border-[#1E3356] p-2 flex items-center justify-center shadow-[0_0_20px_rgba(51,181,255,0.15)] overflow-hidden">
                  {!logoFailed ? (
                    <img 
                      src="/logo ligue 1.png" 
                      alt="Ligue 1" 
                      className="size-full object-contain" 
                      onError={() => setLogoFailed(true)} 
                    />
                  ) : (
                    <span className="font-display font-black text-white text-sm">L1</span>
                  )}
                </div>
                <div>
                  <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-wide text-white drop-shadow-md">
                    Ligue 1 McDonald's
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-[#33B5FF] uppercase tracking-widest font-bold">
                      {matchdaysList[selectedDay]?.code || "Journée"}
                    </span>
                    <span className="text-[#E7B542]">•</span>
                    <span className="font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                      Saison 2026-2027
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-300">
                    🎯 1 pt = bon prono • 0 pt = sinon
                  </span>
                </div>
                <div className="text-right pl-3 border-l border-[#1E3356]/60">
                  <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Saisis</div>
                  <div className="font-display text-xl text-[#17F1A7] font-bold">{filled} <span className="text-[#1E3356] font-normal">/</span> <span className="text-slate-300">{total}</span></div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-3">
              {sortedMatches.map((match) => {
                const home = clubOf(match.home);
                const away = clubOf(match.away);
                const current = picks[match.id];
                const isFavoriteMatch =
                  match.home.toLowerCase() === favoriteClubId ||
                  match.away.toLowerCase() === favoriteClubId;

                const dateParts = match.date.split(" ");
                const dayName = dateParts[0];
                const dayDate = dateParts.slice(1).join(" ");

                return (
                  <div key={match.id} className="relative group z-10">
                    
                    {isFavoriteMatch && (
                      <div className="absolute -top-2.5 left-6 z-20">
                        <span className="flex items-center gap-1.5 rounded border border-[#E7B542]/50 bg-gradient-to-r from-[#E7B542]/20 to-[#E7B542]/5 px-2 py-0.5 text-[9px] font-bold text-[#E7B542] uppercase tracking-widest shadow-[0_0_10px_rgba(231,181,66,0.2)] backdrop-blur-md">
                          ⭐ Ton équipe
                        </span>
                      </div>
                    )}

                    <div className="relative overflow-hidden rounded-[20px] bg-white/[0.02] backdrop-blur-xl border border-white/5 p-4 transition-all duration-500 hover:-translate-y-1 hover:bg-[#081221]/80 hover:border-[#33B5FF]/50 hover:shadow-[0_15px_40px_rgba(51,181,255,0.15)]">
                      
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#33B5FF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                        
                        <div className="flex flex-col items-center justify-center w-[72px] shrink-0 border-r border-[#1E3356]/60 pr-4">
                          <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-widest">{dayName}</span>
                          <span className="font-mono text-[11px] text-slate-300 font-bold uppercase tracking-wider whitespace-nowrap">{dayDate}</span>
                          <span className="font-mono text-sm text-[#33B5FF] font-black mt-1">{match.time}</span>
                        </div>

                        <div className="flex flex-1 items-center gap-4 min-w-0 justify-start">
                          <div className="relative size-12 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <ClubCrest club={home} size="size-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />
                          </div>
                          <b className="font-display text-base md:text-lg font-semibold text-slate-200 group-hover:text-white transition-colors truncate">{home.name}</b>
                        </div>

                        <div className="flex shrink-0 gap-1.5 p-1 rounded-2xl bg-[#050A14] border border-black/50 shadow-inner mx-auto">
                          {(["1", "N", "2"] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => pick(match.id, k)}
                              className={`tap relative grid size-10 place-items-center rounded-xl font-display text-base font-black transition-all duration-300 ${
                                current === k
                                  ? "bg-gradient-to-t from-[#17F1A7] to-emerald-400 text-[#050A14] shadow-[0_0_15px_rgba(23,241,167,0.4)] scale-105 border-transparent"
                                  : "bg-white/5 text-slate-400 border border-white/10 hover:border-[#33B5FF]/50 hover:text-white hover:shadow-[0_0_15px_rgba(51,181,255,0.2)] active:scale-95"
                              }`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-1 items-center gap-4 min-w-0 justify-end">
                          <b className="font-display text-base md:text-lg font-semibold text-slate-200 group-hover:text-white transition-colors truncate text-right">{away.name}</b>
                          <div className="relative size-12 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <ClubCrest club={away} size="size-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================= ÉQUIPE DE CŒUR - FOND DYNAMIQUE WALLPAPER & CLUB THEME ================= */}
          <section 
            className="relative overflow-hidden rounded-[28px] border p-5 sm:p-8 shadow-[0_40px_80px_rgba(0,0,0,0.9)] transition-all duration-500"
            style={{
              borderColor: theme.primary + "40",
              // Overlay allégé : le fond d'écran du club doit rester bien visible.
              // La lisibilité du texte est assurée séparément par le voile
              // gradient ci-dessous (plus fort côté texte, quasi transparent
              // côté visuel) plutôt que par un assombrissement uniforme.
              backgroundImage: `linear-gradient(180deg, rgba(4,9,19,0.35), rgba(8,20,37,0.55)), url('${teamBg}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Image cachée servant uniquement à détecter un fond d'écran manquant
                (404) et à retomber sur /stadium-bg.jpg — même mécanisme que la carte
                profil de la page d'accueil (src/routes/index.tsx), via useTeamTheme. */}
            {theme.id !== "default" && !teamBgFailed && (
              <img
                src={theme.background}
                alt=""
                className="hidden"
                onError={handleTeamBgError}
              />
            )}

            <style>{`
              @keyframes light-sweep {
                0% { transform: translateX(-100%) skewX(-20deg); }
                20% { transform: translateX(200%) skewX(-20deg); }
                100% { transform: translateX(200%) skewX(-20deg); }
              }
              .animate-light-sweep {
                animation: light-sweep 12s infinite ease-in-out;
              }
            `}</style>

            <div className="absolute inset-0 z-0 pointer-events-none opacity-5 bg-[radial-gradient(#1E3356_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute top-0 left-0 w-48 h-48 blur-[80px] pointer-events-none z-0" style={{ backgroundColor: theme.glow }} />
            <div className="absolute bottom-0 right-0 w-48 h-48 blur-[80px] pointer-events-none z-0" style={{ backgroundColor: withAlpha(theme.secondary, 0.15) }} />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
              <div className="font-display font-black text-[25rem] text-white opacity-[0.03] tracking-tighter mix-blend-screen">
                1
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-light-sweep" />
            </div>

            {/* Voile de lisibilité : appuyé côté texte (zone gauche), quasi
                transparent côté visuel (zone droite) — le fond d'écran du club
                reste visible là où il n'y a pas de texte à protéger. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#050b16]/85 via-[#050b16]/35 to-transparent lg:to-40%" />
            {/* Léger voile bas pour les noms d'équipe sous les blasons (zone droite). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#050b16]/60 to-transparent" />

            <div className="relative z-20 grid grid-cols-1 lg:grid-cols-[35%_65%] gap-6 items-center">

              {/* ZONE GAUCHE (35%) : Infos & Équipe de Cœur */}
              <div className="flex flex-col justify-between space-y-4 lg:border-r lg:border-white/10 lg:pr-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                <div className="flex items-center gap-4">
                  <div className="relative size-14 shrink-0 flex items-center justify-center">
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-full opacity-70 blur-md"
                      style={{ background: theme.gradient }}
                    />
                    <ClubCrest club={favoriteClub} size="size-full drop-shadow-lg relative z-10" />
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold block" style={{ color: theme.primary }}>
                      ❤️ Ma team
                    </span>
                    <h3 className="font-display text-xl text-white uppercase tracking-wide font-black mt-0.5">
                      {favoriteClub.name}
                    </h3>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest block">Prochain Match</span>
                    <span className="font-mono text-xs text-slate-200 font-bold uppercase">{coeurMatch.date}</span>
                    <div className="font-mono text-sm font-black mt-0.5" style={{ color: theme.primary }}>{coeurMatch.time}</div>
                  </div>

                  <button
                    className="tap flex items-center gap-2 rounded-xl border px-4 py-2.5 font-display text-xs font-bold transition-all shadow-lg group"
                    style={{
                      borderColor: withAlpha(theme.primary, 0.4),
                      backgroundColor: theme.button.background,
                      color: theme.button.text,
                      boxShadow: theme.button.shadow,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.button.hoverBackground)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.button.background)}
                  >
                    <Calendar size={14} className="group-hover:scale-110 transition-transform" />
                    Calendrier
                  </button>
                </div>
              </div>

              {/* ZONE DROITE (65%) : Le Match (Score inputs + Logos 90px sans cercle) */}
              <div className="flex flex-col items-center justify-center space-y-4 lg:pl-4">
                
                <div className="flex items-center justify-between w-full max-w-md gap-4">
                  
                  {/* Équipe Domicile (90px) */}
                  <div className="flex flex-col items-center flex-1 text-center group">
                    <div className="relative size-20 md:size-[90px] flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                      <ClubCrest club={coeurHome} size="size-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]" />
                    </div>
                    <span className="font-display text-sm md:text-base font-bold text-slate-200 mt-2.5 truncate w-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{coeurHome.name}</span>
                  </div>

                  {/* Bloc VS & Cases de Score */}
                  <div className="flex flex-col items-center shrink-0 px-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="numeric"
                        aria-label={`Score ${coeurHome.name}`}
                        value={coeurScore.home}
                        onChange={(e) => setCoeurValue("home", e.target.value)}
                        placeholder="-"
                        className="size-14 md:size-16 rounded-2xl border border-[#1E3356] bg-[#050913]/90 text-center font-display text-2xl md:text-3xl font-black text-white outline-none transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)] focus:border-[#14F195] focus:shadow-[0_0_20px_rgba(20,241,149,0.4)] focus:scale-105"
                      />
                      <span className="font-display text-xl text-slate-600 font-bold">—</span>
                      <input
                        inputMode="numeric"
                        aria-label={`Score ${coeurAway.name}`}
                        value={coeurScore.away}
                        onChange={(e) => setCoeurValue("away", e.target.value)}
                        placeholder="-"
                        className="size-14 md:size-16 rounded-2xl border border-[#1E3356] bg-[#050913]/90 text-center font-display text-2xl md:text-3xl font-black text-white outline-none transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)] focus:border-[#14F195] focus:shadow-[0_0_20px_rgba(20,241,149,0.4)] focus:scale-105"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                      <span>───</span> <span className="font-bold" style={{ color: theme.primary }}>VS</span> <span>───</span>
                    </div>
                  </div>

                  {/* Équipe Extérieur (90px) */}
                  <div className="flex flex-col items-center flex-1 text-center group">
                    <div className="relative size-20 md:size-[90px] flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                      <ClubCrest club={coeurAway} size="size-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]" />
                    </div>
                    <span className="font-display text-sm md:text-base font-bold text-slate-200 mt-2.5 truncate w-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{coeurAway.name}</span>
                  </div>

                </div>

                <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#14F195] tracking-widest uppercase mt-2">
                  <Sparkles size={12} /> CHOISIS LE SCORE EXACT
                </p>
                {/* Barème de points : même badge pilule que la carte "Matchs bonus"
                    ci-dessous (bordure dorée subtile + fond ambré semi-transparent). */}
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 mt-2">
                  <span className="font-mono text-[11px] font-bold text-amber-300">
                    🎯 <span className="text-fuchsia-400">Score exact</span> = <span className="text-white">2 pts</span>
                    <span className="mx-2 text-amber-500">•</span>
                    ✅ <span className="text-emerald-400">Résultat</span> = <span className="text-white">1 pt</span>
                  </span>
                </div>

              </div>

            </div>
          </section>

          {/* Matchs bonus - 4 grands championnats */}
          <section
            className="relative overflow-hidden rounded-3xl border border-slate-800 p-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] sm:p-6 space-y-5"
            style={{
              backgroundImage: "url('/match-bonus.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Flame className="size-4" />
                </span>

                <h2 className="font-display text-lg tracking-wide text-white">
                  Matchs bonus
                  <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                    (1 match par championnat)
                  </span>
                </h2>
              </div>

              <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 shrink-0">
                <span className="font-mono text-[11px] font-bold text-amber-300">
                  🎯 Score exact = <span className="text-white">3 pts</span>
                  <span className="mx-2 text-amber-500">•</span>
                  ✅ Résultat = <span className="text-white">2 pts</span>
                </span>
              </div>
            </div>

            <div className="relative z-10 h-px bg-slate-800" />

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: "PL",
                  name: "Premier League",
                  logo: "/logos/championnats/england.png",
                  color: "from-purple-500/20 to-indigo-500/10",
                  border: "border-indigo-500/30",
                  text: "text-indigo-400",
                  button: "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,.45)]",
                  match: null as { home: string; away: string; time: string } | null
                },
                {
                  id: "BL",
                  name: "Bundesliga",
                  logo: "/logos/championnats/germany.png",
                  color: "from-red-500/20 to-amber-500/10",
                  border: "border-red-500/30",
                  text: "text-red-400",
                  button: "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,.45)]",
                  match: null as { home: string; away: string; time: string } | null
                },
                {
                  id: "SA",
                  name: "Serie A",
                  logo: "/logos/championnats/italy.png",
                  color: "from-blue-500/20 to-cyan-500/10",
                  border: "border-blue-500/30",
                  text: "text-blue-400",
                  button: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,.45)]",
                  match: null as { home: string; away: string; time: string } | null
                },
                {
                  id: "LL",
                  name: "LaLiga EA SPORTS",
                  logo: "/logos/championnats/spain.png",
                  color: "from-yellow-500/20 to-orange-500/10",
                  border: "border-yellow-500/30",
                  text: "text-yellow-400",
                  button: "bg-yellow-500 hover:bg-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(234,179,8,.45)]",
                  match: null as { home: string; away: string; time: string } | null
                },
              ].map((league) => (
                <div
                  key={league.id}
                  className={`group relative overflow-hidden rounded-2xl border ${league.border} bg-slate-950/60 backdrop-blur-xl p-4 flex flex-col justify-between gap-4 shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-white/20`}
                >
                  <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-white/10 blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex items-center justify-center">
                    <img
                      src={league.logo}
                      alt={league.name}
                      className="mx-auto h-20 w-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,.35)] group-hover:scale-110 transition-all duration-300"
                    />
                  </div>

                  <div className="relative z-10 mt-4">
                    <h3 className={`text-center text-xl font-black ${league.text}`}>
                      {league.name}
                    </h3>

                    {league.match ? (
                      <>
                        <div className="mt-4 flex items-center justify-center">
                          <div className="flex-1 text-center">
                            <p className="font-display text-sm font-bold text-white">
                              {league.match.home}
                            </p>
                          </div>

                          <div className="mx-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white">
                            VS
                          </div>

                          <div className="flex-1 text-center">
                            <p className="font-display text-sm font-bold text-white">
                              {league.match.away}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-center font-mono text-[11px] text-slate-400">
                          {league.match.time}
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 text-center text-xs text-slate-400">
                        Aucun match importé
                      </p>
                    )}
                  </div>

                  <button className={`relative z-10 mt-5 w-full rounded-xl py-2.5 font-display text-sm font-bold transition-all duration-300 hover:scale-[1.03] ${league.button}`}>
                    Pronostiquer
                  </button>
                </div>
              ))}
            </div>

            <p className="relative z-10 text-center text-[11px] text-slate-500 pt-1">
              Tu ne peux choisir qu'un seul match bonus par championnat.
            </p>
          </section>

        </div>
      </div>

      {/* ================= BARRE D'ACTION FLOTTANTE PREMIUM ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 sm:px-6">
        <div className="pointer-events-auto w-full max-w-3xl rounded-3xl border border-slate-800 bg-[#0d1322] bg-cover bg-center/90 p-3 shadow-[0_10px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-4">
          <div className="mb-3 flex items-center justify-center gap-3 px-1">
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