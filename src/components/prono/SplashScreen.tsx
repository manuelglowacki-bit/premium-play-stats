import { useEffect, useState } from "react";

const DURATION_MS = 4000;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - start;
      const next = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(next);

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        setExiting(true);
        window.setTimeout(onDone, 700);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        exiting ? "pointer-events-none opacity-0 scale-105" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={!exiting}
    >
      {/* ambient halos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/4 size-[28rem] rounded-full bg-primary/25 blur-[120px] animate-drift"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-1/4 size-[26rem] rounded-full bg-gold/10 blur-[130px] animate-drift"
      />

      <div className="relative flex flex-col items-center text-center">
        {/* logo */}
        <div className="relative animate-rise">
          <span className="relative grid size-24 place-items-center rounded-full border-4 border-primary bg-background/80 font-display text-4xl font-extrabold text-primary shadow-[0_0_60px_-10px_var(--primary)] icon-lume">
            L1
          </span>
          <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping opacity-40" />
        </div>

        {/* brand wordmark */}
        <div className="mt-8 animate-rise" style={{ animationDelay: "120ms" }}>
          <b className="block font-display text-3xl tracking-[0.12em] text-foreground">
            PRONO
          </b>
          <strong className="block font-display text-xl tracking-[0.18em] text-gold">
            LIGUE <i className="not-italic text-primary">1</i>
          </strong>
        </div>

        {/* tagline */}
        <p
          className="mt-4 max-w-[16rem] text-sm font-medium leading-relaxed text-muted-foreground animate-rise"
          style={{ animationDelay: "240ms" }}
        >
          Prédis. Joue. Domine le championnat.
        </p>

        {/* progress bar */}
        <div
          className="mt-10 w-56 animate-rise"
          style={{ animationDelay: "360ms" }}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-[width] duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-muted-foreground">
            CHARGEMENT {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
}
