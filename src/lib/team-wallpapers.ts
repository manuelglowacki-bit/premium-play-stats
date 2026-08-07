/**
 * Fait correspondre le nom d'une équipe (tel que stocké dans la table
 * Supabase `teams`) au fichier de fond d'écran dédié dans
 * public/team-wallpapers/.
 *
 * On matche sur le NOM plutôt que sur `short_name` : les fonds d'écran ont
 * été fournis avec des noms de fichiers lisibles (lens.jpg, paris_fc.jpg...)
 * et cette approche reste robuste même si les codes exacts en base
 * (short_name) ne correspondent pas exactement à ces fichiers.
 *
 * Si aucune correspondance n'est trouvée, l'appelant doit retomber sur le
 * fond stade générique (/stadium-bg.jpg).
 *
 * Utilisé par /profil pour la prévisualisation du club sélectionné.
 * NOTE : /accueil et /pronostics utilisent désormais src/lib/team-theme.ts
 * (design system par équipe, sur public/team-backgrounds/) via le hook
 * src/hooks/useTeamTheme.ts — ce fichier-ci ne gère que le fond utilisé par
 * la page profil, qui n'a pas encore été migrée sur ce nouveau système.
 */

const TEAM_NAME_TO_SLUG: Array<{ match: string; slug: string }> = [
  { match: "paris saint-germain", slug: "psg" },
  { match: "paris-saint-germain", slug: "psg" },
  { match: "psg", slug: "psg" },
  { match: "marseille", slug: "marseille" },
  { match: "lyon", slug: "lyon" },
  { match: "lens", slug: "lens" },
  { match: "lille", slug: "lille" },
  { match: "monaco", slug: "monaco" },
  { match: "rennes", slug: "rennes" },
  { match: "rennais", slug: "rennes" }, // "Stade Rennais FC" en base ne contient pas "rennes"
  { match: "nice", slug: "nice" },
  { match: "brest", slug: "brest" },
  { match: "toulouse", slug: "toulouse" },
  { match: "strasbourg", slug: "strasbourg" },
  { match: "troyes", slug: "troyes" },
  { match: "lorient", slug: "lorient" },
  { match: "angers", slug: "angers" },
  { match: "auxerre", slug: "auxerre" },
  { match: "le havre", slug: "le_havre" },
  { match: "havre", slug: "le_havre" },
  { match: "le mans", slug: "le_mans" },
  { match: "mans", slug: "le_mans" },
  { match: "paris fc", slug: "paris_fc" },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // retire les accents
}

export function getTeamWallpaperSlug(teamName: string | undefined | null): string | null {
  if (!teamName) return null;
  const normalized = normalize(teamName);
  const found = TEAM_NAME_TO_SLUG.find(({ match }) => normalized.includes(match));
  return found ? found.slug : null;
}

export function getTeamWallpaperUrl(teamName: string | undefined | null): string {
  const slug = getTeamWallpaperSlug(teamName);
  return slug ? `/team-wallpapers/${slug}.jpg` : "/stadium-bg.jpg";
}
