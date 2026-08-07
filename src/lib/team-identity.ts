/**
 * Résout le nom d'une équipe (tel que renvoyé par la table Supabase `teams`,
 * ex. "Olympique de Marseille", "Stade Rennais FC"...) vers l'id "officiel"
 * court utilisé côté app (OFFICIAL_L1_CLUBS dans src/routes/pronostics.tsx,
 * et les clés de src/lib/team-theme.ts : "om", "rennes", "psg"...).
 *
 * On matche sur un nom normalisé (minuscule, sans accents) plutôt que sur un
 * id/short_name strict : ça reste robuste quel que soit le nom exact renvoyé
 * par Supabase, sans dépendre d'un format figé en base.
 */

const TEAM_NAME_TO_ID: Array<{ match: string; id: string }> = [
  { match: "paris saint-germain", id: "psg" },
  { match: "paris-saint-germain", id: "psg" },
  { match: "psg", id: "psg" },
  { match: "marseille", id: "om" },
  { match: "lyon", id: "ol" },
  { match: "lens", id: "lens" },
  { match: "lille", id: "lille" },
  { match: "monaco", id: "monaco" },
  { match: "rennes", id: "rennes" },
  { match: "rennais", id: "rennes" }, // "Stade Rennais FC" ne contient pas "rennes" en base
  { match: "nice", id: "nice" },
  { match: "brest", id: "brest" },
  { match: "toulouse", id: "tfc" },
  { match: "strasbourg", id: "strasbourg" },
  { match: "troyes", id: "troyes" },
  { match: "lorient", id: "lorient" },
  { match: "angers", id: "angers" },
  { match: "auxerre", id: "auxerre" },
  { match: "le havre", id: "lehavre" },
  { match: "havre", id: "lehavre" },
  { match: "le mans", id: "lemans" },
  { match: "mans", id: "lemans" },
  { match: "paris fc", id: "parisfc" },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // retire les accents
}

/** Id court "officiel" correspondant à un nom d'équipe Supabase, ou `null` si aucune correspondance. */
export function getOfficialClubId(teamName: string | undefined | null): string | null {
  if (!teamName) return null;
  const normalized = normalize(teamName);
  const found = TEAM_NAME_TO_ID.find(({ match }) => normalized.includes(match));
  return found ? found.id : null;
}
