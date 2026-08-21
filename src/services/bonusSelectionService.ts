import type { Match } from "./adminService";
import type { CompetitionStandings, StandingsTeamEntry } from "./standingsService";

/**
 * Moteur de sélection automatique des Matchs bonus.
 *
 * Barème DYNAMIQUE : l'équilibre d'un match candidat est jugé en priorité
 * sur le CLASSEMENT ACTUEL du championnat (position, points, différence de
 * buts, forme récente — voir standingsService.ts), pas sur une réputation
 * de club figée. Un 3e vs 4e doit noter beaucoup plus haut qu'un 1er vs
 * 18e, même si le 1er est un club prestigieux — et ce classement d'où sort
 * la note évolue à chaque nouvelle génération, journée après journée.
 * Le prestige du club (`CLUBS` ci-dessous) ne reste qu'un critère
 * secondaire (10/100), et sert aussi de repli quand le classement en
 * direct n'est pas disponible (tout début de saison, API indisponible).
 *
 * Pondération volontairement centralisée pour pouvoir être ajustée facilement.
 * Total = 100.
 */
export const BONUS_SELECTION_WEIGHTS = {
  standingsBalance: 45,
  levelGap: 20,
  form: 15,
  prestige: 10,
  rivalry: 5,
  schedule: 5,
} as const;

export type BonusCompetitionCode = "PL" | "PD" | "SA" | "BL1";

