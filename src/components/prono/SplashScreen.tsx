import { useCallback, useEffect, useRef, useState } from "react";
import { Trophy, Target, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Duree de l'intro. Elle etait figee a 4000 ms (+ 750 ms de sortie), soit
// pres de 5 secondes AVANT CHAQUE arrivee sur le site, meme quand tout etait
// deja charge. Joli la premiere fois, penible la dixieme.
//
// - premiere venue de la journee : intro complete, mais deux fois plus courte
// - venue suivante : version express
// - animations desactivees par le systeme : on ne retient personne
const FIRST_VISIT_MS = 2200;
const RETURNING_MS = 1100;
const REDUCED_MOTION_MS = 500;
const EXIT_MS = 450;
const SEEN_KEY = "prono:splash-seen-at";
const SEEN_WINDOW_MS = 6 * 60 * 60 * 1000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Le navigateur peut refuser l'acces au stockage (navigation privee, reglages
// stricts) : dans ce cas on retombe simplement sur l'intro complete.
function seenRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < SEEN_WINDOW_MS;
  } catch {
    return false;
  }
}

function rememberSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : sans consequence */
  }
}

function splashDuration(): number {
  if (prefersReducedMotion()) return REDUCED_MOTION_MS;
  return seenRecently() ? RETURNING_MS : FIRST_VISIT_MS;
}

