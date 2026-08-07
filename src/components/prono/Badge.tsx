import { memo } from "react";

/**
 * Un seul composant Badge réutilisable pour tous les indicateurs "joueur"
 * du site (❤️ équipe favorite, 👑 champion, 🎯 roi des scores exacts,
 * 🔥 série en cours) — voir PlayerCard.tsx.
 *
 * Deux rendus au choix :
 *  - sans `label` : pastille icône seule (compact, ex. sur le podium) ;
 *  - avec `label` : vraie pilule fond + bordure + texte à côté de l'icône
 *    (ex. "❤️ Lens", "👑 Champion", "🔥 x5" — utilisé sur les cartes du
 *    classement #4+).
 *
 * IMPORTANT : seuls `favorite` et `exactKing` sont branchés sur une donnée
 * réelle aujourd'hui (`profiles.favorite_team`, et le total de scores
 * exacts calculé côté page). `champion` et `streak` n'ont actuellement
 * aucune source en base (pas de vainqueur de saison précédente stocké, pas
 * de suivi de série de journées) — leur configuration reste définie ici
 * pour que l'emplacement soit prêt, mais aucun appelant ne doit les rendre
 * tant que cette donnée n'existe pas réellement. Ne pas ajouter de logique
 * de calcul pour les faire apparaître artificiellement.
 */
export type BadgeKind = "favorite" | "champion" | "exactKing" | "streak";

const BADGE_CONFIG: Record<BadgeKind, { emoji: string; defaultLabel: string; ring: string; bg: string; text: string }> = {
  favorite: { emoji: "❤️", defaultLabel: "Équipe de cœur", ring: "border-red-500/25", bg: "bg-red-500/10", text: "text-red-300" },
  champion: { emoji: "👑", defaultLabel: "Champion", ring: "border-amber-400/25", bg: "bg-amber-400/10", text: "text-amber-300" },
  exactKing: { emoji: "🎯", defaultLabel: "Roi exact", ring: "border-fuchsia-500/25", bg: "bg-fuchsia-500/10", text: "text-fuchsia-300" },
  streak: { emoji: "🔥", defaultLabel: "Série", ring: "border-orange-500/25", bg: "bg-orange-500/10", text: "text-orange-300" },
};

export interface BadgeProps {
  kind: BadgeKind;
  size?: "sm" | "md";
  /** Texte affiché à côté de l'icône (ex. nom du club, "Champion", "x5"). Omis = pastille icône seule. */
  label?: string;
}

function BadgeImpl({ kind, size = "md", label }: BadgeProps) {
  const cfg = BADGE_CONFIG[kind];
  const title = label ? `${cfg.defaultLabel} : ${label}` : cfg.defaultLabel;

  if (!label) {
    const dim = size === "sm" ? "size-5 text-[10px]" : "size-6 text-xs";
    return (
      <span title={title} aria-label={title} className={`grid ${dim} shrink-0 place-items-center rounded-full border ${cfg.ring} ${cfg.bg}`}>
        {cfg.emoji}
      </span>
    );
  }

  const padding = size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-xs";
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono font-semibold ${padding} ${cfg.ring} ${cfg.bg} ${cfg.text}`}
    >
      <span className="leading-none">{cfg.emoji}</span>
      <span className="truncate leading-none">{label}</span>
    </span>
  );
}

export const Badge = memo(BadgeImpl);
