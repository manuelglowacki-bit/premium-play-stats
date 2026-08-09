import type { Match } from "./adminService";

/**
 * Moteur de sélection automatique des Matchs bonus.
 *
 * Pondération volontairement centralisée pour pouvoir être ajustée facilement.
 * Total = 100.
 */
export const BONUS_SELECTION_WEIGHTS = {
  prestige: 40,
  balance: 30,
  rivalry: 20,
  schedule: 10,
} as const;

export type BonusCompetitionCode = "PL" | "PD" | "SA" | "BL1";

export type BonusSelectionScore = {
  total: number;
  prestige: number;
  balance: number;
  rivalry: number;
  schedule: number;
};

export type BonusCandidate = {
  match: Match;
  competitionCode: BonusCompetitionCode;
  score: BonusSelectionScore;
  reasons: string[];
};

type ClubProfile = {
  prestige: number;
  level: number;
};

const CLUBS: Record<string, ClubProfile> = {
  // Premier League
  arsenal: { prestige: 94, level: 92 },
  chelsea: { prestige: 94, level: 89 },
  liverpool: { prestige: 98, level: 95 },
  "manchester city": { prestige: 99, level: 96 },
  "manchester united": { prestige: 97, level: 87 },
  tottenham: { prestige: 92, level: 84 },
  "newcastle united": { prestige: 86, level: 82 },
  "aston villa": { prestige: 83, level: 80 },
  "west ham": { prestige: 78, level: 75 },
  everton: { prestige: 79, level: 73 },
  "crystal palace": { prestige: 74, level: 72 },
  brighton: { prestige: 76, level: 76 },
  fulham: { prestige: 70, level: 71 },
  bournemouth: { prestige: 68, level: 70 },
  brentford: { prestige: 68, level: 72 },
  "nottingham forest": { prestige: 72, level: 73 },
  leeds: { prestige: 72, level: 70 },
  sunderland: { prestige: 67, level: 65 },
  "west bromwich": { prestige: 68, level: 67 },
  burnley: { prestige: 65, level: 64 },

  // Liga
  "real madrid": { prestige: 100, level: 98 },
  barcelona: { prestige: 99, level: 96 },
  "atletico madrid": { prestige: 96, level: 91 },
  sevilla: { prestige: 85, level: 78 },
  "athletic bilbao": { prestige: 83, level: 82 },
  "real sociedad": { prestige: 81, level: 79 },
  villarreal: { prestige: 82, level: 80 },
  betis: { prestige: 79, level: 77 },
  valencia: { prestige: 87, level: 75 },
  getafe: { prestige: 69, level: 68 },
  "rayo vallecano": { prestige: 67, level: 70 },
  osasuna: { prestige: 69, level: 71 },
  celta: { prestige: 68, level: 71 },
  alaves: { prestige: 65, level: 67 },
  elche: { prestige: 63, level: 64 },
  levante: { prestige: 64, level: 65 },
  espanyol: { prestige: 73, level: 70 },
  girona: { prestige: 76, level: 78 },
  mallorca: { prestige: 67, level: 70 },

  // Serie A
  inter: { prestige: 97, level: 94 },
  milan: { prestige: 96, level: 88 },
  juventus: { prestige: 98, level: 89 },
  napoli: { prestige: 92, level: 91 },
  roma: { prestige: 91, level: 82 },
  lazio: { prestige: 86, level: 81 },
  atalanta: { prestige: 84, level: 88 },
  fiorentina: { prestige: 81, level: 79 },
  bologna: { prestige: 74, level: 79 },
  torino: { prestige: 76, level: 73 },
  genoa: { prestige: 73, level: 70 },
  sampdoria: { prestige: 75, level: 66 },
  udinese: { prestige: 69, level: 68 },
  cagliari: { prestige: 68, level: 66 },
  lecce: { prestige: 64, level: 65 },
  como: { prestige: 62, level: 67 },
  parma: { prestige: 72, level: 70 },
  monza: { prestige: 61, level: 63 },
  sassuolo: { prestige: 68, level: 69 },
  venezia: { prestige: 61, level: 61 },

  // Bundesliga
  bayern: { prestige: 100, level: 97 },
  "borussia dortmund": { prestige: 95, level: 88 },
  "bayer leverkusen": { prestige: 88, level: 90 },
  "rb leipzig": { prestige: 84, level: 84 },
  "eintracht frankfurt": { prestige: 79, level: 80 },
  stuttgart: { prestige: 76, level: 82 },
  freiburg: { prestige: 71, level: 74 },
  gladbach: { prestige: 78, level: 73 },
  "werder bremen": { prestige: 76, level: 72 },
  mainz: { prestige: 68, level: 73 },
  hoffenheim: { prestige: 70, level: 70 },
  augsburg: { prestige: 65, level: 67 },
  hamburg: { prestige: 78, level: 70 },
  "union berlin": { prestige: 67, level: 69 },
  koln: { prestige: 69, level: 67 },
  schalke: { prestige: 80, level: 65 },
  paderborn: { prestige: 60, level: 62 },
  elversberg: { prestige: 55, level: 60 },
};

