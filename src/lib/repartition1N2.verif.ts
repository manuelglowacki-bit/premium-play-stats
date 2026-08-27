/**
 * Verification de la repartition 1/N/2 des matchs.
 *   npm run verif-1n2
 */
import {
  repartition1N2,
  repartitionVide,
  issueDuScore,
  type PredictionMatch,
} from "./repartition1N2";

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
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  verifier(titre, a === b, `obtenu ${a}, attendu ${b}`);
}

function p(user: string, match: string, h: number, a: number, createdAt?: string): PredictionMatch {
  return {
    user_id: user,
    match_id: match,
    home_prediction: h,
    away_prediction: a,
    created_at: createdAt ?? null,
  };
}

console.log("\n=== 1. Lecture de l'issue ===\n");

egal("Domicile gagne -> 1", issueDuScore(1, 0), "1");
egal("Exterieur gagne -> 2", issueDuScore(0, 1), "2");
egal("Match nul -> N", issueDuScore(0, 0), "N");
egal("Un 3-2 reste une victoire a domicile", issueDuScore(3, 2), "1");
egal("Un 2-2 reste un nul", issueDuScore(2, 2), "N");

console.log("\n=== 2. Comptage par match ===\n");

{
  const r = repartition1N2([
    p("u1", "m1", 1, 0),
    p("u2", "m1", 1, 0),
    p("u3", "m1", 0, 0),
    p("u4", "m1", 0, 1),
    p("u5", "m2", 0, 1),
  ]);
  egal("Comptes du match 1", r.m1.comptes, { "1": 2, N: 1, "2": 1 });
  egal("Denominateur du match 1", r.m1.joueurs, 4);
  egal("Pourcentages du match 1", r.m1.pourcentages, { "1": 50, N: 25, "2": 25 });
  egal("Chaque match a son propre denominateur", r.m2.joueurs, 1);
  egal("Un match a un seul pronostic affiche 100 %", r.m2.pourcentages, { "1": 0, N: 0, "2": 100 });
}

{
  const r = repartition1N2([]);
  egal("Aucun pronostic : aucune entree", Object.keys(r).length, 0);
  egal("Repli explicite pour un match sans pronostic", repartitionVide(), {
    comptes: { "1": 0, N: 0, "2": 0 },
    pourcentages: { "1": 0, N: 0, "2": 0 },
    joueurs: 0,
  });
}

console.log("\n=== 3. Lignes a ignorer ===\n");

{
  const r = repartition1N2([
    p("u1", "m1", 1, 0),
    { user_id: null, match_id: "m1", home_prediction: 1, away_prediction: 0 },
    { user_id: "u2", match_id: null, home_prediction: 1, away_prediction: 0 },
    // Case laissee vide : un pronostic incomplet n'est pas un pronostic.
    { user_id: "u3", match_id: "m1", home_prediction: null, away_prediction: 0 },
    { user_id: "u4", match_id: "m1", home_prediction: 1, away_prediction: null },
  ]);
  egal("Identifiants ou scores absents : ignores", r.m1.comptes, { "1": 1, N: 0, "2": 0 });
  egal("...et absents du denominateur", r.m1.joueurs, 1);
}

console.log("\n=== 4. Un seul pronostic par joueur et par match ===\n");

{
  const r = repartition1N2([
    p("u1", "m1", 1, 0, "2026-08-20T10:00:00Z"),
    p("u1", "m1", 0, 1, "2026-08-21T10:00:00Z"),
  ]);
  egal("Changement d'avis : seul le plus recent compte", r.m1.comptes, { "1": 0, N: 0, "2": 1 });
  egal("Un indecis ne compte qu'une fois", r.m1.joueurs, 1);
}

{
  const r = repartition1N2([
    p("u1", "m1", 0, 1, "2026-08-21T10:00:00Z"),
    p("u1", "m1", 1, 0, "2026-08-20T10:00:00Z"),
  ]);
  egal("L'ordre des lignes recues ne change rien", r.m1.comptes, { "1": 0, N: 0, "2": 1 });
}

{
  // Le meme joueur sur DEUX matchs differents : ce n'est pas un doublon.
  const r = repartition1N2([p("u1", "m1", 1, 0), p("u1", "m2", 0, 1)]);
  egal("Le meme joueur compte sur chaque match", [r.m1.joueurs, r.m2.joueurs], [1, 1]);
}

console.log("\n=== 5. La somme vaut toujours 100 ===\n");

{
  let ok = true;
  let pire = "";
  for (let a = 0; a <= 20; a += 1)
    for (let b = 0; b <= 20; b += 1)
      for (let c = 0; c <= 20; c += 1) {
        if (a + b + c === 0) continue;
        const lignes: PredictionMatch[] = [];
        let i = 0;
        for (let k = 0; k < a; k += 1) lignes.push(p(`u${i++}`, "m", 1, 0));
        for (let k = 0; k < b; k += 1) lignes.push(p(`u${i++}`, "m", 0, 0));
        for (let k = 0; k < c; k += 1) lignes.push(p(`u${i++}`, "m", 0, 1));
        const r = repartition1N2(lignes).m;
        const somme = r.pourcentages["1"] + r.pourcentages.N + r.pourcentages["2"];
        if (somme !== 100) {
          ok = false;
          pire = `${a}/${b}/${c} -> ${somme}`;
        }
        if (r.joueurs !== a + b + c) {
          ok = false;
          pire = `${a}/${b}/${c} : denominateur ${r.joueurs}`;
        }
        if ((a === 0 && r.pourcentages["1"] !== 0) || (c === 0 && r.pourcentages["2"] !== 0)) {
          ok = false;
          pire = `${a}/${b}/${c} : une issue sans pronostic affiche un pourcentage`;
        }
      }
  verifier("9 260 repartitions possibles : somme = 100 et zero reste zero", ok, pire);
}

{
  // Le cas qui casse un arrondi naif : 1/1/1 donnerait 33+33+33 = 99.
  const r = repartition1N2([p("a", "m", 1, 0), p("b", "m", 0, 0), p("c", "m", 0, 1)]).m;
  const somme = r.pourcentages["1"] + r.pourcentages.N + r.pourcentages["2"];
  egal("Un joueur sur trois par issue : somme exacte, pas 99", somme, 100);
}

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
