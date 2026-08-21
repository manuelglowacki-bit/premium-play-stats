// @/components/prono/ImmersivePodium.tsx
//
// Podium immersif — REFONTE TOTALE : bannières "fanion" construites en pur
// CSS (clip-path, gradients, glow superposés), plus aucune image plaquée en
// grand rectangle. Décor cinématique (vignette + faisceaux de lumière)
// entièrement CSS derrière le trio. Les VRAIES données des 3 premiers du
// classement (déjà calculées/triées par classement.tsx) sont injectées dans
// le flux normal de chaque bannière — aucune donnée fictive, aucun calcul ici.

import { getInitials, TeamCrest, type PlayerCardData } from "./PlayerCard";

export type ImmersivePodiumPlayer = {
  rank: 1 | 2 | 3;
  data: PlayerCardData;
  isMe: boolean;
};

interface ImmersivePodiumProps {
  /** 0 à 3 entrées réelles (le podium tolère un classement avec moins de 3 joueurs). */
  players: ImmersivePodiumPlayer[];
}

type Tier = "gold" | "silver" | "bronze";

const TIER_BY_RANK: Record<1 | 2 | 3, Tier> = { 1: "gold", 2: "silver", 3: "bronze" };

// Fanion : rectangle jusqu'à 70% de la hauteur, puis pointe centrale — c'est
// le DÉCOUPAGE (clip-path) qui dessine la forme, pas une image.
const PENNANT_CLIP = "polygon(0% 0%, 100% 0%, 100% 76%, 50% 100%, 0% 76%)";

const TIER_CONFIG: Record<
  Tier,
  {
    edge: string;
    clothFrom: string;
    clothTo: string;
    text: string;
    textDim: string;
    ringClass: string;
    glowRgba: string;
    estradeFrom: string;
    estradeTo: string;
  }
> = {
  gold: {
    edge: "#f7c968",
    clothFrom: "#3c2c11",
    clothTo: "#100b03",
    text: "text-amber-200",
    textDim: "text-amber-200/55",
    ringClass: "ring-amber-300/70",
    glowRgba: "245,166,35",
    estradeFrom: "#f5c168",
    estradeTo: "#6b4a12",
  },
  silver: {
    edge: "#7fd6ff",
    clothFrom: "#102037",
    clothTo: "#070c17",
    text: "text-sky-200",
    textDim: "text-sky-200/55",
    ringClass: "ring-sky-300/70",
    glowRgba: "56,189,248",
    estradeFrom: "#7fd6ff",
    estradeTo: "#0b3a57",
  },
  bronze: {
    edge: "#e2a668",
    clothFrom: "#3a2411",
    clothTo: "#140c05",
    text: "text-orange-200",
    textDim: "text-orange-200/55",
    ringClass: "ring-orange-300/65",
    glowRgba: "217,119,6",
    estradeFrom: "#e2a668",
    estradeTo: "#5c3413",
  },
};

// Ordre d'affichage : 2 - 1 - 3 (le 1er dominant au centre).
const DISPLAY_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