const DERBIES: Array<[string, string]> = [
  // England
  ["arsenal", "tottenham"],
  ["liverpool", "everton"],
  ["manchester city", "manchester united"],
  ["arsenal", "chelsea"],
  ["chelsea", "tottenham"],
  ["manchester united", "liverpool"],
  ["newcastle united", "sunderland"],

  // Espagne
  ["real madrid", "barcelona"],
  ["real madrid", "atletico madrid"],
  ["barcelona", "espanyol"],
  ["sevilla", "betis"],
  ["athletic bilbao", "real sociedad"],

  // Italie
  ["inter", "milan"],
  ["juventus", "torino"],
  ["roma", "lazio"],
  ["napoli", "roma"],
  ["milan", "juventus"],
  ["inter", "juventus"],

  // Allemagne
  ["bayern", "borussia dortmund"],
  ["borussia dortmund", "schalke"],
  ["bayern", "1860 munich"],
  ["hamburg", "werder bremen"],
  ["gladbach", "koln"],
];

function normalizeTeamName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|club|football club|ss|ssc|as|ac|bc|vfb|rb|bayer 04)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getClubProfile(name: string): ClubProfile {
  const normalized = normalizeTeamName(name);

  if (CLUBS[normalized]) return CLUBS[normalized];

  const compact = normalized.replace(/ /g, "");
  const found = Object.entries(CLUBS).find(
    ([club]) => club.replace(/ /g, "") === compact,
  );

  if (found) return found[1];

  // Club inconnu : profil neutre, sans avantage artificiel.
  return { prestige: 50, level: 50 };
}

function pairKey(a: string, b: string): string {
  return [normalizeTeamName(a), normalizeTeamName(b)].sort().join("|");
}

const DERBY_KEYS = new Set(
  DERBIES.map(([home, away]) => pairKey(home, away)),
);

function scorePrestige(home: string, away: string): number {
  const h = getClubProfile(home).prestige;
  const a = getClubProfile(away).prestige;

  // Moyenne des deux clubs, ramenée sur 40.
  return Math.round(((h + a) / 2) * (BONUS_SELECTION_WEIGHTS.prestige / 100));
}

function scoreBalance(home: string, away: string): number {
  const h = getClubProfile(home).level;
  const a = getClubProfile(away).level;
  const gap = Math.abs(h - a);

  let raw = 100;

  if (gap <= 5) raw = 100;
  else if (gap <= 10) raw = 90;
  else if (gap <= 15) raw = 78;
  else if (gap <= 20) raw = 65;
  else if (gap <= 30) raw = 45;
  else raw = 25;

  return Math.round(raw * (BONUS_SELECTION_WEIGHTS.balance / 100));
}

function scoreRivalry(home: string, away: string): number {
  const raw = DERBY_KEYS.has(pairKey(home, away)) ? 100 : 0;
  return Math.round(raw * (BONUS_SELECTION_WEIGHTS.rivalry / 100));
}