export type BonusSelectionScore = {
  total: number;
  /** ÉQUILIBRE — écart de POSITION au classement actuel. Critère dominant. */
  standingsBalance: number;
  /** ÉCART AU CLASSEMENT — écart de points / différence de buts. */
  levelGap: number;
  /** FORME — forme récente des deux équipes (résultats des derniers matchs). */
  form: number;
  /** PRESTIGE — qualité/réputation du club, critère secondaire uniquement. */
  prestige: number;
  /** AFFICHE — rivalité / derby connu. */
  rivalry: number;
  /** HORAIRE — créneau de diffusion. */
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

// Exportée pour être réutilisée par bonusClubLogoService.ts — même
// normalisation que le scoring, pour que "match du même club" veuille dire
// la même chose des deux côtés. Comportement inchangé.
export function normalizeTeamName(value: unknown): string {
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

  // Moyenne des deux clubs, ramenée sur le poids "prestige" (secondaire).
  return Math.round(((h + a) / 2) * (BONUS_SELECTION_WEIGHTS.prestige / 100));
}

/** Ratio d'équilibre (0..1) basé sur le niveau statique connu des clubs —
 * utilisé UNIQUEMENT en repli quand le classement en direct n'est pas
 * disponible pour l'une des deux équipes (voir scoreStandingsBalance /
 * scoreLevelGap ci-dessous). Jamais le critère principal. */
function levelBalanceRatio(home: string, away: string): number {
  const h = getClubProfile(home).level;
  const a = getClubProfile(away).level;
  const gap = Math.abs(h - a);

  if (gap <= 5) return 1;
  if (gap <= 10) return 0.9;
  if (gap <= 15) return 0.78;
  if (gap <= 20) return 0.65;
  if (gap <= 30) return 0.45;
  return 0.25;
}

function lookupStandingsEntry(standings: CompetitionStandings | undefined, teamName: string): StandingsTeamEntry | null {
  if (!standings) return null;
  return standings.entriesByTeam.get(normalizeTeamName(teamName)) ?? null;
}

/** ÉQUILIBRE (critère dominant, 45/100 par défaut) — écart de POSITION au
 * classement actuel entre les deux équipes. Un match entre équipes
 * voisines au classement (3e vs 4e) note très haut ; un match entre le
 * 1er et l'avant-dernier note très bas, même si le 1er est un club
 * prestigieux. Repli sur le niveau statique connu si le classement en
 * direct n'est pas disponible pour l'une des deux équipes. */
function scoreStandingsBalance(
  entryA: StandingsTeamEntry | null,
  entryB: StandingsTeamEntry | null,
  totalTeams: number,
  homeTeamName: string,
  awayTeamName: string,
): number {
  const weight = BONUS_SELECTION_WEIGHTS.standingsBalance;

  if (entryA && entryB && totalTeams >= 2) {
    const maxGap = Math.max(1, totalTeams - 1);
    const gap = Math.abs(entryA.position - entryB.position);
    const ratio = 1 - Math.min(1, gap / maxGap);
    return Math.round(weight * ratio);
  }

  return Math.round(weight * levelBalanceRatio(homeTeamName, awayTeamName));
}

/** ÉCART AU CLASSEMENT (20/100 par défaut) — écart de points (70%) et de
 * différence de buts (30%) entre les deux équipes, normalisé au nombre de
 * journées jouées : deux équipes à 2 points d'écart après 3 journées ne
 * sont pas aussi proches que deux équipes à 2 points d'écart après 30. */
function scoreLevelGap(
  entryA: StandingsTeamEntry | null,
  entryB: StandingsTeamEntry | null,
  homeTeamName: string,
  awayTeamName: string,
): number {
  const weight = BONUS_SELECTION_WEIGHTS.levelGap;

  if (!entryA || !entryB) {
    return Math.round(weight * levelBalanceRatio(homeTeamName, awayTeamName));
  }

  const playedRef = Math.max(1, Math.min(entryA.playedGames, entryB.playedGames));

  const maxPointsGap = Math.max(3, playedRef * 3);
  const pointsGap = Math.abs(entryA.points - entryB.points);
  const pointsRatio = 1 - Math.min(1, pointsGap / maxPointsGap);

  const maxGoalDiffGap = Math.max(3, playedRef * 2);
  const goalDiffGap = Math.abs(entryA.goalDifference - entryB.goalDifference);
  const goalDiffRatio = 1 - Math.min(1, goalDiffGap / maxGoalDiffGap);

  const ratio = pointsRatio * 0.7 + goalDiffRatio * 0.3;
  return Math.round(weight * ratio);
}

/** Convertit une chaîne de forme football-data.org ("W,D,L,W,W") en score
 * de forme normalisé 0..1 (3 pts/victoire, 1 pt/nul, sur le nombre de
 * matchs disponibles). Absente/vide → 0.5 (neutre, ni avantage ni pénalité). */
function formStrength(form: string | null): number {
  if (!form) return 0.5;
  const results = form.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);
  if (results.length === 0) return 0.5;
  const points = results.reduce((sum, r) => sum + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  return points / (results.length * 3);
}

/** FORME (15/100 par défaut) — favorise les affiches où les deux équipes
 * sont dans une forme récente proche (match imprévisible) ET/OU toutes les
 * deux en forme (affiche excitante). Neutre (moitié du poids) si la forme
 * n'est pas connue pour l'une des deux équipes. */
function scoreForm(entryA: StandingsTeamEntry | null, entryB: StandingsTeamEntry | null): number {
  const weight = BONUS_SELECTION_WEIGHTS.form;
  if (!entryA || !entryB) return Math.round(weight * 0.5);

  const strengthA = formStrength(entryA.form);
  const strengthB = formStrength(entryB.form);
  const gapRatio = 1 - Math.abs(strengthA - strengthB);
  const avgStrength = (strengthA + strengthB) / 2;

  const ratio = gapRatio * 0.5 + avgStrength * 0.5;
  return Math.round(weight * ratio);
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

// ============================================================
// Fenêtre temporelle d'éligibilité (heure locale Europe/Paris → UTC)
// ============================================================
// football-data.org renvoie `kickoff` en UTC (ex: "2026-08-21T15:30:00.000Z").
// L'admin saisit une fenêtre en heure locale Europe/Paris (ex: via un input
// datetime-local "2026-08-21T13:00"). La comparaison doit se faire sur de
// vrais timestamps, jamais sur des chaînes de date brutes — et la conversion
// locale → UTC ne doit pas dépendre du fuseau horaire de la machine qui
// exécute le code (sinon un admin connecté depuis un autre fuseau que Paris
// enregistre une fenêtre décalée).

const PARIS_TIME_ZONE = "Europe/Paris";

/** Offset réel (en minutes, positif = en avance sur UTC) d'Europe/Paris à un
 * instant UTC donné. Calculé via Intl (gère automatiquement CEST/CET), donc
 * indépendant du fuseau horaire de la machine exécutant le code. */
function getParisOffsetMinutes(utcDate: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hour = Number(get("hour"));

  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    hour === 24 ? 0 : hour,
    Number(get("minute")),
    Number(get("second")),
  );

  return Math.round((asUtc - utcDate.getTime()) / 60_000);
}

/**
 * Convertit une date/heure locale Europe/Paris (format "YYYY-MM-DDTHH:mm",
 * tel que produit par un input `datetime-local`) en ISO UTC. Retourne null
 * si le format est invalide.
 *
 * Exemple : parisLocalToUtcIso("2026-08-21T13:00")
 *        -> "2026-08-21T11:00:00.000Z" (Paris est UTC+2 en août, heure d'été)
 */
export function parisLocalToUtcIso(localDateTime: string | null | undefined): string | null {
  if (!localDateTime) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(localDateTime);
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  // Première estimation : on traite l'heure saisie comme si elle était déjà
  // en UTC, puis on corrige avec l'offset réel de Paris à cet instant.
  const guessUtcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? "0"),
  );

  if (Number.isNaN(guessUtcMs)) return null;

  const offsetMinutes = getParisOffsetMinutes(new Date(guessUtcMs));
  const actualUtcMs = guessUtcMs - offsetMinutes * 60_000;

  return new Date(actualUtcMs).toISOString();
}

