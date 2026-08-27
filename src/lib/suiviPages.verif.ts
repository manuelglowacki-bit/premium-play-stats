/**
 * Verification du suivi des pages.
 *   npm run verif-audience
 */
import { FENETRE_ANTI_DOUBLON, doitCompter, normaliserChemin } from "./suiviPages";

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

console.log("\n=== 1. Normalisation, identique a celle de la base ===\n");

egal("Chemin simple", normaliserChemin("/pronostics"), "/pronostics");
egal("Accueil", normaliserChemin("/"), "/");
egal("Majuscules", normaliserChemin("/Classement"), "/classement");
egal("Barre finale", normaliserChemin("/classement/"), "/classement");
egal("Parametre retire", normaliserChemin("/pronostics?journee=3"), "/pronostics");
egal("Ancre retiree", normaliserChemin("/classement#haut"), "/classement");
egal("Espaces autour", normaliserChemin("  /stats  "), "/stats");

console.log("\n  -- refuse (rien ne part vers la base) --\n");

egal("Valeur nulle", normaliserChemin(null), null);
egal("Valeur non textuelle", normaliserChemin(42), null);
egal("Chaine vide", normaliserChemin(""), null);
egal("Rien qu'un parametre", normaliserChemin("?x=1"), null);
egal("Texte libre", normaliserChemin("Red Evils a triche"), null);
egal("Balise", normaliserChemin("/profil/<script>alert(1)</script>"), null);
egal("Adresse complete", normaliserChemin("https://exemple.fr/espion"), null);
egal("Chemin demesure", normaliserChemin("/" + "a".repeat(60)), null);
egal("Accents (jamais dans nos routes)", normaliserChemin("/trophées"), null);

console.log("\n=== 2. Anti-doublon ===\n");

const T = 1_000_000_000;

verifier("Premiere visite : comptee", doitCompter("/classement", T, {}));
verifier(
  "Retour sur la meme page 5 minutes apres : pas comptee",
  !doitCompter("/classement", T + 5 * 60_000, { "/classement": T }),
);
verifier(
  "Retour 30 minutes apres : comptee",
  doitCompter("/classement", T + FENETRE_ANTI_DOUBLON, { "/classement": T }),
);
verifier(
  "Une AUTRE page dans la meme minute : comptee",
  doitCompter("/pronostics", T + 30_000, { "/classement": T }),
);
verifier(
  "Aller-retour Classement -> Pronos -> Classement : le retour ne recompte pas",
  !doitCompter("/classement", T + 90_000, { "/classement": T, "/pronostics": T + 60_000 }),
);
verifier(
  "Horloge du telephone remise a l'heure (date future enregistree) : on compte",
  doitCompter("/classement", T, { "/classement": T + 10 * 60_000 }),
);
verifier(
  "Valeur abimee dans le stockage : on compte plutot que de bloquer",
  doitCompter("/classement", T, { "/classement": NaN as number }),
);

console.log("\n=== 3. Le scenario d'une soiree ===\n");

{
  // Un joueur ouvre l'appli, fait ses pronos, va voir le classement, revient
  // corriger un prono, puis va au vestiaire. En 20 minutes.
  const vues: Record<string, number> = {};
  const parcours: [string, number][] = [
    ["/", 0],
    ["/pronostics", 60_000],
    ["/classement", 300_000],
    ["/pronostics", 600_000],
    ["/classement", 900_000],
    ["/trophees", 1_200_000],
  ];

  let comptees = 0;
  for (const [chemin, decalage] of parcours) {
    const page = normaliserChemin(chemin)!;
    if (doitCompter(page, T + decalage, vues)) {
      vues[page] = T + decalage;
      comptees += 1;
    }
  }

  verifier(
    "6 changements de page, 4 visites comptees (les deux retours sont ignores)",
    comptees === 4,
    `${comptees} comptees`,
  );
  egal("Les quatre pages du parcours", Object.keys(vues).sort(), [
    "/",
    "/classement",
    "/pronostics",
    "/trophees",
  ]);
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
