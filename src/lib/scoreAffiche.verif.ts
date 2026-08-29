/**
 * Verification du score affiche sous un match.
 *   npm run verif-score
 */
import { scoreApi, scoreTermine } from "./scoreAffiche";

let total = 0;
let echecs = 0;

function verifier(titre: string, condition: boolean, detail?: string) {
  total += 1;
  if (condition) console.log(`  ok    ${titre}`);
  else {
    echecs += 1;
    console.log(`  ECHEC ${titre}${detail ? `\n        ${detail}` : ""}`);
  }
}

function egal(titre: string, obtenu: unknown, attendu: unknown) {
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}`,
  );
}

console.log("\n=== 1. Lire le score de l'API, quel que soit le nom du champ ===\n");

egal(
  "scoreDomicile / scoreExterieur",
  [
    scoreApi({ scoreDomicile: 2, scoreExterieur: 1 }, "home"),
    scoreApi({ scoreDomicile: 2, scoreExterieur: 1 }, "away"),
  ],
  [2, 1],
);
egal(
  "scoreHome / scoreAway",
  [
    scoreApi({ scoreHome: 3, scoreAway: 0 }, "home"),
    scoreApi({ scoreHome: 3, scoreAway: 0 }, "away"),
  ],
  [3, 0],
);
egal(
  "homeScore / awayScore",
  [
    scoreApi({ homeScore: 1, awayScore: 4 }, "home"),
    scoreApi({ homeScore: 1, awayScore: 4 }, "away"),
  ],
  [1, 4],
);
egal(
  "home_score / away_score",
  [
    scoreApi({ home_score: 0, away_score: 0 }, "home"),
    scoreApi({ home_score: 0, away_score: 0 }, "away"),
  ],
  [0, 0],
);
egal(
  "Score en texte (l'API renvoie parfois des chaines)",
  scoreApi({ scoreDomicile: "2" }, "home"),
  2,
);
egal("Un 0 est une vraie valeur, pas une absence", scoreApi({ scoreDomicile: 0 }, "home"), 0);

console.log("\n  -- rien a lire --\n");

egal("Aucune reponse API", scoreApi(null, "home"), null);
egal("Reponse vide", scoreApi({}, "home"), null);
egal("Champ a null", scoreApi({ scoreDomicile: null }, "home"), null);
egal("Champ vide", scoreApi({ scoreDomicile: "" }, "home"), null);
egal("Valeur illisible", scoreApi({ scoreDomicile: "abc" }, "home"), null);
egal("Reponse non objet", scoreApi("2-1", "home"), null);

console.log("\n=== 2. Match termine : la base d'abord, l'API en secours ===\n");

egal(
  "Score en base : on le prend",
  scoreTermine({ home_score: 2, away_score: 1 }, { scoreDomicile: 9, scoreExterieur: 9 }),
  { home: 2, away: 1 },
);

egal(
  "LE CAS REEL — base vide, API renseignee : on affiche l'API",
  scoreTermine({ home_score: null, away_score: null }, { scoreDomicile: 0, scoreExterieur: 1 }),
  { home: 0, away: 1 },
);

egal(
  "Une correction manuelle de l'admin l'emporte sur l'API",
  scoreTermine({ home_score: 3, away_score: 0 }, { scoreDomicile: 2, scoreExterieur: 0 }),
  { home: 3, away: 0 },
);

egal(
  "Un 0 — 0 enregistre en base n'est pas confondu avec une absence",
  scoreTermine({ home_score: 0, away_score: 0 }, { scoreDomicile: 5, scoreExterieur: 5 }),
  { home: 0, away: 0 },
);

egal(
  "Base a moitie remplie : l'API complete l'autre cote",
  scoreTermine({ home_score: 2, away_score: null }, { scoreDomicile: 9, scoreExterieur: 1 }),
  { home: 2, away: 1 },
);

console.log("\n=== 3. Quand personne ne sait ===\n");

egal(
  "Ni base ni API : null, et surtout pas 0 — 0",
  scoreTermine({ home_score: null, away_score: null }, null),
  null,
);
egal("Base vide, API sans score", scoreTermine({}, {}), null);
egal(
  "Base vide, API a moitie renseignee : on n'invente pas la moitie manquante",
  scoreTermine({}, { scoreDomicile: 2 }),
  null,
);
egal(
  "Valeur illisible des deux cotes",
  scoreTermine({ home_score: NaN, away_score: NaN }, null),
  null,
);

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
