/**
 * Verification : les colonnes `is_active` et `created_at` de bonus_options
 * ne sont pas decoratives — sans elles, le moteur rattache un match bonus a
 * la mauvaise journee et le total du joueur change.
 *
 * Contexte reel (constate en production) : un meme match porte PLUSIEURS
 * lignes bonus_options, sur des journees de Ligue 1 differentes — chaque
 * tirage rejoue ajoute la sienne sans effacer la precedente. Seule la ligne
 * active dit ou le bonus se rattache vraiment ; a defaut, la plus recente.
 *
 * Le Classement, l'Accueil et useMesPoints selectionnent bien ces deux
 * colonnes. La page Stats et la page Profil ne les selectionnaient pas :
 * elles envoyaient au MEME moteur des lignes ou `is_active` vaut undefined,
 * donc aucune n'etait active et le depart se faisait dans l'ordre — arbitraire
 * — de la base. D'ou deux totaux differents pour un seul joueur.
 *
 *   npm run verif-options-bonus
 */
import {
  computeLeagueStats,
  type LeagueBonusOption,
  type LeagueMatch,
  type LeaguePrediction,
  type LeagueProfile,
} from "./leaderboardStats";

let total = 0;
let echecs = 0;

function verifier(titre: string, condition: boolean, detail?: string) {
  total += 1;
  if (condition) {
    console.log(`  ok    ${titre}`);
  } else {
    echecs += 1;
    console.log(`  ECHEC ${titre}${detail ? `\n        ${detail}` : ""}`);
  }
}

function egal(titre: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  verifier(titre, a === b, `obtenu ${a}, attendu ${b}`);
}

const JOUEUR = "joueur-1";
const J1 = "journee-1";
const J2 = "journee-2";

const profils: LeagueProfile[] = [{ id: JOUEUR, favorite_team_id: null, favorite_team: null }];

/** Un match de Ligue 1 termine, pronostique juste : 1 pt. */
const matchL1: LeagueMatch = {
  id: "l1-1", matchday_id: J2,
  home_team_id: "a", away_team_id: "b", home_team: "Lens", away_team: "Lille",
  home_score: 2, away_score: 0, finished: true, is_bonus: false,
};

/** Le match bonus, tire une premiere fois sur J1 puis re-tire sur J2. */
const matchBonus: LeagueMatch = {
  id: "bonus-1", matchday_id: "journee-etrangere",
  home_team_id: "c", away_team_id: "d", home_team: "Coventry", away_team: "Hull",
  home_score: 1, away_score: 2, finished: true, is_bonus: true,
};

const pronostics: LeaguePrediction[] = [
  { user_id: JOUEUR, match_id: "l1-1", home_prediction: 1, away_prediction: 0, created_at: "2026-08-24T12:00:00Z" },
  { user_id: JOUEUR, match_id: "bonus-1", home_prediction: 0, away_prediction: 2, created_at: "2026-08-24T12:00:00Z" },
];

/** Ce que le Classement envoie : les deux lignes, avec is_active et created_at. */
const optionsCompletes: LeagueBonusOption[] = [
  { matchday_id: J1, match_id: "bonus-1", is_active: false, created_at: "2026-08-10T10:00:00Z" },
  { matchday_id: J2, match_id: "bonus-1", is_active: true, created_at: "2026-08-20T10:00:00Z" },
];

/** Ce que la page Stats envoyait : les deux memes lignes, colonnes absentes. */
const optionsTronquees: LeagueBonusOption[] = optionsCompletes.map((o) => ({
  matchday_id: o.matchday_id,
  match_id: o.match_id,
}));

function calculer(options: LeagueBonusOption[]) {
  return computeLeagueStats([matchL1], [matchBonus], options, pronostics, profils, {});
}

const avecColonnes = calculer(optionsCompletes);
const sansColonnes = calculer(optionsTronquees);

console.log("\nVERIFICATION DES COLONNES is_active / created_at DE bonus_options");
console.log("=".repeat(64));

// --- Le calcul correct, celui du Classement -------------------------------
console.log("\nAvec is_active et created_at (Classement, Accueil, useMesPoints)");
egal("le joueur a 3 pts : 1 en Ligue 1 + 2 de bonus", avecColonnes.pointsByUser[JOUEUR], 3);
egal(
  "le bonus est rattache a la journee 2, celle du tirage actif",
  avecColonnes.pointsByUserAndMatchday[JOUEUR]?.[J2],
  3,
);
verifier(
  "aucun point n'est attribue a la journee 1",
  !avecColonnes.pointsByUserAndMatchday[JOUEUR]?.[J1],
  `obtenu ${JSON.stringify(avecColonnes.pointsByUserAndMatchday[JOUEUR]?.[J1])}`,
);