function scoreSchedule(kickoff: string): number {
  const date = new Date(kickoff);

  if (Number.isNaN(date.getTime())) return 0;

  // getUTCDay/getUTCHours car les dates de football-data.org sont en UTC.
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  // Conversion approximative vers l'heure française.
  // Le but est de favoriser les créneaux "grande affiche",
  // pas de faire une localisation parfaite.
  const frenchHour = (hour + 2) % 24;

  if (day === 6 && frenchHour >= 18 && frenchHour <= 22) {
    return BONUS_SELECTION_WEIGHTS.schedule;
  }

  if (day === 0 && frenchHour >= 15 && frenchHour <= 21) {
    return Math.round(BONUS_SELECTION_WEIGHTS.schedule * 0.95);
  }

  if (day === 5 && frenchHour >= 19 && frenchHour <= 22) {
    return Math.round(BONUS_SELECTION_WEIGHTS.schedule * 0.85);
  }

  if (day === 6 || day === 0) {
    return Math.round(BONUS_SELECTION_WEIGHTS.schedule * 0.65);
  }

  return Math.round(BONUS_SELECTION_WEIGHTS.schedule * 0.25);
}

function competitionFromMatch(match: Match): BonusCompetitionCode | null {
  const type = String(match.match_type ?? "").toUpperCase();

  if (type === "PREMIER_LEAGUE") return "PL";
  if (type === "LIGA") return "PD";
  if (type === "SERIE_A") return "SA";
  if (type === "BUNDESLIGA") return "BL1";

  return null;
}


/**
 * Normalise le nom d'un championnat vers son code football-data.org.
 */
export function normalizeCompetitionName(value: unknown): BonusCompetitionCode | null {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (
    text === "pl" ||
    text.includes("premier league") ||
    text.includes("premierleague") ||
    text.includes("angleterre")
  ) {
    return "PL";
  }

  if (
    text === "pd" ||
    text === "laliga" ||
    text.includes("la liga") ||
    text.includes("liga")
  ) {
    return "PD";
  }

  if (
    text === "sa" ||
    text.includes("serie a") ||
    text.includes("seriea") ||
    text.includes("italie")
  ) {
    return "SA";
  }

  if (
    text === "bl1" ||
    text.includes("bundesliga") ||
    text.includes("allemagne")
  ) {
    return "BL1";
  }

  return null;
}
export function scoreBonusCandidate(
  match: Match,
): BonusCandidate | null {
  const competitionCode = competitionFromMatch(match);
  if (!competitionCode) return null;

  if (
    !match.id ||
    !match.home_team ||
    !match.away_team ||
    !match.kickoff
  ) {
    return null;
  }

  if (match.finished || String(match.status).toLowerCase() === "finished") {
    return null;
  }

  const prestige = scorePrestige(match.home_team, match.away_team);
  const balance = scoreBalance(match.home_team, match.away_team);
  const rivalry = scoreRivalry(match.home_team, match.away_team);
  const schedule = scoreSchedule(match.kickoff);

  const total = prestige + balance + rivalry + schedule;

  const reasons: string[] = [];

  if (prestige >= 34) reasons.push("Très gros prestige");
  else if (prestige >= 28) reasons.push("Affiche prestigieuse");

  if (balance >= 26) reasons.push("Match très équilibré");
  else if (balance >= 20) reasons.push("Match équilibré");

  if (rivalry > 0) reasons.push("Rivalité / derby");

  if (schedule >= 9) reasons.push("Créneau idéal");

  return {
    match,
    competitionCode,
    score: {
      total,
      prestige,
      balance,
      rivalry,
      schedule,
    },
    reasons,
  };
}

export function selectBestBonusMatch(
  matches: Match[],
  competitionCode: BonusCompetitionCode,
): BonusCandidate | null {
  return matches
    .map(scoreBonusCandidate)
    .filter(
      (candidate): candidate is BonusCandidate =>
        candidate !== null && candidate.competitionCode === competitionCode,
    )
    .sort((a, b) => {
      if (b.score.total !== a.score.total) {
        return b.score.total - a.score.total;
      }

      // Départage : prestige puis équilibre.
      if (b.score.prestige !== a.score.prestige) {
        return b.score.prestige - a.score.prestige;
      }

      return b.score.balance - a.score.balance;
    })[0] ?? null;
}

export function generateBonusSelection(
  matches: Match[],
): Record<BonusCompetitionCode, BonusCandidate | null> {
  return {
    PL: selectBestBonusMatch(matches, "PL"),
    PD: selectBestBonusMatch(matches, "PD"),
    SA: selectBestBonusMatch(matches, "SA"),
    BL1: selectBestBonusMatch(matches, "BL1"),
  };
}
