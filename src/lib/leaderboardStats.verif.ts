/**
 * VÉRIFICATION DU CALCUL DES POINTS
 * =================================
 * Lancer avec :  npm run verif-points
 *
 * C'est le calcul le plus important du site : 23 joueurs, une cagnotte, et
 * un classement que personne ne peut recalculer à la main. Un point perdu en
 * silence ne se voit pas — il se découvre trois journées plus tard, quand il
 * est trop tard pour savoir d'où il venait.
 *
 * Ce fichier fige donc les règles ET les pannes déjà rencontrées. Chaque cas
 * porte le nom de ce qu'il protège. Si l'un d'eux tombe, quelque chose vient
 * de casser dans le calcul des points, et il faut le regarder avant de
 * déployer quoi que ce soit.
 */

import { computeLeagueStats } from "./leaderboardStats";
import { scoreLigue1Prediction, scoreBonusPrediction } from "./predictionScoring";

// ------------------------------------------------------------------
// Petit harnais : aucune dépendance, sortie lisible.
// ------------------------------------------------------------------
let reussis = 0;
const echecs: string[] = [];

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    reussis += 1;
    console.log(`  ok    ${intitule}`);
  } else {
    echecs.push(`${intitule}\n          attendu : ${b}\n          obtenu  : ${a}`);
    console.log(`  ECHEC ${intitule}`);
    console.log(`          attendu : ${b}`);
    console.log(`          obtenu  : ${a}`);
  }
}

const J1 = "jour-1";
const J2 = "jour-2";
const SAISON = "saison-1";

type Options = {
  ligue1?: any[];
  bonus?: any[];
  options?: any[];
  predictions?: any[];
  profils?: any[];
  nomsEquipes?: Record<string, string>;
};

function calculer(o: Options) {
  return computeLeagueStats(
    (o.ligue1 ?? []) as any,
    (o.bonus ?? []) as any,
    (o.options ?? []) as any,
    (o.predictions ?? []) as any,
    (o.profils ?? [{ id: "u1", pseudo: "Joueur", favorite_team_id: null }]) as any,
    o.nomsEquipes ?? {},
    { seasonByMatchdayId: { [J1]: SAISON, [J2]: SAISON } },
  );
}

const matchL1 = (id: string, jour: string, dom: number, ext: number, extra: any = {}) => ({
  id, matchday_id: jour, home_team_id: "dom", away_team_id: "ext",
  home_team: "Domicile", away_team: "Exterieur",
  home_score: dom, away_score: ext, finished: true, is_bonus: false, ...extra,
});

const matchBonus = (id: string, jour: string, dom: number, ext: number) => ({
  id, matchday_id: jour, home_team_id: null, away_team_id: null,
  home_team: "Etranger A", away_team: "Etranger B",
  home_score: dom, away_score: ext, finished: true, is_bonus: true,
});

const prono = (matchId: string, dom: number, ext: number, quand = "2026-08-01T10:00:00Z") => ({
  user_id: "u1", match_id: matchId, home_prediction: dom, away_prediction: ext, created_at: quand,
});

// ==================================================================
console.log("\nBARÈME — les trois familles de points\n");
// ==================================================================

verifier("Ligue 1 : bon résultat = 1 pt",
  scoreLigue1Prediction({ homeScore: 3, awayScore: 1, homePrediction: 1, awayPrediction: 0, isFavoriteMatch: false }).points, 1);
verifier("Ligue 1 : score exact = 1 pt aussi (pas de prime)",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 1, homePrediction: 2, awayPrediction: 1, isFavoriteMatch: false }).points, 1);
verifier("Ligue 1 : mauvais résultat = 0",
  scoreLigue1Prediction({ homeScore: 0, awayScore: 2, homePrediction: 1, awayPrediction: 0, isFavoriteMatch: false }).points, 0);
verifier("Ligue 1 : un nul annoncé, un nul obtenu = 1 pt",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 2, homePrediction: 0, awayPrediction: 0, isFavoriteMatch: false }).points, 1);

verifier("Cœur : score exact = 2 pts",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 1, homePrediction: 2, awayPrediction: 1, isFavoriteMatch: true }).points, 2);
verifier("Cœur : bon résultat = 1 pt",
  scoreLigue1Prediction({ homeScore: 3, awayScore: 1, homePrediction: 1, awayPrediction: 0, isFavoriteMatch: true }).points, 1);
verifier("Cœur : raté = 0",
  scoreLigue1Prediction({ homeScore: 0, awayScore: 1, homePrediction: 2, awayPrediction: 0, isFavoriteMatch: true }).points, 0);

verifier("Bonus : score exact = 3 pts",
  scoreBonusPrediction({ homeScore: 2, awayScore: 1, homePrediction: 2, awayPrediction: 1 }).points, 3);
