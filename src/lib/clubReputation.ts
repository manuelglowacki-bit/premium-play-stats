import { getOfficialClubId } from "./team-identity";

/**
 * Cote de notoriété d'un club, de 0 à 100.
 *
 * Sert à désigner l'affiche d'une journée. L'application ne connaît PAS le
 * classement réel de la Ligue 1 (aucune table de standings côté Supabase) :
 * cette échelle est donc éditoriale — palmarès, audience, statut européen —
 * et non calculée. Elle se règle à la main d'une saison sur l'autre.
 *
 * Elle remplace un test `/psg|paris|marseille|om|lyon|ol|monaco|lille|lens/`
 * qui souffrait de deux défauts : "paris" faisait passer le PARIS FC pour le
 * PSG, et le score binaire 0/20 donnait autant de poids à un match comptant un
 * seul gros club qu'à une véritable affiche entre deux cadors.
 */

// Ligue 1 — clés = ids officiels resolus par getOfficialClubId().
const LIGUE1_REPUTATION: Record<string, number> = {
  psg: 100,
  om: 92,
  ol: 86,
  monaco: 80,
  lille: 74,
  lens: 70,
  rennes: 62,
  nice: 56,
  strasbourg: 46,
  brest: 42,
  tfc: 40,
  auxerre: 36,
  lorient: 33,
  angers: 31,
  parisfc: 30,
  lehavre: 29,
  troyes: 27,
  lemans: 25,
};

// Clubs étrangers susceptibles d'apparaître en match bonus (PL/PD/SA/BL1).
// Recherche par sous-chaîne sur le nom normalisé, du plus spécifique au plus
// générique pour éviter qu'"inter" ne capture "Internacional" avant "Inter".
const EUROPE_REPUTATION: Array<{ match: string; score: number }> = [
  { match: "real madrid", score: 100 },
  { match: "barcelona", score: 99 },
  { match: "barcelone", score: 99 },
  { match: "manchester city", score: 97 },
  { match: "bayern", score: 96 },
  { match: "liverpool", score: 95 },
  { match: "manchester united", score: 93 },
  { match: "arsenal", score: 92 },
  { match: "chelsea", score: 90 },
  { match: "juventus", score: 89 },
  { match: "milan", score: 88 },
  { match: "atletico", score: 88 },
  { match: "atlético", score: 88 },
  { match: "dortmund", score: 85 },
  { match: "tottenham", score: 82 },
  { match: "napoli", score: 82 },
  { match: "naples", score: 82 },
  { match: "roma", score: 78 },
  { match: "leverkusen", score: 76 },
  { match: "sevilla", score: 74 },
  { match: "séville", score: 74 },
  { match: "valencia", score: 70 },
  { match: "leipzig", score: 70 },
  { match: "newcastle", score: 70 },
  { match: "lazio", score: 68 },
  { match: "villarreal", score: 66 },
  { match: "betis", score: 64 },
  { match: "athletic", score: 64 },
  { match: "fiorentina", score: 62 },
  { match: "aston villa", score: 62 },
  { match: "west ham", score: 58 },
  { match: "everton", score: 56 },
  { match: "inter", score: 88 },
];

// Un club inconnu ne doit ni gagner par défaut, ni être écrasé : on le place
// au niveau d'un club de milieu de tableau.
const DEFAUT = 30;

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function clubReputation(teamName: unknown): number {
  const officialId = getOfficialClubId(String(teamName ?? ""));
  if (officialId && LIGUE1_REPUTATION[officialId] != null) {
    return LIGUE1_REPUTATION[officialId];
  }

  const name = normalize(teamName);
  if (!name) return DEFAUT;

  const found = EUROPE_REPUTATION.find((entry) => name.includes(entry.match));
  return found ? found.score : DEFAUT;
}

/**
 * Poids d'une affiche. Le côté le plus faible compte double : un PSG–OM
 * (100 + 92, faible côté 92) doit passer devant un PSG–Le Mans
 * (100 + 25, faible côté 25), sans quoi il suffirait d'un seul gros nom.
 */
export function matchAppeal(homeTeam: unknown, awayTeam: unknown): number {
  const home = clubReputation(homeTeam);
  const away = clubReputation(awayTeam);
  return home + away + Math.min(home, away);
}
