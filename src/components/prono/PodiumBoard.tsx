import type { CSSProperties } from "react";
import { withAlpha, type TeamTheme } from "@/lib/team-theme";
import { Badge } from "./Badge";
import { TeamCrest, getInitials, type PlayerCardData, type ExtraBadge } from "./PlayerCard";

/**
 * Podium (Top 3) — habillé par l'image /public/podium-bg.png (3 socles en
 * forme de blason : argent/or/bronze, couronne, numéros, projecteurs — tout
 * ça fait partie de l'image, pas du CSS). Ce composant ne fait que
 * positionner les données réelles (avatar, pseudo, club, points, badges)
 * dans la zone vide de chaque blason.
 *
 * Les coordonnées ci-dessous ont été mesurées directement sur les pixels de
 * l'image (1537×1023, décodée hors-ligne) plutôt qu'estimées à l'œil : pour
 * chaque carte, on relève la zone sombre intérieure (hors du liseré
 * or/argent/bronze) sur plusieurs colonnes, puis on garde l'intersection la
 * plus restrictive pour être sûr de ne jamais déborder sur le cadre.
 *
 * Desktop : les 3 zones sont positionnées en `%` de l'image entière, superposée une seule fois.
 * Mobile (podium empilé) : on réutilise la MÊME image, recadrée par carte en
 * CSS (`background-size: 300% auto` + `background-position-x: 0/50/100%`)
 * plutôt que de dupliquer le fichier — chaque carte affiche alors un tiers
 * de l'image à sa taille native, et les coordonnées de contenu sont
 * recalculées dans le repère de ce tiers.
 */

const IMAGE_ASPECT = "1537 / 1023";
const THIRD_ASPECT = `${1537 / 3} / 1023`;

type Zone = { left: number; top: number; right: number; bottom: number };

type PodiumSlot = {
  rank: 1 | 2 | 3;
  /** Zone de contenu en % de l'image complète (mise en page desktop). */
  desktop: Zone;
  /** Zone de contenu en % du tiers d'image affiché (mise en page mobile empilée). */
  mobile: Zone;
  /** background-position-x du recadrage mobile (0% = tiers gauche, 50% = centre, 100% = tiers droit). */
  mobileBgPosition: string;
  text: string;
};

const PODIUM_SLOTS: PodiumSlot[] = [
  {
    rank: 2,
    desktop: { left: 8.85, top: 34.41, right: 31.1, bottom: 72.53 },
    mobile: { left: 26.55, top: 34.41, right: 93.29, bottom: 72.53 },
    mobileBgPosition: "0% 0%",
    text: "text-slate-200",
  },
  {
    rank: 1,
    desktop: { left: 38.91, top: 29.52, right: 61.29, bottom: 71.16 },
    mobile: { left: 16.72, top: 29.52, right: 83.87, bottom: 71.16 },
    mobileBgPosition: "50% 0%",
    text: "text-amber-300",
  },
  {
    rank: 3,
    desktop: { left: 70.59, top: 36.95, right: 89.26, bottom: 72.92 },
    mobile: { left: 11.78, top: 36.95, right: 67.79, bottom: 72.92 },
    mobileBgPosition: "100% 0%",
    text: "text-orange-300",
  },
];

export interface PodiumEntry {
  player: PlayerCardData;
  isMe: boolean;
  badges: ExtraBadge[];
}

export interface PodiumBoardProps {
  /** 1 à 3 entrées — n'importe quel sous-ensemble des rangs 1/2/3 (podium incomplet toléré). */
  entries: PodiumEntry[];
  /** Thème de l'équipe favorite du VIEWER (utilisateur connecté), pour l'accent "Toi" — jamais celui du joueur affiché. */
  viewerTheme?: TeamTheme;
}

function zoneStyle(z: Zone): CSSProperties {
  return {
    left: `${z.left}%`,
    top: `${z.top}%`,
    width: `${z.right - z.left}%`,
    height: `${z.bottom - z.top}%`,
  };
}

