/**
 * SÉLECTION DES MATCHS BONUS — VÉRIFICATIONS
 * ==========================================
 * `npm run verif-bonus`
 *
 * La question posée : le match bonus est-il choisi sur des critères réels, ou
 * un peu au hasard ? Le barème annonce le classement actuel en critère
 * dominant (45/100) et le prestige en critère mineur (10/100). Un commentaire
 * peut mentir — ces contrôles font tourner le vrai moteur sur des situations
 * concrètes et vérifient QUI GAGNE.
 *
 * Ce qui compte ici n'est pas la note exacte d'un match, mais l'ORDRE : un
 * choc entre voisins de classement doit toujours passer devant un match
 * déséquilibré, même si ce dernier met en scène un club plus célèbre.
 */

import {
  BONUS_SELECTION_WEIGHTS,
  normalizeTeamName,
  scoreBonusCandidate,
  selectBestBonusMatch,
} from "./bonusSelectionService";
import type { CompetitionStandings } from "./standingsService";

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`OK    ${nom}`);
    return;
  }
  echecs += 1;
  console.log(`ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
}

const DEMAIN = new Date(Date.now() + 24 * 3600 * 1000);
DEMAIN.setUTCHours(19, 0, 0, 0);
const KICKOFF = DEMAIN.toISOString();

function match(id: string, home: string, away: string): any {
  return {
    id,
    home_team: home,
    away_team: away,
    kickoff: KICKOFF,
    match_type: "PL",
    finished: false,
    status: "TIMED",
  };
}

function equipe(position: number, points: number, goalDifference: number, form: string | null) {
  return { position, playedGames: 20, points, goalDifference, form };
}

/** Un classement de Premier League fabriqué pour les besoins du test.
 *  Les clés passent par normalizeTeamName(), comme en production. */
const CLASSEMENT: CompetitionStandings = {
  totalTeams: 20,
  season: "2025",
  source: "current",
  entriesByTeam: new Map(
    (
      [
        ["Manchester City", equipe(1, 50, 40, "W,W,W,W,W")],
        ["Arsenal", equipe(2, 45, 28, "W,W,W,D,W")],
        ["Liverpool", equipe(3, 42, 22, "W,D,W,W,D")],
        ["Chelsea", equipe(4, 41, 20, "W,W,D,W,L")],
        ["Brentford", equipe(10, 26, 0, "D,W,L,D,W")],
        ["Crystal Palace", equipe(11, 25, -2, "L,D,W,D,L")],
        ["Burnley", equipe(19, 12, -30, "L,L,D,L,L")],
        ["Sheffield United", equipe(20, 9, -38, "L,L,L,L,L")],
      ] as const
    ).map(([nom, entree]) => [normalizeTeamName(nom), entree]),
  ),
};

// ---------- 1. Le barème annonce-t-il ce qu'il applique ? ----------
{
  const total = Object.values(BONUS_SELECTION_WEIGHTS).reduce((s, v) => s + v, 0);
  verifier("les poids du barème totalisent bien 100", total === 100, `total = ${total}`);
  verifier(
    "le classement pèse plus que tout le reste réuni hors écart de niveau",
    BONUS_SELECTION_WEIGHTS.standingsBalance >
      BONUS_SELECTION_WEIGHTS.form + BONUS_SELECTION_WEIGHTS.prestige +
      BONUS_SELECTION_WEIGHTS.rivalry + BONUS_SELECTION_WEIGHTS.schedule,
  );
  verifier(
    "le prestige reste un critère mineur",
    BONUS_SELECTION_WEIGHTS.prestige <= 10,
    `${BONUS_SELECTION_WEIGHTS.prestige}/100`,
  );
}

// ---------- 2. Le choc serré bat le match déséquilibré ----------
{
  const serre = scoreBonusCandidate(match("a", "Liverpool", "Chelsea"), CLASSEMENT);
  const desequilibre = scoreBonusCandidate(match("b", "Manchester City", "Sheffield United"), CLASSEMENT);

  verifier(
    "3e vs 4e note plus haut que 1er vs 20e",
    (serre?.score.total ?? 0) > (desequilibre?.score.total ?? 0),
    `serré ${serre?.score.total} / déséquilibré ${desequilibre?.score.total}`,
  );
}

// ---------- 3. Deux inconnus proches battent une grosse affiche déséquilibrée ----------
// C'est LE test du barème : si le prestige primait, City–Sheffield gagnerait.
{
  const inconnus = scoreBonusCandidate(match("c", "Brentford", "Crystal Palace"), CLASSEMENT);
  const grosseAffiche = scoreBonusCandidate(match("d", "Manchester City", "Burnley"), CLASSEMENT);

  verifier(
    "10e vs 11e bat City–Burnley malgré la notoriété",
    (inconnus?.score.total ?? 0) > (grosseAffiche?.score.total ?? 0),
    `inconnus ${inconnus?.score.total} / grosse affiche ${grosseAffiche?.score.total}`,
  );
}

// ---------- 4. La sélection choisit bien le meilleur du lot ----------
{
  const lot = [
    match("m1", "Manchester City", "Sheffield United"),
    match("m2", "Liverpool", "Chelsea"),
    match("m3", "Manchester City", "Burnley"),
  ];
  const choisi = selectBestBonusMatch(lot, "PL", CLASSEMENT);
  verifier(
    "le match retenu est le choc entre voisins de classement",
    choisi?.match.id === "m2",
    `retenu : ${choisi?.match.id} (${choisi?.match.home_team} vs ${choisi?.match.away_team})`,
  );
}

// ---------- 5. Aucun hasard : deux appels donnent le même résultat ----------
{
  const lot = [
    match("m1", "Manchester City", "Sheffield United"),
    match("m2", "Liverpool", "Chelsea"),
    match("m3", "Brentford", "Crystal Palace"),
  ];
  const a = selectBestBonusMatch(lot, "PL", CLASSEMENT);
  const b = selectBestBonusMatch([...lot].reverse(), "PL", CLASSEMENT);
  verifier(
    "le résultat ne dépend ni du hasard ni de l'ordre de la liste",
    a?.match.id === b?.match.id,
    `${a?.match.id} vs ${b?.match.id}`,
  );
}

// ---------- 6. Sans classement, ça dégrade au lieu de casser ----------
{
  const sansClassement = scoreBonusCandidate(match("e", "Liverpool", "Chelsea"), undefined);
  verifier(
    "sans classement en direct, un candidat est quand même noté",
    sansClassement !== null && sansClassement.score.total > 0,
    `total = ${sansClassement?.score.total}`,
  );
  verifier(
    "et il le dit clairement dans ses raisons",
    (sansClassement?.reasons ?? []).some((r) => /indisponible/i.test(r)),
    (sansClassement?.reasons ?? []).join(" | "),
  );
}

// ---------- 7. Un match déjà joué n'est jamais proposé ----------
{
  const joue = { ...match("f", "Liverpool", "Chelsea"), finished: true };
  verifier("un match terminé est écarté", scoreBonusCandidate(joue, CLASSEMENT) === null);
}

console.log(echecs === 0 ? "\nTOUT PASSE" : `\n${echecs} ECHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);
