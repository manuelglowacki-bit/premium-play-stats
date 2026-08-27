/**
 * Verification de la repartition des choix bonus.
 *   npm run verif-repartition
 */
import { repartitionBonus, repartirCent, type PredictionBonus } from "./repartitionBonus";

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

const CANDIDATS = ["pl", "pd", "sa", "bl1"];

function p(user: string, match: string, createdAt?: string): PredictionBonus {
  return { user_id: user, match_id: match, created_at: createdAt ?? null };
}

console.log("\n=== 1. Comptage des choix ===\n");

{
  const r = repartitionBonus(
    [p("u1", "pl"), p("u2", "pl"), p("u3", "pd"), p("u4", "sa")],
    CANDIDATS,
  );
  egal("Comptes par championnat", r.comptes, { pl: 2, pd: 1, sa: 1, bl1: 0 });
  egal("Denominateur = joueurs ayant choisi", r.joueursAyantChoisi, 4);
}

{
  const r = repartitionBonus([], CANDIDATS);
  egal("Aucun choix : toutes les cles restent presentes a 0", r.comptes, {
    pl: 0,
    pd: 0,
    sa: 0,
    bl1: 0,
  });
  egal("Aucun choix : denominateur nul", r.joueursAyantChoisi, 0);
}

{
  // LE BUG D'ORIGINE : le denominateur etait le nombre total d'inscrits.
  // Ici 4 joueurs sur 23 ont choisi. L'ancien calcul affichait 8 % pour un
  // championnat pris par 2 joueurs sur les 4 ayant joue.
  const r = repartitionBonus(
    [p("u1", "pl"), p("u2", "pl"), p("u3", "pd"), p("u4", "sa")],
    CANDIDATS,
  );
  const pct = repartirCent(r.comptes);
  verifier(
    "Un championnat pris par 2 des 4 joueurs ayant choisi affiche 50 %, pas 8 %",
    pct.pl === 50,
    `obtenu ${pct.pl} %`,
  );
}

console.log("\n=== 2. Un seul choix par joueur, le plus recent ===\n");

{
  // Le joueur a d'abord pris la Premier League, puis a change pour la Liga.
  const r = repartitionBonus(
    [p("u1", "pl", "2026-08-20T10:00:00Z"), p("u1", "pd", "2026-08-21T10:00:00Z")],
    CANDIDATS,
  );
  egal("Changement d'avis : seul le dernier choix compte", r.comptes, {
    pl: 0,
    pd: 1,
    sa: 0,
    bl1: 0,
  });
  egal("Un indecis ne compte qu'une fois au denominateur", r.joueursAyantChoisi, 1);
}

{
  const r = repartitionBonus(
    [p("u1", "pd", "2026-08-21T10:00:00Z"), p("u1", "pl", "2026-08-20T10:00:00Z")],
    CANDIDATS,
  );
  egal("L'ordre des lignes recues ne change rien", r.comptes, { pl: 0, pd: 1, sa: 0, bl1: 0 });
}

{
  const r = repartitionBonus([p("u1", "pl"), p("u1", "pd")], CANDIDATS);
  egal("Sans date, la derniere ligne rencontree l'emporte (regle du classement)", r.comptes, {
    pl: 0,
    pd: 1,
    sa: 0,
    bl1: 0,
  });
}

console.log("\n=== 3. Lignes a ignorer ===\n");

{
  const r = repartitionBonus(
    [
      p("u1", "pl"),
      { user_id: null, match_id: "pl" },
      { user_id: "u9", match_id: null },
      p("u2", "un-match-de-ligue-1"),
    ],
    CANDIDATS,
  );
  egal("user_id/match_id absents et matchs hors candidats : ignores", r.comptes, {
    pl: 1,
    pd: 0,
    sa: 0,
    bl1: 0,
  });
  egal("...et absents du denominateur", r.joueursAyantChoisi, 1);
}

console.log("\n=== 4. Arrondis : la somme vaut toujours 100 ===\n");

{
  const pct = repartirCent({ pl: 1, pd: 1, sa: 1, bl1: 0 });
  const somme = Object.values(pct).reduce((s, v) => s + v, 0);
  egal("1/1/1/0 : somme exacte", somme, 100);
  verifier("1/1/1/0 : le championnat sans choix reste a 0 %", pct.bl1 === 0, `obtenu ${pct.bl1}`);
}

{
  const pct = repartirCent({ pl: 7, pd: 7, sa: 7, bl1: 2 });
  const somme = Object.values(pct).reduce((s, v) => s + v, 0);
  egal("7/7/7/2 : somme exacte", somme, 100);
}

{
  let pire = "";
  let ok = true;
  for (let a = 0; a <= 12; a += 1)
    for (let b = 0; b <= 12; b += 1)
      for (let c = 0; c <= 12; c += 1)
        for (let d = 0; d <= 12; d += 1) {
          if (a + b + c + d === 0) continue;
          const pct = repartirCent({ pl: a, pd: b, sa: c, bl1: d });
          const somme = Object.values(pct).reduce((s, v) => s + v, 0);
          if (somme !== 100) {
            ok = false;
            pire = `${a}/${b}/${c}/${d} -> ${somme}`;
          }
          if ((a === 0 && pct.pl !== 0) || (d === 0 && pct.bl1 !== 0)) {
            ok = false;
            pire = `${a}/${b}/${c}/${d} : un championnat sans choix affiche un pourcentage`;
          }
        }
  verifier("28 560 repartitions possibles : somme = 100 et zero reste zero", ok, pire);
}

{
  const pct = repartirCent({ pl: 0, pd: 0, sa: 0, bl1: 0 });
  egal("Personne n'a choisi : tout a 0 (pas de division par zero)", pct, {
    pl: 0,
    pd: 0,
    sa: 0,
    bl1: 0,
  });
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