verifier("Bonus : bon résultat = 2 pts",
  scoreBonusPrediction({ homeScore: 4, awayScore: 0, homePrediction: 1, awayPrediction: 0 }).points, 2);
verifier("Bonus : raté = 0",
  scoreBonusPrediction({ homeScore: 1, awayScore: 1, homePrediction: 2, awayPrediction: 0 }).points, 0);

// ==================================================================
console.log("\nADDITION DES JOURNÉES — aucun point ne doit se perdre en route\n");
// ==================================================================

{
  const s = calculer({
    ligue1: [matchL1("a", J1, 3, 1), matchL1("b", J2, 0, 0)],
    predictions: [prono("a", 1, 0), prono("b", 0, 0)],
  });
  verifier("Ligue 1 sur deux journées : 1 + 1", s.pointsByUser["u1"], 2);
  verifier("...et réparti sur les bonnes journées", s.pointsByMatchday, { [J1]: 1, [J2]: 1 });
  verifier("...le total égale la somme des journées",
    Object.values(s.pointsByMatchday).reduce((t, n) => t + n, 0), s.pointsByUser["u1"]);
}

{
  // LE BUG D'AOÛT 2026, reproduit à l'identique.
  //
  // Le modèle est correct : bonus_options.matchday_id porte la journée de
  // LIGUE 1, matches.matchday_id celle du championnat étranger.
  // Atlético–Villarreal est la 2e journée de Liga jouée pendant la 1re
  // journée de Ligue 1.
  //
  // Le défaut : chaque tirage rejoué ajoutait une ligne d'option sans effacer
  // les précédentes. Le même match se retrouvait rattaché à la journée 1 ET à
  // la journée 2 de Ligue 1, et le calcul gardait « la dernière lue », dans un
  // ordre arbitraire. Valider un bonus décalait donc l'attribution d'un autre,
  // déjà joué et déjà compté.
  const LIGA_J2 = "liga-jour-2";
  const PL_J2 = "pl-jour-2";

  const s = calculer({
    ligue1: [matchL1("l1", J1, 5, 2)],
    bonus: [
      // Atlético–Villarreal : Liga J2, joué 2-2, rattaché à la Ligue 1 J1
      { ...matchBonus("atletico", LIGA_J2, 2, 2) },
      // Liverpool–Nottingham : PL J2, pas encore joué, rattaché à la Ligue 1 J2
      { ...matchBonus("liverpool", PL_J2, 0, 0), finished: false, home_score: null, away_score: null },
    ],
    options: [
      { matchday_id: J1, match_id: "atletico", is_active: false, created_at: "2026-08-10T09:00:00Z" },
      // LA ligne en vigueur : Atlético appartient bien à la Ligue 1 J1.
      { matchday_id: J1, match_id: "atletico", is_active: true, created_at: "2026-08-12T09:00:00Z" },
      { matchday_id: J2, match_id: "liverpool", is_active: true, created_at: "2026-08-24T09:00:00Z" },
      // Ligne PÉRIMÉE placée EN DERNIER, exprès : c'est la situation réelle,
      // l'ordre de lecture n'étant pas garanti par la base. L'ancien code
      // gardait « la dernière lue » et rattachait donc Atlético à la journée 2,
      // faisant disparaître les points de la journée 1.
      { matchday_id: J2, match_id: "atletico", is_active: false, created_at: "2026-08-20T09:00:00Z" },
    ],
    predictions: [
      prono("l1", 1, 0, "2026-08-15T10:00:00Z"),
      prono("atletico", 1, 1, "2026-08-15T11:00:00Z"), // bon résultat -> 2 pts
      prono("liverpool", 1, 0, "2026-08-24T11:00:00Z"), // match non joué -> 0
    ],
  });

  verifier("Bonus dupliqué : la ligne ACTIVE fait foi", s.pointsByUser["u1"], 3);
  verifier("...les points restent sur la journée de Ligue 1 attendue",
    s.pointsByMatchday, { [J1]: 3 });
}

{
  // Aucune ligne active (données abîmées) : la plus récente tranche, et le
  // résultat ne doit surtout pas dépendre de l'ordre de lecture.
  const s = calculer({
    bonus: [matchBonus("b", J1, 2, 1)],
    options: [
      // La plus récente (J2) est placée EN PREMIER : le résultat ne doit pas
      // dépendre de l'ordre de lecture.
      { matchday_id: J2, match_id: "b", is_active: false, created_at: "2026-08-09T09:00:00Z" },
      { matchday_id: J1, match_id: "b", is_active: false, created_at: "2026-08-01T09:00:00Z" },
    ],
    predictions: [prono("b", 2, 1)],
  });
  verifier("Sans ligne active : la plus récente tranche", s.pointsByMatchday, { [J2]: 3 });
}

