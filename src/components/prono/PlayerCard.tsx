import { memo, useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { withAlpha, type TeamTheme } from "@/lib/team-theme";
import { Badge, type BadgeKind } from "./Badge";

/**
 * Colonne "Évolution" — variation de rang par rapport à la journée
 * précédente. `previousRank` est `null` tant qu'aucun historique de
 * classement n'est stocké en base (voir toCardData dans classement.tsx) :
 * dans ce cas on affiche uniquement ➡ — plutôt que d'inventer une valeur.
 * Le jour où un vrai instantané de classement existera, il suffira de
 * peupler `previousRank` pour que les flèches colorées s'activent d'elles-mêmes.
 */
function EvolutionIndicator({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank == null) {
    return (
      <span
        title="Historique de progression bientôt disponible"
        className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-slate-500"
      >
        <Minus size={12} /> —
      </span>
    );
  }

  const delta = previousRank - rank; // positif = a gagné des places (rang plus petit)
  if (delta > 0) {
    return (
      <span title={`+${delta} place${delta > 1 ? "s" : ""} depuis la dernière journée`} className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-emerald-400">
        <ArrowUp size={12} /> +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span title={`${delta} place${delta < -1 ? "s" : ""} depuis la dernière journée`} className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-red-400">
        <ArrowDown size={12} /> {delta}
      </span>
    );
  }
  return (
    <span title="Position inchangée depuis la dernière journée" className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-slate-500">
      <Minus size={12} /> —
    </span>
  );
}

export function getInitials(pseudo: string | null): string {
  if (!pseudo || !pseudo.trim()) return "?";
  return pseudo.trim().slice(0, 2).toUpperCase();
}

/** Équipe favorite réelle telle que résolue depuis Supabase (table `teams`, via `profiles.favorite_team_id`). */
export type FavoriteTeam = { name: string; shortName: string | null; logoUrl: string | null };

/** Blason du club favori — toujours `logo_url` (table `teams`), jamais un logo statique/générique. Repli sur les initiales du nom si l'image est absente ou en échec. Réutilisé par ImmersivePodium.tsx. */
export function TeamCrest({ team, size = "size-5" }: { team: FavoriteTeam; size?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const showFallback = broken || !team.logoUrl;

  return (
    <div className={`relative ${size} shrink-0 overflow-hidden rounded-md border border-slate-800 bg-white/5 flex items-center justify-center`}>
      {showFallback ? (
        <span className="font-mono text-[8px] font-bold text-slate-300">{initials}</span>
      ) : (
        <img src={team.logoUrl!} alt={team.name} className="size-full object-contain p-0.5" onError={() => setBroken(true)} />
      )}
    </div>
  );
}

// ============================================================
// Carte joueur — composant réutilisable partout où un joueur doit être
// affiché sous forme de ligne (classement #4+ aujourd'hui ; profil, stats,
// trophées demain).
//
// Le podium (Top 3) n'utilise plus ce composant : il a sa propre mise en
// page (bannières suspendues) — voir ImmersivePodium.tsx, qui réutilise
// cependant TeamCrest/getInitials définis ici pour rester cohérent avec
// le reste du site.
// ============================================================
export type PlayerCardData = {
  id: string;
  pseudo: string | null;
  avatarUrl: string | null;
  /** Équipe favorite réelle (Supabase `teams`, via `favorite_team_id`) — `null` si non définie. */
  favoriteTeam: FavoriteTeam | null;
  rank: number;
  /** Rang à la journée précédente — `null` si aucun historique n'est encore stocké en base (voir EvolutionIndicator). */
  previousRank: number | null;
  points: number;
  exactScores: number;
  /** Pronostics 1N2 réussis, cumulés sur toutes les journées terminées — numérateur de la régularité. */
  regularitySuccess: number;
  /** Pronostics 1N2 joués, cumulés sur toutes les journées terminées — dénominateur de la régularité. */
  regularityPlayed: number;
  careerLevel: number;
  careerTitle: string;
};

/** Badge additionnel (hors ❤️ équipe favorite, dérivée automatiquement de `favoriteTeam`). */
export type ExtraBadge = { kind: Exclude<BadgeKind, "favorite">; label?: string };

export interface PlayerCardProps {
  player: PlayerCardData;
  isMe?: boolean;
  /** Badges additionnels à afficher (❤️ équipe favorite est géré automatiquement à partir de `player.favoriteTeam`, inutile de le repasser ici). */
  badges?: ExtraBadge[];
  /** Thème de l'équipe favorite du VIEWER (utilisateur connecté), pour l'accent "Toi" — jamais celui du joueur affiché. */
  viewerTheme?: TeamTheme;
}

// Hiérarchie visuelle demandée : Nom → Points → Exacts → Régularité (les
// points restent l'élément le plus visible de la ligne, la régularité la
// plus discrète). Grand numéro de rang "fantôme" en filigrane plutôt qu'un
// pavé plat ; "Vous" en halo discret (léger glow + petite étiquette),
// jamais en bordure verte flashy.
function PlayerCardImpl({ player, isMe = false, badges = [], viewerTheme }: PlayerCardProps) {
  const club = player.favoriteTeam;
  const regularityPct = player.regularityPlayed > 0 ? Math.round((player.regularitySuccess / player.regularityPlayed) * 100) : null;

  return (
    <div
      className={`group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border p-3 shadow-[0_6px_20px_-8px_rgba(0,0,0,.6)] transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/[0.14] sm:gap-4 sm:p-4 ${
        isMe
          ? "border-emerald-400/25 bg-gradient-to-b from-[#0e1c1a]/80 to-[#080f16]/85"
          : "border-white/[0.06] bg-gradient-to-b from-[#0d1424]/75 to-[#080d18]/80"
      }`}
      style={isMe && viewerTheme ? { boxShadow: `inset 3px 0 0 0 ${withAlpha(viewerTheme.primary, 0.55)}` } : undefined}
    >
      {/* Halo très discret pour le joueur connecté — jamais de bordure vive */}
      {isMe && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(16,185,129,.10),transparent_60%)]" />
      )}

      {/* Rang en filigrane — grand numéro fantôme derrière l'avatar */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 select-none font-display text-4xl font-black italic leading-none text-white/[0.05] sm:text-5xl"
      >
        {player.rank}
      </span>

      <span className="relative z-10 inline-flex size-6 shrink-0 items-center justify-center font-display text-[11px] font-bold text-slate-400 sm:size-7 sm:text-sm">
        {player.rank}
      </span>

      <div className="relative z-10 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-800 font-display text-xs font-extrabold text-white sm:size-11 sm:text-sm">
        {player.avatarUrl ? <img src={player.avatarUrl} alt="" className="size-full object-cover" /> : getInitials(player.pseudo)}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
  {/* Logo du club uniquement — jamais le nom/la ville (voir TeamCrest) : */}
  {club && <TeamCrest team={club} size="size-4 sm:size-5" />}
  <span className="truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</span>
  <span
    title={`Niveau ${player.careerLevel} · ${player.careerTitle}`}
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-wider text-amber-300 sm:px-2 sm:text-[8px]"
  >
    <span className="text-amber-200">{player.careerLevel}</span>
    <span className="hidden text-amber-300/75 sm:inline">{player.careerTitle}</span>
    <span className="text-amber-300/60 sm:hidden">Niv.</span>
  </span>
</div>
          {/* Étiquette discrète (pas de pastille vert vif) : joueur connecté
              repérable dès mobile sans agresser visuellement le reste de la carte. */}
          {isMe && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-emerald-300 sm:px-2 sm:text-[8px]">
              <span className="size-1 rounded-full bg-emerald-400" />
              Vous
            </span>
          )}
        </div>
      </div>

      {/* Bloc stats : Points (hero) → Exacts → Régularité, largeurs fixes pour
          un alignement parfait entre toutes les lignes. */}
      <div className="relative z-10 flex shrink-0 items-baseline gap-2.5 sm:gap-4">
        {/* Points — LA donnée principale : grand chiffre lumineux, sans pavé
            ni bordure, comme sur le podium. */}
        <div className="w-10 text-center sm:w-14">
          <span
            className="block font-display text-2xl font-black leading-none text-white sm:text-4xl"
            style={{ filter: "drop-shadow(0 0 14px rgba(110,231,183,.4))" }}
          >
            {player.points}
          </span>
          <span className="mt-0.5 block font-mono text-[6.5px] font-bold uppercase tracking-widest text-emerald-400/70 sm:mt-1 sm:text-[9px]">PTS</span>
        </div>

        {/* Scores exacts — secondaire */}
        <div className="w-7 text-center sm:w-11">
          <span className="block font-display text-xs font-bold leading-none text-slate-300 sm:text-base">{player.exactScores}</span>
          <span className="mt-0.5 block font-mono text-[6.5px] uppercase tracking-widest text-slate-500 sm:mt-1 sm:text-[8px]">Exact</span>
        </div>

        {/* Régularité — la plus discrète des trois, accent turquoise */}
        <div className="w-10 text-center sm:w-16">
          <span className="block font-display text-[11px] font-bold leading-none text-teal-300/90 sm:text-xs">
            {player.regularitySuccess}/{player.regularityPlayed}
          </span>
          <span className="mt-0.5 block font-mono text-[6px] uppercase tracking-widest text-teal-600/70 sm:mt-1 sm:text-[8px]">
            {regularityPct !== null ? `Rég. ${regularityPct}%` : "Rég."}
          </span>
        </div>
      </div>

      {/* Colonne droite : évolution + badges additionnels — repliée sur mobile pour rester compact */}
      <div className="relative z-10 hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <EvolutionIndicator rank={player.rank} previousRank={player.previousRank} />
        {badges.map((b) => (
          <Badge key={b.kind} kind={b.kind} size="sm" label={b.label} />
        ))}
      </div>
    </div>
  );
}

export const PlayerCard = memo(PlayerCardImpl);




