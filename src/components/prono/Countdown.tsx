"use client";

import { useState, useEffect } from "react";
import { Calendar, Flame, ArrowRight, CalendarDays, Clock, Timer, Gauge } from "lucide-react";

export function useCountdown(targetDate: number) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export const COUNTDOWN_TARGET = new Date("2026-08-21T20:45:00").getTime();

/** Juste les 4 blocs de temps colorés (version compacte), réutilisables n'importe où */
export function CountdownBlocks() {
  const timeLeft = useCountdown(COUNTDOWN_TARGET);

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* Jours (Vert) */}
      <div className="bg-[#061f17] border border-emerald-900/60 rounded-xl p-2 flex flex-col items-center justify-center shadow-inner">
        <span className="text-xl font-black text-emerald-500 mb-0.5">{String(timeLeft.days).padStart(2, '0')}</span>
        <span className="text-[9px] font-bold text-slate-400 tracking-wider">JOURS</span>
      </div>
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
export function CountdownBlocksIconic() {
  const timeLeft = useCountdown(COUNTDOWN_TARGET);

  const items = [
    { value: timeLeft.days, label: "JOURS", Icon: CalendarDays, color: "emerald" as const },
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
          <div
            key={label}
            className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex items-center gap-3`}
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-full border ${c.border} ${c.iconBg} ${c.text}`}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <b className={`block font-display text-3xl leading-none ${c.text}`}>
                {String(value).padStart(2, "0")}
              </b>
              <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
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