export function ImmersivePodium({ players }: ImmersivePodiumProps) {
  const byRank = new Map(players.map((p) => [p.rank, p]));
  if (players.length === 0) return null;

  return (
    <section className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem]">
      <style>{`
        @keyframes podium-rise {
          from { opacity: 0; transform: translateY(28px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes podium-crown-drop {
          from { opacity: 0; transform: translateY(-10px) scale(.7); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes podium-points-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes podium-glow-pulse {
          0%, 100% { opacity: .45; }
          50% { opacity: .85; }
        }
        @keyframes podium-beam-drift {
          0%, 100% { transform: translateX(-4%) rotate(-6deg); }
          50% { transform: translateX(4%) rotate(-6deg); }
        }
        .pd-rise { animation: podium-rise .75s cubic-bezier(.22,1,.36,1) both; }
        .pd-crown { animation: podium-crown-drop .6s cubic-bezier(.22,1,.36,1) .5s both; }
        .pd-points { animation: podium-points-in .5s ease .55s both; }
        .pd-pulse { animation: podium-glow-pulse 3.4s ease-in-out infinite; }
        .pd-beam { animation: podium-beam-drift 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pd-rise, .pd-crown, .pd-points, .pd-pulse, .pd-beam { animation: none; }
        }
      `}</style>

      {/* ===== Décor cinématique (100% CSS, aucune image) ===== */}
      <div className="pointer-events-none absolute inset-0 bg-[#040810]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(22,82,240,.16),transparent_60%)]" />
        <div className="pd-beam absolute left-1/2 top-0 h-full w-[55%] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_35%,rgba(245,196,90,.10)_50%,transparent_65%)] blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(0,0,0,.7),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.8) .5px, transparent .5px)", backgroundSize: "26px 26px" }}
        />
      </div>

      <div className="relative grid grid-cols-[1fr_1.14fr_1fr] items-end gap-1.5 px-3 pb-6 pt-10 sm:gap-3 sm:px-6 sm:pb-8 sm:pt-14 md:gap-5">
        {DISPLAY_ORDER.map((rank, i) => {
          const entry = byRank.get(rank);
          return <PennantColumn key={rank} rank={rank} entry={entry} delayMs={i * 140} />;
        })}
      </div>
    </section>
  );
}