// Particules lumineuses positionnées manuellement pour un rendu premium
// et stable sur toutes les tailles d'écran (pas de génération aléatoire
// qui ferait "sauter" le rendu entre deux affichages).
const PARTICLES = [
  { left: "12%", top: "22%", size: 5, color: "emerald", delay: "0s", duration: "5s" },
  { left: "78%", top: "18%", size: 4, color: "amber", delay: "0.8s", duration: "6s" },
  { left: "85%", top: "55%", size: 6, color: "emerald", delay: "1.6s", duration: "7s" },
  { left: "8%", top: "65%", size: 4, color: "amber", delay: "2.2s", duration: "5.5s" },
  { left: "50%", top: "12%", size: 3, color: "emerald", delay: "0.4s", duration: "4.5s" },
  { left: "22%", top: "80%", size: 5, color: "emerald", delay: "1.2s", duration: "6.5s" },
  { left: "68%", top: "78%", size: 4, color: "amber", delay: "0.2s", duration: "5.8s" },
  { left: "92%", top: "32%", size: 3, color: "emerald", delay: "2.8s", duration: "4.8s" },
  { left: "32%", top: "8%", size: 3, color: "amber", delay: "1.8s", duration: "6.2s" },
  { left: "5%", top: "40%", size: 4, color: "emerald", delay: "3.2s", duration: "7.2s" },
];

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  // Saison affichee. Elle etait ecrite en dur ("Saison 2026") : tant qu'elle
  // n'est pas connue, on n'affiche rien plutot qu'une valeur fausse.
  const [season, setSeason] = useState<string | null>(null);

  // onDone est recree a chaque rendu du parent : on le garde dans une ref
  // pour que l'animation ne reparte jamais de zero.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    rememberSeen();
    setProgress(100);
    setExiting(true);
    window.setTimeout(() => onDoneRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    const duration = splashDuration();
    const start = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(elapsed / duration, 1);
      // Demarrage franc puis ralentissement : la barre parait plus vive
      // qu'une progression lineaire, a duree identique.
      setProgress(Math.round((1 - Math.pow(1 - ratio, 3)) * 100));

      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  // Passer l'intro : clic, touche ou bouton. Personne ne doit etre retenu
  // devant une animation qu'il a deja vue cent fois.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Saison reelle, lue dans app_settings comme partout ailleurs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("app_settings").select("season").eq("id", 1).maybeSingle();
        if (!cancelled && data?.season) setSeason(String(data.season));
      } catch {
        /* intro purement visuelle : une saison inconnue n'empeche rien */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[9999] flex cursor-pointer flex-col overflow-hidden bg-[#020813] text-white transition-all duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] ${
        exiting
          ? "pointer-events-none opacity-0 -translate-y-6 blur-lg"
          : "opacity-100 translate-y-0"
      }`}
      aria-live="polite"
      aria-busy={!exiting}
    >
      <style>{`
        @keyframes splash-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .splash-fade-up { animation: splash-fade-up .7s cubic-bezier(.22,1,.36,1) both; }

        @keyframes splash-scale-in {
          from { opacity: 0; transform: scale(.82); }
          to { opacity: 1; transform: scale(1); }
        }
        .splash-scale-in { animation: splash-scale-in .8s cubic-bezier(.22,1,.36,1) both; }

        @keyframes splash-drift {
          0% { transform: translate3d(0,0,0); opacity: 0; }
          15% { opacity: .9; }
          85% { opacity: .9; }
          100% { transform: translate3d(-8px,-34px,0); opacity: 0; }
        }
        .splash-particle { animation: splash-drift linear infinite; }

        @keyframes splash-logo-glow {
          0%,100% { filter: drop-shadow(0 0 14px rgba(16,185,129,.35)); }
          50% { filter: drop-shadow(0 0 26px rgba(16,185,129,.65)); }
        }
        .splash-logo-glow { animation: splash-logo-glow 3s ease-in-out infinite; }

        @keyframes splash-circle-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .splash-circle-rotate { animation: splash-circle-rotate 14s linear infinite; }
        .splash-circle-rotate-reverse { animation: splash-circle-rotate 20s linear infinite reverse; }

        @keyframes splash-gold-pulse {
          0%,100% { opacity: .85; filter: drop-shadow(0 0 8px rgba(245,166,35,.4)); }
          50% { opacity: 1; filter: drop-shadow(0 0 16px rgba(245,166,35,.7)); }
        }
        .splash-gold-pulse { animation: splash-gold-pulse 2.6s ease-in-out infinite; }

        @keyframes splash-dot-pulse {
          0%,100% { opacity: 1; box-shadow: 0 0 8px 2px rgba(16,185,129,.6); }
          50% { opacity: .5; box-shadow: 0 0 4px 1px rgba(16,185,129,.3); }
        }
        .splash-dot-pulse { animation: splash-dot-pulse 1.8s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .splash-fade-up, .splash-scale-in, .splash-particle,
          .splash-logo-glow, .splash-circle-rotate,
          .splash-circle-rotate-reverse, .splash-gold-pulse,
          .splash-dot-pulse { animation: none !important; }
        }
      `}</style>

      {/* ================= FOND STADE NOCTURNE ================= */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: "url('/arriere%20plan%20general.png')" }}
      />
      {/* Voile bleu nuit profond pour l'ambiance */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,.82)_0%,rgba(2,8,18,.62)_40%,#020813_92%)]" />
      {/* Vignette latérale */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,8,18,0)_35%,rgba(2,8,18,.55)_100%)]" />
      {/* Reflets Ligue 1 très subtils */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-emerald-500/5 mix-blend-overlay" />

      {/* ================= GRILLE TECHNIQUE DISCRÈTE ================= */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_45%,#000_60%,transparent_100%)]"
      />

      {/* ================= LIGNES FUTURISTES FINES ================= */}
      <div
        aria-hidden
        className="absolute left-1/2 top-0 h-40 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent"
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-32 w-px -translate-x-1/2 bg-gradient-to-t from-transparent via-amber-400/15 to-transparent"
      />

      {/* ================= PARTICULES LUMINEUSES ================= */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={`splash-particle pointer-events-none absolute rounded-full ${
            p.color === "amber" ? "bg-amber-300/70" : "bg-emerald-300/70"
          }`}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: `0 0 ${p.size * 2.5}px ${
              p.color === "amber" ? "rgba(252,211,77,.55)" : "rgba(110,231,183,.55)"
            }`,
          }}
        />
      ))}

      {/* Passer l'intro. Le clic sur le fond fait la meme chose, mais un
          bouton visible evite d'avoir a le deviner. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
        className="absolute right-4 z-20 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-white/70 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
        style={{ top: "max(env(safe-area-inset-top), 1rem)" }}
      >
        Passer
      </button>

      {/* ================= CONTENU ================= */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between px-6 pb-6 pt-[max(env(safe-area-inset-top),2rem)]">
        {/* ---- HAUT : LOGO + TITRE + SAISON ---- */}
        <div className="flex w-full flex-col items-center">
          {/* Symbole L1 premium */}
          <div className="splash-scale-in relative flex items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-emerald-500/15 blur-3xl"
              style={{ transform: "scale(1.4)" }}
            />
            <div className="splash-logo-glow relative flex size-24 items-center justify-center rounded-3xl border border-white/10 bg-[#050b16]/70 backdrop-blur-md md:size-28">
              <img
                src="/logo%20ligue%201%20white.png"
                alt="Ligue 1"
                className="h-16 w-auto object-contain md:h-[72px]"
              />
            </div>
          </div>

          {/* PRONO L1 */}
          <h1
            className="splash-fade-up mt-5 text-center font-display text-[2.6rem] font-black uppercase leading-none tracking-[-0.02em] md:text-6xl"
            style={{ animationDelay: "180ms" }}
          >
            <span
              className="text-white"
              style={{ textShadow: "0 1px 0 rgba(0,0,0,.4), 0 0 22px rgba(255,255,255,.12)" }}
            >
              PRONO
            </span>
            <span
              className="text-emerald-400"
              style={{ textShadow: "0 1px 0 rgba(0,0,0,.4), 0 0 22px rgba(16,185,129,.45)" }}
            >
              L1
            </span>
          </h1>

          {/* SAISON 2026 + séparateurs dorés */}
          <div
            className="splash-fade-up mt-3 flex items-center gap-3"
            style={{ animationDelay: "320ms" }}
          >
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/70 md:w-12" />
            <span className="min-w-[7ch] text-center font-mono text-[10px] font-semibold uppercase tracking-[.42em] text-amber-200/80 md:text-xs">
              {season ? `Saison ${season}` : "Ligue 1"}
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/70 md:w-12" />
          </div>
        </div>

        {/* ---- MILIEU : TROPHÉE DANS CERCLE TECHNOLOGIQUE + SLOGAN ---- */}
        <div className="flex w-full flex-col items-center">
          {/* Cercle technologique */}
          <div className="splash-scale-in relative flex items-center justify-center" style={{ animationDelay: "300ms" }}>
            <svg
              viewBox="0 0 140 140"
              className="splash-circle-rotate absolute inset-0 size-32 md:size-40"
              aria-hidden
            >
              <circle
                cx="70" cy="70" r="66"
                fill="none" stroke="rgba(16,185,129,.35)" strokeWidth="1"
                strokeDasharray="3 7"
              />
              <circle
                cx="70" cy="70" r="58"
                fill="none" stroke="rgba(245,166,35,.3)" strokeWidth="1"
                strokeDasharray="1 5"
              />
            </svg>
            <svg
              viewBox="0 0 140 140"
              className="splash-circle-rotate-reverse absolute inset-0 size-32 md:size-40"
              aria-hidden
            >
              <path
                d="M 70 8 A 62 62 0 0 1 70 132"
                fill="none" stroke="rgba(110,231,183,.55)" strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="90 300"
              />
            </svg>

            {/* Trophée doré */}
            <div className="splash-gold-pulse relative flex size-20 items-center justify-center rounded-full border border-amber-400/20 bg-[#050b16]/60 backdrop-blur-sm md:size-24">
              <Trophy
                className="size-10 text-amber-400 md:size-12"
                strokeWidth={1.4}
                fill="rgba(245,166,35,.12)"
              />
            </div>
          </div>

          {/* Slogan */}
          <p
            className="splash-fade-up mt-6 text-center font-display text-sm font-bold uppercase tracking-[.3em] text-white/90 md:text-base"
            style={{ animationDelay: "480ms", textShadow: "0 1px 4px rgba(0,0,0,.6)" }}
          >
            Pronostique<span className="text-emerald-400">.</span> Compète
            <span className="text-emerald-400">.</span> Triomphe
            <span className="text-emerald-400">.</span>
          </p>

          {/* Fine ligne lumineuse + point central */}
          <div
            className="splash-fade-up relative mt-4 flex w-full max-w-[240px] items-center"
            style={{ animationDelay: "560ms" }}
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-400/20 to-emerald-400/60" />
            <span className="splash-dot-pulse mx-2 size-1.5 rounded-full bg-emerald-400" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-400/20 to-emerald-400/60" />
          </div>
        </div>

        {/* ---- BAS : CHARGEMENT + 3 BLOCS + LIGUE 1 ---- */}
        <div className="flex w-full flex-col items-center">
          {/* Zone de chargement */}
          <div className="splash-fade-up w-full" style={{ animationDelay: "640ms" }}>
            <div className="flex items-end justify-between">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[.24em] text-emerald-400 md:text-[10px]">
                {season ? `Préparation de la saison ${season}` : "Préparation de votre saison"}
              </span>
              <span className="font-display text-xl font-black leading-none text-emerald-400 md:text-2xl">
                {Math.round(progress)}
                <span className="text-[0.6em] align-top">%</span>
              </span>
            </div>

            {/* Barre de progression fine et élégante */}
            <div
              role="progressbar"
              aria-label="Chargement de l'application"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,.8)]"
                style={{ width: `${progress}%`, transition: "width .12s linear" }}
              />
            </div>
          </div>

          {/* 3 BLOCS FONCTIONNALITÉS */}
          <div
            className="splash-fade-up mt-7 grid w-full grid-cols-3 items-center"
            style={{ animationDelay: "760ms" }}
          >
            {/* Bloc 1 */}
            <div className="flex flex-col items-center gap-1.5 px-1 text-center">
              <div className="splash-gold-pulse">
                <Target className="size-5 text-amber-400 md:size-6" strokeWidth={1.6} />
              </div>
              <p className="font-mono text-[8px] font-bold uppercase leading-tight tracking-[.14em] text-white/85 md:text-[9px]">
                Pronostique
                <br />
                <span className="text-emerald-400">chaque match</span>
              </p>
            </div>

            {/* Séparateur */}
            <span className="h-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

            {/* Bloc 2 */}
            <div className="flex flex-col items-center gap-1.5 px-1 text-center">
              <div className="splash-gold-pulse" style={{ animationDelay: ".4s" }}>
                <Crown className="size-5 text-amber-400 md:size-6" strokeWidth={1.6} />
              </div>
              <p className="font-mono text-[8px] font-bold uppercase leading-tight tracking-[.14em] text-white/85 md:text-[9px]">
                Grimpe
                <br />
                <span className="text-emerald-400">au classement</span>
              </p>
            </div>

            {/* Séparateur */}
            <span className="h-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

            {/* Bloc 3 */}
            <div className="flex flex-col items-center gap-1.5 px-1 text-center">
              <div className="splash-gold-pulse" style={{ animationDelay: ".8s" }}>
                <Trophy className="size-5 text-amber-400 md:size-6" strokeWidth={1.6} />
              </div>
              <p className="font-mono text-[8px] font-bold uppercase leading-tight tracking-[.14em] text-white/85 md:text-[9px]">
                Débloque
                <br />
                <span className="text-emerald-400">des trophées</span>
              </p>
            </div>
          </div>

          {/* Bas de page : Ligue 1 McDonald's */}
          <div
            className="splash-fade-up mt-7 flex items-center gap-3 opacity-80"
            style={{ animationDelay: "880ms" }}
          >
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-400/50" />
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[.3em] text-amber-100/70 md:text-[9px]">
              Ligue 1 McDonald's
            </span>
            <span className="h-px w-6 bg-gradient-to-l from-transparent to-amber-400/50" />
          </div>
        </div>
      </div>
    </div>
  );
}