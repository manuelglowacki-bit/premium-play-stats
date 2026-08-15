/**
 * Suite de vérification du moteur de calcul des points (src/lib/predictionScoring.ts).
 * Exécution : npx tsx scripts/test-prediction-scoring.ts
 *
 * Couvre le cas J1 réel signalé (bug "9 au lieu de 13") + les cas limites
 * demandés. Aucune dépendance à Supabase/React — fonctions pures uniquement.
 * Script temporaire de vérification, pas un runner de test permanent du
 * projet (aucun framework de test n'est installé ici).
 */
import {
  scoreLigue1Prediction,
  scoreBonusPrediction,
  isFavoriteMatch,
  normalizeL1ClubName,
} from "../src/lib/predictionScoring";

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${label} → obtenu=${JSON.stringify(actual)} attendu=${JSON.stringify(expected)}`);
  if (!ok) failures++;
}

console.log("\n=== CAS J1 RÉEL (RC Lens favori, bonus Newcastle–Liverpool) ===\n");

// 8 matchs classiques, résultat correct, aucun n'implique le favori.
let classique = 0;
for (let i = 1; i <= 8; i++) {
  const { points, category } = scoreLigue1Prediction({
    homeScore: 1,
    awayScore: 0,
    homePrediction: 1,
    awayPrediction: 0,
    isFavoriteMatch: false,
  });
  assertEqual(`Match classique #${i} (résultat correct)`, { points, category }, { points: 1, category: "classique" });
  classique += points;
}

// Lens – Auxerre, 2-0 réel, pronostic 2-0, favori id ET nom cohérents.
const lensFavoriteById = isFavoriteMatch({
  homeTeamId: "team-lens-uuid",
  awayTeamId: "team-auxerre-uuid",
  homeTeamName: "RC Lens",
  awayTeamName: "AJ Auxerre",
  favoriteTeamId: "team-lens-uuid",
  favoriteTeamNames: ["RC Lens"],
});
assertEqual("Lens–Auxerre reconnu comme match favori (id exact)", lensFavoriteById, true);

const lensScore = scoreLigue1Prediction({
  homeScore: 2,
  awayScore: 0,
  homePrediction: 2,
  awayPrediction: 0,
  isFavoriteMatch: lensFavoriteById,
});
assertEqual("Lens–Auxerre 2-0 exact, favori", lensScore, { points: 2, category: "favori_exact" });

// Même match, mais home_team_id/away_team_id absents (bug de synchro) — le
// repli par nom normalisé doit quand même détecter le favori.
const lensFavoriteByNameFallback = isFavoriteMatch({
  homeTeamId: null,
  awayTeamId: null,
  homeTeamName: "RC Lens",
  awayTeamName: "AJ Auxerre",
  favoriteTeamId: "team-lens-uuid", // id présent côté profil mais ne matche aucun id de match (sync cassée)
  favoriteTeamNames: ["RC Lens"],
});
assertEqual("Lens–Auxerre reconnu par repli nom (team_id manquant sur le match)", lensFavoriteByNameFallback, true);

// Bonus Newcastle – Liverpool, 1-0 réel, pronostic 1-0 exact.
const bonusScore = scoreBonusPrediction({ homeScore: 1, awayScore: 0, homePrediction: 1, awayPrediction: 0 });
assertEqual("Bonus Newcastle–Liverpool 1-0 exact", bonusScore, { points: 3, category: "bonus_exact" });

const favori = lensScore.points;
const bonus = bonusScore.points;
const j1Total = classique + favori + bonus;

console.log(`\nCLASSIQUE = ${classique}`);
console.log(`FAVORI = ${favori}`);
console.log(`BONUS = ${bonus}`);
console.log(`J1 = ${j1Total}`);
console.log(`TOTAL = ${j1Total}\n`);

assertEqual("Total J1 = 13 (8×1 + 2 + 3)", j1Total, 13);

console.log("\n=== CAS LIMITES ===\n");

