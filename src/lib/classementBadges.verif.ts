/**
 * VÉRIFICATION DES BADGES DU CLASSEMENT
 * Lancer avec :  npm run verif-badges
 */
import { calculerBadges } from "./classementBadges";

let reussis = 0;
const echecs: string[] = [];

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    reussis += 1;
    console.log(`  ok    ${intitule}`);
  } else {
    echecs.push(intitule);
    console.log(`  ECHEC ${intitule}\n          attendu : ${b}\n          obtenu  : ${a}`);
  }
}

const joueurs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const J = ["j1", "j2", "j3"];

/** Les identifiants des badges d'un joueur, triés pour une comparaison stable. */
const idsDe = (r: Record<string, { id: string }[]>, joueur: string) =>
  (r[joueur] ?? []).map((b) => b.id).sort();

console.log("\nBADGES DU CLASSEMENT\n");

{
  const r = calculerBadges({
    joueurs,
    journeesOrdonnees: J,
    pointsParJourneeParJoueur: {
      a: { j1: 8, j2: 3, j3: 3 },   // 14 — toujours en tete
      b: { j1: 7, j2: 4, j3: 2 },   // 13
      c: { j1: 6, j2: 2, j3: 4 },   // 12
      d: { j1: 1, j2: 1, j3: 1 },   // 3  — jamais dans le top 3
    },
    bonsResultatsParJoueur: { a: 20, b: 25, c: 10, d: 5 },
    scoresExactsParJoueur: { a: 1, b: 0, c: 4, d: 0 },
  });

  verifier("le meilleur au 1N2 revient a celui qui a le plus de bons resultats",
    idsDe(r, "b").includes("sniper"), true);
  verifier("...et a lui seul", idsDe(r, "a").includes("sniper"), false);
  verifier("le roi du score exact", idsDe(r, "c").includes("score_exact"), true);
  verifier("la meilleure journee (8 points)", idsDe(r, "a").includes("record_journee"), true);
  verifier("l'indeboulonnable, toujours dans le top 3", idsDe(r, "a").includes("indeboulonnable"), true);
  verifier("...pas celui qui n'y est jamais entre", idsDe(r, "d").includes("indeboulonnable"), false);
  verifier("serie en cours pour qui marque a chaque journee", idsDe(r, "d").includes("serie"), true);
}

{
  // Ex aequo : le badge est partage, jamais tranche au hasard.
  const r = calculerBadges({
    joueurs: [{ id: "a" }, { id: "b" }],
    journeesOrdonnees: ["j1"],
    pointsParJourneeParJoueur: { a: { j1: 5 }, b: { j1: 5 } },
    bonsResultatsParJoueur: { a: 7, b: 7 },
    scoresExactsParJoueur: { a: 0, b: 0 },
  });
  verifier("ex aequo : les deux ont le badge", [idsDe(r, "a").includes("sniper"), idsDe(r, "b").includes("sniper")], [true, true]);
  verifier("aucun score exact : personne n'a le badge", [...idsDe(r, "a"), ...idsDe(r, "b")].includes("score_exact"), false);
}

{
  // Une seule journee : « indeboulonnable » n'aurait aucun sens, il repeterait
  // le classement du moment.
  const r = calculerBadges({
    joueurs,
    journeesOrdonnees: ["j1"],
    pointsParJourneeParJoueur: { a: { j1: 8 }, b: { j1: 3 }, c: { j1: 2 }, d: { j1: 1 } },
    bonsResultatsParJoueur: { a: 5, b: 3, c: 2, d: 1 },
    scoresExactsParJoueur: {},
  });
  verifier("une seule journee : pas d'indeboulonnable", idsDe(r, "a").includes("indeboulonnable"), false);
  verifier("une seule journee : pas de serie", idsDe(r, "a").includes("serie"), false);
}

{
  // Saison vierge : aucun badge, plutot que des badges vides distribues a tous.
  const r = calculerBadges({
    joueurs,
    journeesOrdonnees: [],
    pointsParJourneeParJoueur: {},
    bonsResultatsParJoueur: {},
    scoresExactsParJoueur: {},
  });
  verifier("aucun match joue : aucun badge", Object.keys(r).length, 0);
}

{
  // La serie s'interrompt des qu'une journee est blanche.
  const r = calculerBadges({
    joueurs: [{ id: "a" }],
    journeesOrdonnees: J,
    pointsParJourneeParJoueur: { a: { j1: 3, j2: 0, j3: 2 } },
    bonsResultatsParJoueur: { a: 4 },
    scoresExactsParJoueur: {},
  });
  verifier("une journee blanche coupe la serie", idsDe(r, "a").includes("serie"), false);
}

const total = reussis + echecs.length;
console.log(`\n${"=".repeat(60)}`);
console.log(echecs.length === 0
  ? `${reussis}/${total} verifications passees.`
  : `${reussis}/${total} passees — ${echecs.length} ECHEC(S).`);
console.log(`${"=".repeat(60)}\n`);
process.exit(echecs.length === 0 ? 0 : 1);