/**
 * Convertit un ISO UTC (ex: valeur stockée en base) en chaîne
 * "YYYY-MM-DDTHH:mm" représentant l'heure locale Europe/Paris, pour
 * pré-remplir un input `datetime-local`.
 */
export function utcIsoToParisLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Formatte une fenêtre [fromISO, toISO] (ISO UTC) en heure locale Europe/Paris
 * lisible, pour les messages de diagnostic admin.
 */
export function formatParisWindow(
  fromISO: string | null | undefined,
  toISO: string | null | undefined,
): string {
  if (!fromISO || !toISO) return "";

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";

  return `du ${fmt.format(from)} au ${fmt.format(to)} (heure de Paris)`;
}

/**
 * Vérifie qu'un coup d'envoi (ISO UTC, tel que renvoyé par football-data.org)
 * tombe dans une fenêtre [fromISO, toISO] (bornes ISO UTC incluses).
 * Comparaison sur de vrais timestamps — jamais sur des chaînes de date.
 *
 * fromISO/toISO absents (null/undefined) = borne non contrainte de ce côté.
 * kickoffISO absent ou invalide = hors fenêtre dès qu'une borne est active
 * (on ne peut pas vérifier sans coup d'envoi connu).
 */
export function isMatchInWindow(
  kickoffISO: string | null | undefined,
  fromISO: string | null | undefined,
  toISO: string | null | undefined,
): boolean {
  if (!fromISO && !toISO) return true;

  if (!kickoffISO) return false;
  const kickoff = new Date(kickoffISO).getTime();
  if (Number.isNaN(kickoff)) return false;

  if (fromISO) {
    const from = new Date(fromISO).getTime();
    if (!Number.isNaN(from) && kickoff < from) return false;
  }

  if (toISO) {
    const to = new Date(toISO).getTime();
    if (!Number.isNaN(to) && kickoff > to) return false;
  }

  return true;
}

