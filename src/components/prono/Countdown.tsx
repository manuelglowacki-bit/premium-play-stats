"use client";

import { useState, useEffect } from "react";
import { Calendar, Flame, ArrowRight, CalendarDays, Clock, Timer, Gauge } from "lucide-react";

function split(distance: number) {
  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
  };
}

const ZERO = { days: 0, hours: 0, minutes: 0, seconds: 0 };

export function useCountdown(targetDate: number) {
  // Etat initial calcule tout de suite : l'ancienne version partait de zero
  // et attendait le premier tick, soit une seconde de "00 00 00 00" a chaque
  // affichage de la page.
  const [timeLeft, setTimeLeft] = useState(() => {
    const distance = targetDate - Date.now();
    return distance > 0 ? split(distance) : ZERO;
  });

  useEffect(() => {
    const tick = () => {
      const distance = targetDate - Date.now();
      setTimeLeft(distance > 0 ? split(distance) : ZERO);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// Repli historique, conservé uniquement pour les appelants qui ne passent
// pas encore de cible. ATTENTION : c'est une date FIGÉE — une fois passée,
// le compte à rebours reste bloqué à 00 00 00 00. Tout appelant doit lui
// préférer le vrai coup d'envoi à venir (voir la prop `target`).
export const COUNTDOWN_TARGET = new Date("2026-08-21T20:45:00").getTime();

/** Juste les 4 blocs de temps colorés (version compacte), réutilisables n'importe où */
export function CountdownBlocks({ target }: { target?: number | null }) {
  const timeLeft = useCountdown(target ?? COUNTDOWN_TARGET);

  return (
    // auto-fit : la grille se referme quand le bloc "JOURS" disparait.
    <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-2">
      {/* Jours (Vert) — masque des qu'il n'en reste plus, meme raison que
          CountdownBlocksIconic : sous les 24 h, "00 JOURS" prend la place des
          minutes sans rien apprendre. */}
      {timeLeft.days > 0 && (
      <div className="bg-[#061f17] border border-emerald-900/60 rounded-xl p-2 flex flex-col items-center justify-center shadow-inner">
        <span className="text-xl font-black text-emerald-500 mb-0.5">{String(timeLeft.days).padStart(2, '0')}</span>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider">JOURS</span>
      </div>
      )}
      {/* Heures (Bleu) */}
      <div className="bg-[#0f172a] border border-blue-900/60 rounded-xl p-2 flex flex-col items-center justify-center shadow-inner">
        <span className="text-xl font-black text-blue-400 mb-0.5">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider">HEURES</span>
      </div>
      {/* Minutes (Orange) */}
      <div className="bg-[#2a170b] border border-amber-900/60 rounded-xl p-2 flex flex-col items-center justify-center shadow-inner">
        <span className="text-xl font-black text-amber-500 mb-0.5">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider">MIN</span>
      </div>
      {/* Secondes (Violet) */}
      <div className="bg-[#1e1635] border border-indigo-900/60 rounded-xl p-2 flex flex-col items-center justify-center shadow-inner">
        <span className="text-xl font-black text-indigo-400 mb-0.5">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider">SEC</span>
      </div>
    </div>
  );
}

/** Version "iconique" avec icône + libellé complet dans chaque bloc (style stade / MES PRONOSTICS) */
export function CountdownBlocksIconic({ target }: { target?: number | null }) {
  const timeLeft = useCountdown(target ?? COUNTDOWN_TARGET);

  // Les jours disparaissent quand il n'en reste plus. Un decompte passe
  // l'essentiel de sa vie sous les 24 h : "00 JOURS" occupait alors autant de
  // place que les minutes, qui sont la seule chose que le joueur regarde.
  const items = [
    ...(timeLeft.days > 0
      ? [{ value: timeLeft.days, label: "JOURS", Icon: CalendarDays, color: "emerald" as const }]
      : []),
    { value: timeLeft.hours, label: "HEURES", Icon: Clock, color: "sky" as const },
    { value: timeLeft.minutes, label: "MINUTES", Icon: Timer, color: "amber" as const },
    { value: timeLeft.seconds, label: "SECONDES", Icon: Gauge, color: "violet" as const },
  ];

  const colorMap = {
    emerald: { border: "border-emerald-500/40", text: "text-emerald-400", bg: "bg-emerald-500/10", iconBg: "bg-emerald-500/15" },
    sky: { border: "border-sky-500/40", text: "text-sky-400", bg: "bg-sky-500/10", iconBg: "bg-sky-500/15" },
    amber: { border: "border-amber-500/40", text: "text-amber-400", bg: "bg-amber-500/10", iconBg: "bg-amber-500/15" },
    violet: { border: "border-violet-500/40", text: "text-violet-400", bg: "bg-violet-500/10", iconBg: "bg-violet-500/15" },
  };

  return (
    <>
      {items.map(({ value, label, Icon, color }) => {
        const c = colorMap[color];
        return (
          /* Cartes divisees par deux en hauteur : elles faisaient pres de
             100 px chacune, soit un quart du bandeau pour quatre nombres. */
          <div
            key={label}
            className={`flex items-center gap-2.5 rounded-xl border ${c.border} ${c.bg} px-3 py-2`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-lg border ${c.border} ${c.iconBg} ${c.text}`}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <b className={`block font-display text-xl leading-none ${c.text}`}>
                {String(value).padStart(2, "0")}
              </b>
              <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Carte complète (en-tête + blocs + bouton), utilisée sur la page d'accueil */
export function Countdown() {
  const timeLeft = useCountdown(COUNTDOWN_TARGET);

  return (
    <div className="bg-[#0d1322] border border-slate-800/80 rounded-3xl p-6 w-full max-w-xl mx-auto shadow-2xl">
      
      {/* En-tête */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-slate-700/50 flex items-center justify-center bg-slate-800/30 shrink-0">
            <Calendar size={18} className="text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Prochaine journée</h2>
            <p className="text-sm text-slate-400 font-medium">J1 • Vendredi 21 août 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-900/50 px-3 py-1.5 rounded-full shrink-0">
          <Flame size={14} className="text-orange-500 fill-orange-500" />
          <span className="text-[10px] font-bold text-blue-400 tracking-wider">EN APPROCHE</span>
        </div>
      </div>

      {/* Blocs Compte à rebours colorés */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* Jours (Vert) */}
        <div className="bg-[#061f17] border border-emerald-900/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
          <span className="text-3xl font-black text-emerald-500 mb-1">{String(timeLeft.days).padStart(2, '0')}</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">JOURS</span>
        </div>
        {/* Heures (Bleu) */}
        <div className="bg-[#0f172a] border border-blue-900/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
          <span className="text-3xl font-black text-blue-400 mb-1">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">HEURES</span>
        </div>
        {/* Minutes (Orange) */}
        <div className="bg-[#2a170b] border border-amber-900/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
          <span className="text-3xl font-black text-amber-500 mb-1">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">MIN</span>
        </div>
        {/* Secondes (Violet) */}
        <div className="bg-[#1e1635] border border-indigo-900/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
          <span className="text-3xl font-black text-indigo-400 mb-1">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">SEC</span>
        </div>
      </div>

      {/* Bouton de bas de carte */}
      <button className="w-full bg-[#111827] hover:bg-slate-800 border border-slate-800 transition-all duration-200 rounded-2xl py-4 px-5 flex justify-between items-center group cursor-pointer shadow-md">
        <span className="font-bold text-white text-sm">Voir les matchs</span>
        <ArrowRight size={18} className="text-blue-500 group-hover:translate-x-1 transition-transform" />
      </button>

    </div>
  );
}

export default Countdown;