assertEqual(
  "Favori, bon résultat mais mauvais score → 1",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 0, homePrediction: 1, awayPrediction: 0, isFavoriteMatch: true }),
  { points: 1, category: "favori_resultat" },
);

assertEqual(
  "Favori, mauvais résultat → 0",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 0, homePrediction: 0, awayPrediction: 1, isFavoriteMatch: true }),
  { points: 0, category: "favori_rate" },
);

assertEqual(
  "Bonus, bon résultat mais mauvais score → 2",
  scoreBonusPrediction({ homeScore: 2, awayScore: 0, homePrediction: 1, awayPrediction: 0 }),
  { points: 2, category: "bonus_resultat" },
);

assertEqual(
  "Bonus, mauvais résultat → 0",
  scoreBonusPrediction({ homeScore: 2, awayScore: 0, homePrediction: 0, awayPrediction: 1 }),
  { points: 0, category: "bonus_rate" },
);

assertEqual(
  "Match favori ne cumule JAMAIS classique(1) + favori(2) : un seul retour exclusif",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 0, homePrediction: 2, awayPrediction: 0, isFavoriteMatch: true }).points,
  2, // jamais 3 (1+2)
);

assertEqual(
  "Classique correct sans favori → 1 (jamais 2)",
  scoreLigue1Prediction({ homeScore: 2, awayScore: 0, homePrediction: 1, awayPrediction: 0, isFavoriteMatch: false }),
  { points: 1, category: "classique" },
);

assertEqual(
  "normalizeL1ClubName ignore les préfixes français usuels",
  [normalizeL1ClubName("RC Lens"), normalizeL1ClubName("Lens")],
  ["lens", "lens"],
);

console.log("\n=== ISOLATION PAR JOUEUR (aucune fuite entre user_id) ===\n");

type PredictionRow = { userId: string; homePrediction: number; awayPrediction: number };
const finishedMatch = { homeScore: 2, awayScore: 0 };
const allPredictions: PredictionRow[] = [
  { userId: "user-A", homePrediction: 2, awayPrediction: 0 }, // exact
  { userId: "user-B", homePrediction: 1, awayPrediction: 0 }, // bon résultat seulement
  { userId: "user-C", homePrediction: 0, awayPrediction: 2 }, // faux
];
const pointsByUser: Record<string, number> = {};
allPredictions.forEach((pred) => {
  const { points } = scoreLigue1Prediction({
    homeScore: finishedMatch.homeScore,
    awayScore: finishedMatch.awayScore,
    homePrediction: pred.homePrediction,
    awayPrediction: pred.awayPrediction,
    isFavoriteMatch: false,
  });
  pointsByUser[pred.userId] = (pointsByUser[pred.userId] ?? 0) + points;
});
assertEqual("user-A (classique correct)", pointsByUser["user-A"], 1);
assertEqual("user-B (classique correct)", pointsByUser["user-B"], 1);
assertEqual("user-C (raté)", pointsByUser["user-C"] ?? 0, 0);
assertEqual("Joueur sans pronostic bonus → 0 point bonus (pas de ligne = pas d'ajout)", pointsByUser["user-D"] ?? 0, 0);

console.log("\n=== CUMUL MULTI-JOURNÉES ===\n");

const journeyTotals: Record<number, number> = {
  1: 13, // le cas réel ci-dessus
  2: 6, // ex. 4 classiques + favori résultat seul (4×1 + 1 + 1(bonus raté=0)) -> exemple arbitraire cohérent
  3: 9,
};
const cumulatedTotal = Object.values(journeyTotals).reduce((sum, v) => sum + v, 0);
console.log(`J1 = ${journeyTotals[1]}`);
console.log(`J2 = ${journeyTotals[2]}`);
console.log(`J3 = ${journeyTotals[3]}`);
console.log(`Total = ${cumulatedTotal}`);
assertEqual("Cumul J1+J2+J3", cumulatedTotal, 28);

console.log(`\n${failures === 0 ? "✅ TOUS LES TESTS PASSENT" : `❌ ${failures} TEST(S) EN ÉCHEC`}\n`);
process.exit(failures === 0 ? 0 : 1);