// --- Ce que produisaient Stats et Profil ----------------------------------
console.log("\nSans ces colonnes (ce que Stats et Profil envoyaient)");
verifier(
  "le bonus part sur la journee 1, ou le joueur n'a rien joue",
  sansColonnes.pointsByUserAndMatchday[JOUEUR]?.[J1] === 2,
  `obtenu ${JSON.stringify(sansColonnes.pointsByUserAndMatchday[JOUEUR]?.[J1])}`,
);
verifier(
  "la journee 2 perd les 2 points du bonus",
  sansColonnes.pointsByUserAndMatchday[JOUEUR]?.[J2] === 1,
  `obtenu ${JSON.stringify(sansColonnes.pointsByUserAndMatchday[JOUEUR]?.[J2])}`,
);

// --- La consequence visible pour le joueur --------------------------------
console.log("\nConsequence");
verifier(
  "la repartition par journee differe entre les deux appels",
  JSON.stringify(avecColonnes.pointsByUserAndMatchday) !==
    JSON.stringify(sansColonnes.pointsByUserAndMatchday),
  "les deux calculs donnent la meme repartition : le scenario ne reproduit plus le defaut",
);
egal(
  "le total saison, lui, reste juste dans les deux cas",
  sansColonnes.pointsByUser[JOUEUR],
  avecColonnes.pointsByUser[JOUEUR],
);

// ==========================================================================
// CE QUI N'EST **PAS** EN CAUSE — verifie pour ne pas accuser a tort
// ==========================================================================
// Un ancien match bonus, desactive depuis, reste volontairement candidat pour
// sa journee : le moteur ne veut jamais perdre le pronostic d'un joueur sur
// une rencontre qu'il a reellement jouee (voir le commentaire de
// classement.tsx). `is_active` n'arbitre qu'entre PLUSIEURS LIGNES D'UN MEME
// MATCH, pas entre deux matchs differents. Ce comportement est identique sur
// toutes les pages : il n'explique donc aucun ecart entre elles.
console.log("\n\nCe qui n'est pas en cause");

const AUTRE = "bonus-autre-match";
const matchsDeuxBonus: LeagueMatch[] = [
  { id: "bonus-1", matchday_id: "etranger-1", home_team_id: "c", away_team_id: "d",
    home_team: "Coventry", away_team: "Hull", home_score: 1, away_score: 2,
    finished: true, is_bonus: true },
  { id: AUTRE, matchday_id: "etranger-2", home_team_id: "g", away_team_id: "h",
    home_team: "Fiorentina", away_team: "Frosinone", home_score: 3, away_score: 0,
    finished: true, is_bonus: true },
];
const deuxOptions: LeagueBonusOption[] = [
  { matchday_id: J2, match_id: "bonus-1", is_active: true, created_at: "2026-08-20T10:00:00Z" },
  { matchday_id: J2, match_id: AUTRE, is_active: false, created_at: "2026-08-10T10:00:00Z" },
];
const pronosDeuxBonus: LeaguePrediction[] = [
  { user_id: JOUEUR, match_id: "bonus-1", home_prediction: 0, away_prediction: 2, created_at: "2026-08-24T11:00:00Z" },
  { user_id: JOUEUR, match_id: AUTRE, home_prediction: 0, away_prediction: 1, created_at: "2026-08-24T12:00:00Z" },
];
const avecDeux = computeLeagueStats([], matchsDeuxBonus, deuxOptions, pronosDeuxBonus, profils, {});
const sansDeux = computeLeagueStats(
  [], matchsDeuxBonus,
  deuxOptions.map((o) => ({ matchday_id: o.matchday_id, match_id: o.match_id })),
  pronosDeuxBonus, profils, {},
);
egal(
  "deux matchs bonus distincts sur une journee : meme total avec ou sans les colonnes",
  sansDeux.pointsByUser[JOUEUR],
  avecDeux.pointsByUser[JOUEUR],
);
verifier(
  "c'est le pronostic le plus recent qui fait office de bonus, actif ou non",
  avecDeux.pointsByUser[JOUEUR] === 0,
  `obtenu ${avecDeux.pointsByUser[JOUEUR]} pt(s) — le pronostic retenu devrait etre le plus recent, celui qui rapporte 0`,
);

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
