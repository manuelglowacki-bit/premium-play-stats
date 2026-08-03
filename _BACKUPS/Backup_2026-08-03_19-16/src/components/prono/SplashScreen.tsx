import { useEffect, useState } from "react";
import { Trophy, Flame, Target } from "lucide-react";

const DURATION_MS = 3500;
const LOADING_STEPS = [
  { at: 0, text: "ANALYSE DES STATISTIQUES..." },
  { at: 30, text: "CALCUL DES TENDANCES..." },
  { at: 65, text: "ÉCHAUFFEMENT DES JOUEURS..." },
  { at: 90, text: "COUP D'ENVOI IMMINENT ⚽" },
];

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [currentText, setCurrentText] = useState(LOADING_STEPS[0].text);

  useEffect(() => {
    const start = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - start;
      const next = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(next);

      const activeStep = [...LOADING_STEPS].reverse().find(step => next >= step.at);
      if (activeStep) setCurrentText(activeStep.text);

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        setExiting(true);
        window.setTimeout(onDone, 800);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] text-white transition-all duration-1000 ease-[cubic-bezier(0.87,0,0.13,1)] ${
        exiting ? "pointer-events-none opacity-0 -translate-y-full blur-xl" : "opacity-100 translate-y-0"
      }`}
      aria-live="polite"
    >
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">
        <div className="relative flex items-center justify-center mb-8 animate-[bounce_2s_infinite]">
          <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 rounded-full"></div>
          <div className="relative bg-zinc-950 border border-emerald-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transform -skew-x-6">
            <Trophy className="w-16 h-16 text-emerald-400 transform skew-x-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="text-center mb-12 transform -skew-x-6">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-300 to-zinc-600 drop-shadow-sm">
            PRONO<span className="text-emerald-500">L1</span>
          </h1>
          <p className="mt-2 text-sm font-bold tracking-[0.3em] text-zinc-400 uppercase">
            <Target className="inline w-4 h-4 mr-1 text-emerald-500 mb-1" />
            Saison 2026
          </p>
        </div>

        <div className="w-full relative transform -skew-x-6">
          <div className="flex justify-between items-end mb-2 font-mono text-xs uppercase tracking-widest text-zinc-400">
            <span className="flex items-center gap-2">
              <Flame className="w-3 h-3 text-amber-500 animate-pulse" />
              {currentText}
            </span>
            <span className="text-emerald-400 font-bold text-sm">{Math.round(progress)}%</span>
          </div>
          
          <div className="h-1.5 w-full bg-zinc-900 border-b border-zinc-800 overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-[1px]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