function competitionFromMatch(match: Match): BonusCompetitionCode | null {
  // BUG corrigé ici — cette fonction comparait match_type à des libellés
  // longs ("PREMIER_LEAGUE", "LIGA", ...) alors que la synchronisation
  // (adminService.ts, syncCompetitionMatches) stocke le code court
  // football-data.org ("PL", "PD", "SA", "BL1"). La comparaison ne
  // matchait donc jamais, scoreBonusCandidate retournait null pour
  // chaque match, et selectBestBonusMatch pour les 4 championnats quelle
  // que soit la période choisie. normalizeCompetitionName gère déjà les
  // codes courts (et les libellés longs, en confort) : on la réutilise
  // plutôt que de dupliquer la logique de reconnaissance.
  return normalizeCompetitionName(match.match_type);
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
/**
 * `standings` = classement en direct du championnat de ce match (voir
 * standingsService.ts), optionnel : absent (ou équipe non trouvée dedans),
 * le calcul dégrade proprement sur le niveau statique connu (levelBalanceRatio)
 * plutôt que de planter — jamais de score fabriqué à partir de rien.
 */
export function scoreBonusCandidate(
  match: Match,
  standings?: CompetitionStandings,
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

  const entryHome = lookupStandingsEntry(standings, match.home_team);
  const entryAway = lookupStandingsEntry(standings, match.away_team);
  const totalTeams = standings?.totalTeams ?? 0;

  const standingsBalance = scoreStandingsBalance(entryHome, entryAway, totalTeams, match.home_team, match.away_team);
  const levelGap = scoreLevelGap(entryHome, entryAway, match.home_team, match.away_team);
  const form = scoreForm(entryHome, entryAway);
  const prestige = scorePrestige(match.home_team, match.away_team);
  const rivalry = scoreRivalry(match.home_team, match.away_team);
  const schedule = scoreSchedule(match.kickoff);

  const total = standingsBalance + levelGap + form + prestige + rivalry + schedule;

  const reasons: string[] = [];

  if (entryHome && entryAway) {
    const gap = Math.abs(entryHome.position - entryAway.position);
    if (gap <= 2) reasons.push(`Classement très serré (${entryHome.position}e vs ${entryAway.position}e)`);
    else if (standingsBalance >= BONUS_SELECTION_WEIGHTS.standingsBalance * 0.6) {
      reasons.push(`Équipes proches au classement (${entryHome.position}e vs ${entryAway.position}e)`);
    }
    if (standings?.source === "previous") reasons.push("Classement de la saison précédente (début de saison)");
  } else {
    reasons.push("Classement en direct indisponible — repli sur le niveau connu");
  }

  if (form >= BONUS_SELECTION_WEIGHTS.form * 0.75) reasons.push("Deux équipes en forme");

  if (prestige >= BONUS_SELECTION_WEIGHTS.prestige * 0.85) reasons.push("Affiche prestigieuse");

  if (rivalry > 0) reasons.push("Rivalité / derby");

  if (schedule >= BONUS_SELECTION_WEIGHTS.schedule * 0.9) reasons.push("Créneau idéal");

  return {
    match,
    competitionCode,
    score: {
      total,
      standingsBalance,
      levelGap,
      form,
      prestige,
      rivalry,
      schedule,
    },
    reasons,
  };
}

export function selectBestBonusMatch(
  matches: Match[],
  competitionCode: BonusCompetitionCode,
  standings?: CompetitionStandings,
): BonusCandidate | null {
  return matches
    .map((match) => scoreBonusCandidate(match, standings))
    .filter(
      (candidate): candidate is BonusCandidate =>
        candidate !== null && candidate.competitionCode === competitionCode,
    )
    .sort((a, b) => {
      if (b.score.total !== a.score.total) {
        return b.score.total - a.score.total;
      }

      // Départage : équilibre au classement actuel, puis écart de niveau
      // (les deux nouveaux critères dominants) — plus jamais le prestige
      // en premier, qui contredirait tout le principe du barème dynamique.
      if (b.score.standingsBalance !== a.score.standingsBalance) {
        return b.score.standingsBalance - a.score.standingsBalance;
      }

      return b.score.levelGap - a.score.levelGap;
    })[0] ?? null;
}

export function generateBonusSelection(
  matches: Match[],
  standingsByCompetition?: Partial<Record<BonusCompetitionCode, CompetitionStandings>>,
): Record<BonusCompetitionCode, BonusCandidate | null> {
  return {
    PL: selectBestBonusMatch(matches, "PL", standingsByCompetition?.PL),
    PD: selectBestBonusMatch(matches, "PD", standingsByCompetition?.PD),
    SA: selectBestBonusMatch(matches, "SA", standingsByCompetition?.SA),
    BL1: selectBestBonusMatch(matches, "BL1", standingsByCompetition?.BL1),
  };
}