function PennantColumn({
  rank,
  entry,
  delayMs,
}: {
  rank: 1 | 2 | 3;
  entry: ImmersivePodiumPlayer | undefined;
  delayMs: number;
}) {
  const tier = TIER_BY_RANK[rank];
  const cfg = TIER_CONFIG[tier];
  const isFirst = tier === "gold";

  if (!entry) {
    return <div className="hidden sm:block" />;
  }

  const p = entry.data;
  const pennantHeight = isFirst ? "h-[210px] sm:h-[300px] md:h-[340px]" : "h-[178px] sm:h-[254px] md:h-[288px]";
  const avatarSize = isFirst ? "size-11 sm:size-[72px] md:size-20" : "size-9 sm:size-14 md:size-16";
  const estradeH = isFirst ? "h-7 sm:h-11 md:h-12" : "h-5 sm:h-7 md:h-8";

  return (
    <div
      className={`pd-rise relative flex flex-col items-center ${isFirst ? "-translate-y-2 sm:-translate-y-4" : ""}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Couronne (1er uniquement) */}
      {isFirst && (
        <span className="pd-crown relative z-20 -mb-1 text-lg drop-shadow-[0_0_12px_rgba(245,196,90,.85)] sm:text-2xl md:text-3xl">
          👑
        </span>
      )}

      {/* Tige / attache */}
      <div className="relative z-10 flex items-center gap-1">
        <span className="size-1 rounded-full sm:size-1.5" style={{ background: cfg.edge, boxShadow: `0 0 6px ${cfg.edge}` }} />
        <span className="h-px w-6 sm:w-9" style={{ background: `linear-gradient(90deg, transparent, ${cfg.edge}, transparent)` }} />
        <span className="size-1 rounded-full sm:size-1.5" style={{ background: cfg.edge, boxShadow: `0 0 6px ${cfg.edge}` }} />
      </div>

      {/* ===== Fanion (clip-path — pur CSS) ===== */}
      <div className={`relative mt-0.5 w-full ${pennantHeight}`}>
        {/* Glow derrière la forme */}
        <div
          className="pd-pulse absolute -inset-2 sm:-inset-3"
          style={{ clipPath: PENNANT_CLIP, background: cfg.edge, filter: "blur(14px)", opacity: 0.4 }}
        />
        {/* Bordure lumineuse (couche extérieure pleine) */}
        <div className="absolute inset-0" style={{ clipPath: PENNANT_CLIP, background: cfg.edge }} />
        {/* Tissu (couche intérieure, légèrement rétractée = bordure visible) */}
        <div
          className="absolute inset-[2px] sm:inset-[2.5px]"
          style={{
            clipPath: PENNANT_CLIP,
            background: `linear-gradient(180deg, ${cfg.clothFrom} 0%, ${cfg.clothTo} 100%)`,
          }}
        >
          {/* Trame tissu très discrète */}
          <div
            className="absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0px, rgba(255,255,255,.06) 1px, transparent 1px, transparent 7px)",
            }}
          />
          {/* Plis / profondeur */}
          <div className="absolute inset-0 shadow-[inset_0_16px_26px_-8px_rgba(0,0,0,.6),inset_0_-30px_50px_-16px_rgba(0,0,0,.65)]" />
        </div>

        {/* ===== Contenu (flux normal, jamais coupé par la pointe à 70%) ===== */}
        <div className="relative z-10 flex h-full flex-col items-center px-1.5 pb-2 pt-2 text-center sm:px-3 sm:pt-3">
          {entry.isMe && (
            <span className="absolute right-0.5 top-0.5 rounded-full bg-emerald-400 px-1.5 py-0.5 font-mono text-[6px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_8px_rgba(16,185,129,.6)] sm:right-1 sm:top-1 sm:px-2 sm:text-[8px]">
              Vous
            </span>
          )}

          <span className={`font-display text-lg font-black italic leading-none sm:text-2xl md:text-3xl ${cfg.text}`}>
            {rank}
          </span>

          <div
            className={`relative mt-1 ${avatarSize} shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-slate-900 shadow-[0_4px_14px_rgba(0,0,0,.6)] ring-2 sm:mt-1.5 ${cfg.ringClass}`}
          >
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-[10px] font-black text-white sm:text-base md:text-lg">
                {getInitials(p.pseudo)}
              </span>
            )}
          </div>

          <span className="mt-1 max-w-full truncate px-0.5 font-display text-[10.5px] font-black leading-none text-white sm:mt-1.5 sm:text-sm md:text-base">
            {p.pseudo || "Joueur"}
          </span>

          {p.favoriteTeam && (
            <div className="mt-1 sm:mt-1.5">
              <TeamCrest team={p.favoriteTeam} size="size-3.5 sm:size-[18px] md:size-5" />
            </div>
          )}

          <div className="pd-points mt-1 flex items-end justify-center gap-0.5 sm:mt-2">
            <span
              className={`font-display font-black leading-none text-white ${isFirst ? "text-2xl sm:text-4xl md:text-[2.75rem]" : "text-lg sm:text-2xl md:text-3xl"}`}
              style={{ filter: `drop-shadow(0 0 14px rgba(${cfg.glowRgba},.5))` }}
            >
              {p.points}
            </span>
            <span className="mb-0.5 font-mono text-[6.5px] font-bold uppercase tracking-widest text-slate-300 sm:mb-1 sm:text-[9px]">
              pts
            </span>
          </div>

          <span className="mt-0.5 whitespace-nowrap font-mono text-[6.5px] font-bold uppercase tracking-[.14em] text-slate-300 sm:mt-1 sm:text-[9px]">
            {p.exactScores} exact{p.exactScores > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ===== Estrade 3D ===== */}
      <div className={`relative -mt-1 w-[70%] ${estradeH} sm:-mt-1.5`}>
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: `linear-gradient(180deg, ${cfg.estradeFrom} 0%, ${cfg.estradeTo} 75%, transparent 100%)`,
            boxShadow: `0 0 22px 2px rgba(${cfg.glowRgba},.4)`,
          }}
        />
        <div
          className="absolute inset-x-[8%] top-0 h-[2px] rounded-full"
          style={{ background: cfg.edge, boxShadow: `0 0 10px ${cfg.edge}` }}
        />
      </div>
      <div
        className="h-1.5 w-[52%] rounded-[50%] opacity-60 blur-[2px] sm:h-2"
        style={{ background: `radial-gradient(ellipse, rgba(${cfg.glowRgba},.5), transparent 70%)` }}
      />
    </div>
  );
}
