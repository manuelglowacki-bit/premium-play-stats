import { normalizeTeamName } from "./bonusSelectionService";
import type { BonusCompetitionCode } from "./bonusSelectionService";

/**
 * Classement en direct des 4 championnats bonus (PL/PD/SA/BL1), consommé
 * par le moteur de sélection (bonusSelectionService.ts) pour juger
 * l'équilibre d'un match candidat sur la position RÉELLE des deux équipes
 * au moment de la génération — pas sur une réputation figée. Voir
 * api/standings.ts (proxy football-data.org, token serveur uniquement).
 */

export type StandingsTeamEntry = {
  position: number;
  playedGames: number;
  points: number;
  goalDifference: number;
  /** Chaîne brute football-data.org, ex. "W,D,L,W,W" (plus ancien → plus récent). */
  form: string | null;
};

export type CompetitionStandings = {
  totalTeams: number;
  entriesByTeam: Map<string, StandingsTeamEntry>;
  /** Année de saison football-data.org réellement utilisée (peut différer
   * de la saison en cours si repli sur la saison précédente). */
  season: string;
  /** "current" = classement de la saison en cours (cas normal dès que
   * suffisamment de journées sont jouées) ; "previous" = repli sur la
   * saison précédente (tout début de saison en cours) ; "unavailable" =
   * aucun classement exploitable (API indisponible, championnat inconnu). */
  source: "current" | "previous" | "unavailable";
};

/** Nombre moyen minimum de journées jouées pour considérer le classement de
 * la saison en cours comme assez représentatif. En dessous (tout début de
 * saison), on retombe sur la saison précédente — voir getBonusStandings. */
const MIN_PLAYED_GAMES_FOR_CURRENT_SEASON = 3;

type ApiStandingsRow = {
  position: number;
  team?: { name?: string | null } | null;
  playedGames?: number | null;
  points?: number | null;
  goalDifference?: number | null;
  form?: string | null;
};

async function fetchStandingsTable(
  code: BonusCompetitionCode,
  season: string,
): Promise<ApiStandingsRow[] | null> {
  try {
    const response = await fetch(
      `/api/standings?competition=${encodeURIComponent(code)}&season=${encodeURIComponent(season)}`,
      { headers: { Accept: "application/json" } },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) return null;
    const table = Array.isArray(body?.table) ? (body.table as ApiStandingsRow[]) : [];
    return table;
  } catch {
    return null;
  }
}

function toStandings(
  table: ApiStandingsRow[],
  season: string,
  source: "current" | "previous",
): CompetitionStandings {
  const entriesByTeam = new Map<string, StandingsTeamEntry>();
  table.forEach((row) => {
    const name = row.team?.name;
    if (!name) return;
    entriesByTeam.set(normalizeTeamName(name), {
      position: Number(row.position ?? 0),
      playedGames: Number(row.playedGames ?? 0),
      points: Number(row.points ?? 0),
      goalDifference: Number(row.goalDifference ?? 0),
      form: row.form ?? null,
    });
  });
  return { totalTeams: table.length, entriesByTeam, season, source };
}

function isCurrentSeasonUsable(table: ApiStandingsRow[]): boolean {
  if (table.length === 0) return false;
  const avgPlayed = table.reduce((sum, r) => sum + Number(r.playedGames ?? 0), 0) / table.length;
  return avgPlayed >= MIN_PLAYED_GAMES_FOR_CURRENT_SEASON;
}

/**
 * Classement en direct d'un championnat bonus, avec repli automatique :
 *   - saison en cours dès qu'elle a assez de journées jouées (cas normal
 *     après les premières journées) ;
 *   - sinon saison précédente (tout début de saison en cours, ex. J1) ;
 *   - sinon saison en cours quand même si elle a AU MOINS des données
 *     (mieux que rien) ;
 *   - sinon "unavailable" — le moteur de scoring dégrade proprement
 *     (repli sur le niveau statique connu) plutôt que de planter.
 */
export async function getBonusStandings(
  code: BonusCompetitionCode,
  currentSeasonYear: string,
): Promise<CompetitionStandings> {
  const currentTable = await fetchStandingsTable(code, currentSeasonYear);
  if (currentTable && isCurrentSeasonUsable(currentTable)) {
    return toStandings(currentTable, currentSeasonYear, "current");
  }

  const previousSeasonYear = String(Number(currentSeasonYear) - 1);
  const previousTable = await fetchStandingsTable(code, previousSeasonYear);
  if (previousTable && previousTable.length > 0) {
    return toStandings(previousTable, previousSeasonYear, "previous");
  }

  if (currentTable && currentTable.length > 0) {
    return toStandings(currentTable, currentSeasonYear, "current");
  }

  return { totalTeams: 0, entriesByTeam: new Map(), season: currentSeasonYear, source: "unavailable" };
}

/** Charge le classement des 4 championnats bonus en une fois. */
export async function getAllBonusStandings(
  currentSeasonYear: string,
): Promise<Record<BonusCompetitionCode, CompetitionStandings>> {
  const codes: BonusCompetitionCode[] = ["PL", "PD", "SA", "BL1"];
  const results = await Promise.all(codes.map((code) => getBonusStandings(code, currentSeasonYear)));
  return { PL: results[0], PD: results[1], SA: results[2], BL1: results[3] };
}
