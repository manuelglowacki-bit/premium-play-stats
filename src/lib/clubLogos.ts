/**
 * Logos de clubs étrangers, servis depuis /public/logos/{Premier league,
 * Liga, Serie A, Bundesliga}. Ces fichiers existent depuis le début, mais
 * seule la table Ligue 1 était consultée : un match bonus dont les équipes
 * n'ont pas de ligne dans la table Supabase `teams` (ou dont le `logo_url`
 * est vide) affichait donc deux pastilles grises.
 *
 * La résolution se fait par sous-chaîne sur le nom normalisé (minuscules,
 * sans accents ni séparateurs), ce qui absorbe les variantes renvoyées par
 * l'API : "Club Atlético de Madrid", "Atlético Madrid", "Atletico de Madrid".
 *
 * L'ORDRE COMPTE : la première entrée qui correspond gagne. "inter" est donc
 * placé avant "milan", sans quoi l'Inter hériterait du logo de l'AC Milan.
 */

const FOREIGN_CLUB_LOGOS: Array<{ match: string; logo: string }> = [
  // --- Serie A (avant tout, à cause des cas Inter/Milan) ---
  { match: "inter", logo: "/logos/Serie A/inter.png" },
  { match: "milan", logo: "/logos/Serie A/milan.png" },
  { match: "juventus", logo: "/logos/Serie A/juventus.png" },
  { match: "napoli", logo: "/logos/Serie A/napoli.png" },
  { match: "naples", logo: "/logos/Serie A/napoli.png" },
  { match: "atalanta", logo: "/logos/Serie A/atalanta.png" },
  { match: "bologna", logo: "/logos/Serie A/bologna.png" },
  { match: "cagliari", logo: "/logos/Serie A/cagliari.png" },
  { match: "fiorentina", logo: "/logos/Serie A/fiorentina.png" },
  { match: "genoa", logo: "/logos/Serie A/genoa.png" },
  { match: "lazio", logo: "/logos/Serie A/lazio.png" },
  { match: "lecce", logo: "/logos/Serie A/lecce.png" },
  { match: "monza", logo: "/logos/Serie A/monza.png" },
  { match: "parma", logo: "/logos/Serie A/parma.png" },
  { match: "sassuolo", logo: "/logos/Serie A/sassuolo.png" },
  { match: "torino", logo: "/logos/Serie A/torino.png" },
  { match: "udinese", logo: "/logos/Serie A/udinese.png" },
  { match: "venezia", logo: "/logos/Serie A/venezia.png" },
  { match: "frosinone", logo: "/logos/Serie A/frosinone.png" },
  { match: "como", logo: "/logos/Serie A/como.png" },
  { match: "roma", logo: "/logos/Serie A/roma.png" },

  // --- Liga ---
  { match: "realmadrid", logo: "/logos/Liga/realmadrid.png" },
  { match: "realsociedad", logo: "/logos/Liga/realsociedad.png" },
  { match: "barcelona", logo: "/logos/Liga/barcelona.png" },
  { match: "barcelone", logo: "/logos/Liga/barcelona.png" },
  { match: "atletico", logo: "/logos/Liga/atletico.png" },
  { match: "athletic", logo: "/logos/Liga/athletic.png" },
  { match: "villarreal", logo: "/logos/Liga/villarreal.png" },
  { match: "sevilla", logo: "/logos/Liga/sevilla.png" },
  { match: "seville", logo: "/logos/Liga/sevilla.png" },
  { match: "valencia", logo: "/logos/Liga/valencia.png" },
  { match: "betis", logo: "/logos/Liga/betis.png" },
  { match: "celta", logo: "/logos/Liga/celta.png" },
  { match: "espanyol", logo: "/logos/Liga/espanyol.png" },
  { match: "getafe", logo: "/logos/Liga/getafe.png" },
  { match: "osasuna", logo: "/logos/Liga/osasuna.png" },
  { match: "rayo", logo: "/logos/Liga/rayo.png" },
  { match: "alaves", logo: "/logos/Liga/alaves.png" },
  { match: "levante", logo: "/logos/Liga/levante.png" },
  { match: "elche", logo: "/logos/Liga/elche.png" },
  { match: "malaga", logo: "/logos/Liga/malaga.png" },
  { match: "coruna", logo: "/logos/Liga/coruna.png" },
  { match: "racing", logo: "/logos/Liga/racing.png" },

  // --- Premier League ---
  { match: "manchestercity", logo: "/logos/Premier league/mancity.png" },
  { match: "mancity", logo: "/logos/Premier league/mancity.png" },
  { match: "manchesterunited", logo: "/logos/Premier league/manunited.png" },
  { match: "manunited", logo: "/logos/Premier league/manunited.png" },
  { match: "liverpool", logo: "/logos/Premier league/liverpool.png" },
  { match: "arsenal", logo: "/logos/Premier league/arsenal.png" },
  { match: "chelsea", logo: "/logos/Premier league/chelsea.png" },
  { match: "tottenham", logo: "/logos/Premier league/tottenham.png" },
  { match: "newcastle", logo: "/logos/Premier league/newcastle.png" },
  { match: "astonvilla", logo: "/logos/Premier league/astonvilla.png" },
  { match: "everton", logo: "/logos/Premier league/everton.png" },
  { match: "fulham", logo: "/logos/Premier league/fulham.png" },
  { match: "brighton", logo: "/logos/Premier league/brighton.png" },
  { match: "brentford", logo: "/logos/Premier league/brentford.png" },
  { match: "bournemouth", logo: "/logos/Premier league/bournemouth.png" },
  { match: "crystalpalace", logo: "/logos/Premier league/crystalpalace.png" },
  { match: "forest", logo: "/logos/Premier league/forest.png" },
  { match: "leeds", logo: "/logos/Premier league/leeds.png" },
  { match: "ipswich", logo: "/logos/Premier league/ipswich.png" },
  { match: "sunderland", logo: "/logos/Premier league/sunderland.png" },
  { match: "coventry", logo: "/logos/Premier league/coventry.png" },
  { match: "hull", logo: "/logos/Premier league/hull.png" },

  // --- Bundesliga ---
  { match: "bayern", logo: "/logos/Bundesliga/bayern.png" },
  { match: "dortmund", logo: "/logos/Bundesliga/dortmund.png" },
  { match: "leverkusen", logo: "/logos/Bundesliga/leverkusen.png" },
  { match: "leipzig", logo: "/logos/Bundesliga/leipzig.png" },
  { match: "gladbach", logo: "/logos/Bundesliga/gladbach.png" },
  { match: "frankfurt", logo: "/logos/Bundesliga/frankfurt.png" },
  { match: "stuttgart", logo: "/logos/Bundesliga/stuttgart.png" },
  { match: "freiburg", logo: "/logos/Bundesliga/freiburg.png" },
  { match: "hoffenheim", logo: "/logos/Bundesliga/hoffenheim.png" },
  { match: "unionberlin", logo: "/logos/Bundesliga/unionberlin.png" },
  { match: "augsburg", logo: "/logos/Bundesliga/augsburg.png" },
  { match: "bremen", logo: "/logos/Bundesliga/bremen.png" },
  { match: "mainz", logo: "/logos/Bundesliga/mainz.png" },
  { match: "koln", logo: "/logos/Bundesliga/koln.png" },
  { match: "cologne", logo: "/logos/Bundesliga/koln.png" },
  { match: "schalke", logo: "/logos/Bundesliga/schalke.png" },
  { match: "hamburg", logo: "/logos/Bundesliga/hamburg.png" },
  { match: "paderborn", logo: "/logos/Bundesliga/paderborn.png" },
  { match: "elversberg", logo: "/logos/Bundesliga/elversberg.png" },
];

export function normalizeClubLogoKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Logo local d'un club étranger (championnats bonus), ou null. */
export function getForeignClubLogo(teamName: unknown): string | null {
  const key = normalizeClubLogoKey(teamName);
  if (!key) return null;
  const found = FOREIGN_CLUB_LOGOS.find((entry) => key.includes(entry.match));
  return found ? found.logo : null;
}
