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

/** Blason du club favori — toujours `logo_url` (table `teams`), jamais un logo statique/générique. Repli sur les initiales du nom si l'image est absente ou en échec. Réutilisé par PodiumBoard.tsx. */
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
// page pilotée par l'image /podium-bg.png — voir PodiumBoard.tsx, qui
// réutilise cependant TeamCrest/getInitials/Badge définis ici pour rester
// cohérent avec le reste du site.
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
};

/** Badge additionnel (hors ❤️ équipe favorite, dérivée automatiquement de `favoriteTeam`). Partagé avec PodiumBoard.tsx. */
export type ExtraBadge = { kind: Exclude<BadgeKind, "favorite">; label?: string };

export interface PlayerCardProps {
  player: PlayerCardData;
  isMe?: boolean;
  /** Badges additionnels à afficher (❤️ équipe favorite est géré automatiquement à partir de `player.favoriteTeam`, inutile de le repasser ici). */
  badges?: ExtraBadge[];
  /** Thème de l'équipe favorite du VIEWER (utilisateur connecté), pour l'accent "Toi" — jamais celui du joueur affiché. */
  viewerTheme?: TeamTheme;
}

// Hiérarchie visuelle : Points → Pseudo → infos secondaires. Colonne de
// droite (évolution + badges additionnels) alignée verticalement.
function PlayerCardImpl({ player, isMe = false, badges = [], viewerTheme }: PlayerCardProps) {
  const club = player.favoriteTeam;

  return (
    <div
      className="relative flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#101728]/70 to-[#0a0f1c]/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      style={isMe && viewerTheme ? { borderLeftColor: viewerTheme.primary, borderLeftWidth: 3 } : undefined}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 font-display text-sm font-bold text-slate-300">
        {player.rank}
      </span>

      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 font-display text-sm font-extrabold text-white">
        {player.avatarUrl ? <img src={player.avatarUrl} alt="" className="size-full object-cover" /> : getInitials(player.pseudo)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display font-bold text-white">{player.pseudo || "Joueur"}</span>
          {isMe && <span className="font-mono text-[9px] font-semibold uppercase text-slate-400">Toi</span>}
        </div>
        {club && (
          <div className="mt-1">
            <Badge kind="favorite" size="sm" label={club.shortName ?? club.name} />
          </div>
        )}
      </div>

      {/* Points très visibles : gros chiffre + label en dessous */}
      <div className="shrink-0 text-center">
        <span className="block font-display text-3xl font-black leading-none text-emerald-400">{player.points}</span>
        <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500">Pts</span>
      </div>

      <div className="hidden shrink-0 text-center sm:block">
        <span className="block font-display text-lg font-bold leading-none text-slate-300">{player.exactScores}</span>
        <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-slate-600">Exact</span>
      </div>

      {/* Colonne droite : évolution + badges additionnels, alignés verticalement */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <EvolutionIndicator rank={player.rank} previousRank={player.previousRank} />
        {badges.map((b) => (
          <Badge key={b.kind} kind={b.kind} size="sm" label={b.label} />
        ))}
      </div>
    </div>
  );
}

export const PlayerCard = memo(PlayerCardImpl);