{
  // Deux bonus la MÊME journée (tirage rejoué, le joueur a choisi deux fois) :
  // la règle veut qu'un seul compte — le plus récent.
  const s = calculer({
    bonus: [matchBonus("b1", J1, 1, 0), matchBonus("b2", J1, 3, 3)],
    options: [
      { matchday_id: J1, match_id: "b1" },
      { matchday_id: J1, match_id: "b2" },
    ],
    predictions: [
      prono("b1", 1, 0, "2026-08-10T10:00:00Z"), // exact = 3, mais ancien
      prono("b2", 3, 3, "2026-08-12T10:00:00Z"), // exact = 3, le plus récent
    ],
  });
  verifier("Deux bonus le même jour : un seul compte", s.pointsByUser["u1"], 3);
}

{
  // Dates identiques et aucune ligne active : le resultat ne doit pas dependre
  // de l'ordre de lecture. On calcule deux fois, avec les options dans un ordre
  // puis dans l'autre — les deux totaux doivent etre identiques.
  const optionsA = [
    { matchday_id: J1, match_id: "b", is_active: false, created_at: "2026-08-01T09:00:00Z" },
    { matchday_id: J2, match_id: "b", is_active: false, created_at: "2026-08-01T09:00:00Z" },
  ];
  const commun = { bonus: [matchBonus("b", J1, 2, 1)], predictions: [prono("b", 2, 1)] };
  const sensA = calculer({ ...commun, options: optionsA });
  const sensB = calculer({ ...commun, options: [...optionsA].reverse() });
  verifier("Dates egales : le resultat ne depend pas de l'ordre de lecture",
    sensA.pointsByMatchday, sensB.pointsByMatchday);
}

// ==================================================================
console.log("\nCLUB DE CŒUR — reconnu par identifiant comme par nom\n");
// ==================================================================

{
  const s = calculer({
    ligue1: [matchL1("m", J1, 2, 1, { home_team_id: "lens", home_team: "Racing Club de Lens" })],
    predictions: [prono("m", 2, 1)],
    profils: [{ id: "u1", pseudo: "Joueur", favorite_team_id: "lens" }],
    nomsEquipes: { lens: "Racing Club de Lens" },
  });
  verifier("Cœur reconnu : score exact = 2 pts (et non 1)", s.pointsByUser["u1"], 2);
  verifier("...et compté comme score exact", s.exactScoresByUser["u1"], 1);
}

{
  const s = calculer({
    ligue1: [matchL1("m", J1, 2, 1, { home_team_id: "lens", home_team: "Racing Club de Lens" })],
    predictions: [prono("m", 2, 1)],
    profils: [{ id: "u1", pseudo: "Joueur", favorite_team_id: "autre" }],
    nomsEquipes: { autre: "Lille OSC" },
  });
  verifier("Match ordinaire : score exact = 1 pt", s.pointsByUser["u1"], 1);
}

// ==================================================================
console.log("\nGARDE-FOUS — ce qui ne doit JAMAIS rapporter de points\n");
// ==================================================================

{
  const s = calculer({
    ligue1: [{ ...matchL1("m", J1, 2, 1), finished: false, home_score: null, away_score: null }],
    predictions: [prono("m", 2, 1)],
  });
  verifier("Match sans score : 0 pt", s.pointsByUser["u1"] ?? 0, 0);
}

{
  const s = calculer({
    ligue1: [matchL1("m", J1, 2, 1)],
    predictions: [{ user_id: "u1", match_id: "m", home_prediction: null, away_prediction: null, created_at: "2026-08-01T10:00:00Z" }],
  });
  verifier("Pronostic vide : 0 pt", s.pointsByUser["u1"] ?? 0, 0);
}

{
  const s = calculer({
    ligue1: [matchL1("m", J1, 2, 1)],
    predictions: [prono("inconnu", 2, 1)],
  });
  verifier("Pronostic sur un match absent : ignoré, pas d'erreur", s.pointsByUser["u1"] ?? 0, 0);
}

// ==================================================================
const total = reussis + echecs.length;
console.log(`\n${"=".repeat(64)}`);
if (echecs.length === 0) {
  console.log(`${reussis}/${total} verifications passees. Le calcul des points est conforme.`);
} else {
  console.log(`${reussis}/${total} passees — ${echecs.length} ECHEC(S) :\n`);
  echecs.forEach((e) => console.log(`  - ${e}`));
  console.log("\nNE PAS DEPLOYER tant que ces points ne sont pas corriges.");
}
console.log(`${"=".repeat(64)}\n`);
process.exit(echecs.length === 0 ? 0 : 1);
