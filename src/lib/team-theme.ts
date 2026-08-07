/**
 * Design system par équipe favorite — SEULE source de vérité pour le thème
 * visuel dérivé du club d'un utilisateur (background, couleurs, halos/glow,
 * boutons, dégradés).
 *
 * Toute page qui veut "s'habiller" aux couleurs de l'équipe favorite doit
 * passer par ici (typiquement via le hook `useTeamTheme`, voir
 * src/hooks/useTeamTheme.ts) — pas de couleurs de club codées en dur ailleurs.
 *
 * Structure :
 *  - RAW_PALETTES : la donnée brute par club (couleurs officielles + fichier
 *    de fond dans public/team-backgrounds/). C'est la seule partie à éditer
 *    pour ajouter/corriger un club.
 *  - buildTheme() dérive ensuite `glow`, `gradient` et `button` de façon
 *    homogène à partir de `primary`/`secondary`, pour que tous les clubs
 *    suivent la même formule visuelle (pas de réglages au cas par cas).
 *
 * Résolution nom Supabase → id de club : voir src/lib/team-identity.ts
 * (`getOfficialClubId`), utilisé par le hook pour choisir l'entrée ici.
 */

export type TeamButtonTheme = {
  background: string;
  hoverBackground: string;
  text: string;
  shadow: string;
};

export type TeamTheme = {
  id: string;
  /** Chemin de l'image de fond "équipe de cœur" (public/team-backgrounds/). */
  background: string;
  primary: string;
  secondary: string;
  /** rgba() prêt à l'emploi pour des halos/blur (box-shadow, background-color d'un div flouté...). */
  glow: string;
  /** Dégradé linéaire primary → secondary, prêt à l'emploi en `background`. */
  gradient: string;
  button: TeamButtonTheme;
};

/** Fond générique utilisé quand aucun club n'est sélectionné, ou en repli si l'image dédiée est introuvable (404). */
export const FALLBACK_BACKGROUND = "/stadium-bg.jpg";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Convertit une couleur hex du thème en rgba() — pour les halos/accents ponctuels que les pages composent elles-mêmes. */
export const withAlpha = hexToRgba;

/** Éclaircit une couleur vers le blanc de `amount` (0→1) — état hover des boutons thémés. */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Texte noir ou blanc selon la luminance perçue de `hex` — lisible quelle que soit la couleur du club. */
function getReadableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0B1120" : "#FFFFFF";
}

function buildTheme(id: string, primary: string, secondary: string, background: string): TeamTheme {
  return {
    id,
    background,
    primary,
    secondary,
    glow: hexToRgba(primary, 0.35),
    gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    button: {
      background: primary,
      hoverBackground: lighten(primary, 0.12),
      text: getReadableTextColor(primary),
      shadow: `0 0 25px ${hexToRgba(primary, 0.45)}`,
    },
  };
}

// Couleurs officielles (approximation fidèle des chartes de chaque club) +
// fichier de fond "équipe de cœur" correspondant dans public/team-backgrounds/.
// L'id est celui utilisé par OFFICIAL_L1_CLUBS (src/routes/pronostics.tsx)
// et résolu depuis Supabase via getOfficialClubId (src/lib/team-identity.ts).
const RAW_PALETTES: Record<string, { primary: string; secondary: string; backgroundFile: string }> = {
  psg: { primary: "#04234C", secondary: "#DA291C", backgroundFile: "Paris sg coeur" },
  om: { primary: "#2FAEE0", secondary: "#FFFFFF", backgroundFile: "marseille coeur" },
  ol: { primary: "#0F1B45", secondary: "#E2231A", backgroundFile: "lyon coeur" },
  lens: { primary: "#FFD400", secondary: "#DC0714", backgroundFile: "lens coeur" },
  lille: { primary: "#C10018", secondary: "#003087", backgroundFile: "lille coeur" },
  monaco: { primary: "#E2001A", secondary: "#FFFFFF", backgroundFile: "monaco coeur" },
  rennes: { primary: "#E2001A", secondary: "#000000", backgroundFile: "rennes coeur" },
  nice: { primary: "#D0021B", secondary: "#000000", backgroundFile: "nice coeur" },
  brest: { primary: "#E2001A", secondary: "#FFFFFF", backgroundFile: "brest coeur" },
  toulouse: { primary: "#642F6C", secondary: "#EB6608", backgroundFile: "toulouse coeur" }, // tfc
  strasbourg: { primary: "#0033A0", secondary: "#FFFFFF", backgroundFile: "strasbourg coeur" },
  lorient: { primary: "#FF6600", secondary: "#000000", backgroundFile: "lorient coeur" },
  angers: { primary: "#0A0A0A", secondary: "#FFFFFF", backgroundFile: "angers coeur" },
  auxerre: { primary: "#0C3B7A", secondary: "#FFFFFF", backgroundFile: "auxerre coeur" },
  lehavre: { primary: "#00A9E0", secondary: "#002B5C", backgroundFile: "le havre coeur" },
  lemans: { primary: "#0B3D91", secondary: "#FFFFFF", backgroundFile: "le mans coeur" },
  parisfc: { primary: "#004A9C", secondary: "#E4032E", backgroundFile: "paris fc coeur" },
  troyes: { primary: "#0055A4", secondary: "#FFFFFF", backgroundFile: "troyes coeur" },
};
// "tfc" est l'id officiel utilisé par OFFICIAL_L1_CLUBS ; on l'aligne ici sur
// l'entrée "toulouse" ci-dessus pour n'avoir qu'une seule palette à maintenir.
RAW_PALETTES.tfc = RAW_PALETTES.toulouse;

export const TEAM_THEMES: Record<string, TeamTheme> = Object.fromEntries(
  Object.entries(RAW_PALETTES).map(([id, { primary, secondary, backgroundFile }]) => [
    id,
    buildTheme(id, primary, secondary, `/team-backgrounds/${backgroundFile}.png`),
  ]),
);

/** Thème neutre (vert/bleu de la charte du site) utilisé tant qu'aucun club favori n'est résolu. */
export const DEFAULT_TEAM_THEME: TeamTheme = buildTheme("default", "#10B981", "#38BDF8", FALLBACK_BACKGROUND);

/** Thème du club `clubId`, ou le thème neutre si l'id est vide/inconnu. */
export function getTeamTheme(clubId: string | null | undefined): TeamTheme {
  if (!clubId) return DEFAULT_TEAM_THEME;
  return TEAM_THEMES[clubId] ?? DEFAULT_TEAM_THEME;
}