export function PodiumBoard({ entries, viewerTheme }: PodiumBoardProps) {
  const byRank = new Map(entries.map((e) => [e.player.rank, e]));

  return (
    <>
      {/* ================= DESKTOP : une seule image, 3 zones superposées =================
          max-w-4xl (au lieu d'un w-full pleine largeur) : le podium occupe moins de
          hauteur à l'écran — l'image restant en aspect-ratio fixe, limiter sa largeur
          limite mécaniquement sa hauteur — tout en gardant assez de place dans chaque
          blason pour des avatars/textes plus grands. */}
      <div className="relative mx-auto hidden w-full max-w-4xl lg:block" style={{ aspectRatio: IMAGE_ASPECT }}>
        <img
          src="/podium-bg.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        />
        {PODIUM_SLOTS.map((slot) => {
          const entry = byRank.get(slot.rank);
          if (!entry) return null;
          return (
            <div key={slot.rank} className="absolute" style={zoneStyle(slot.desktop)}>
              <PodiumContent entry={entry} slot={slot} viewerTheme={viewerTheme} />
            </div>
          );
        })}
      </div>

      {/* ================= MOBILE/TABLETTE : podium empilé, image recadrée par carte =================
          Largeur de carte réduite (260px au lieu de 320px) : chaque blason (ratio ~1:2)
          prend moins de hauteur cumulée une fois les 3 cartes empilées. */}
      <div className="mx-auto flex w-full max-w-[260px] flex-col gap-4 lg:hidden">
        {([1, 2, 3] as const).map((rank) => {
          const slot = PODIUM_SLOTS.find((s) => s.rank === rank)!;
          const entry = byRank.get(rank);
          if (!entry) return null;
          return (
            <div
              key={rank}
              className="relative w-full"
              style={{
                aspectRatio: THIRD_ASPECT,
                backgroundImage: "url('/podium-bg.png')",
                backgroundSize: "300% auto",
                backgroundPosition: slot.mobileBgPosition,
                backgroundRepeat: "no-repeat",
              }}
            >
              <div className="absolute" style={zoneStyle(slot.mobile)}>
                <PodiumContent entry={entry} slot={slot} viewerTheme={viewerTheme} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PodiumContent({ entry, slot, viewerTheme }: { entry: PodiumEntry; slot: PodiumSlot; viewerTheme?: TeamTheme }) {
  const { player, isMe, badges } = entry;
  const club = player.favoriteTeam;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden px-1 text-center sm:gap-2">
      {isMe && viewerTheme && (
        <span
          className="absolute -top-1 right-0 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: withAlpha(viewerTheme.primary, 0.25),
            border: `1px solid ${withAlpha(viewerTheme.primary, 0.65)}`,
            color: "#fff",
          }}
        >
          Toi
        </span>
      )}

      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-[#060b16] shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:size-16">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className={`font-display text-lg font-black sm:text-xl ${slot.text}`}>{getInitials(player.pseudo)}</span>
        )}
      </div>

      <h3 className="max-w-full truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</h3>

      {/* "❤️ RC Lens" + petit écusson, sous le pseudo */}
      {club && (
        <div className="flex max-w-full items-center gap-1 text-slate-300">
          <span className="text-xs leading-none">❤️</span>
          <TeamCrest team={club} size="size-4" />
          <span className="truncate font-mono text-[10px] font-medium sm:text-xs">{club.name}</span>
        </div>
      )}

      {/* Points + scores exacts sur une seule ligne, compacte et lisible */}
      <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] font-bold sm:text-sm">
        <span className={slot.text}>{player.points} pts</span>
        <span className="mx-1 text-slate-600">•</span>
        <span className="text-slate-300">
          {player.exactScores} score{player.exactScores !== 1 ? "s" : ""} exact{player.exactScores !== 1 ? "s" : ""}
        </span>
      </div>

      {badges.length > 0 && (
        <div className="flex items-center gap-1">
          {badges.map((b) => (
            <Badge key={b.kind} kind={b.kind} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
