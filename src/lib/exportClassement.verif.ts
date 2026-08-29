/**
 * Verification de l'export du classement.
 *   npm run verif-export
 *
 * Ce qui est verifie n'est pas « le fichier se telecharge » mais « le fichier
 * dit la verite » : un pseudo contenant un point-virgule ne doit pas decaler
 * les colonnes et faire lire a quelqu'un un classement faux.
 */
import {
  BOM,
  SEPARATEUR,
  echapper,
  nomFichier,
  versCSV,
  type LigneClassement,
} from "./exportClassement";

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

function ligne(partiel: Partial<LigneClassement>): LigneClassement {
  return {
    rang: 1,
    pseudo: "Red Evils",
    points: 120,
    scoresExacts: 4,
    pronosticsJoues: 40,
    pronosticsAttendus: 50,
    equipeCoeur: "RC Lens",
    ...partiel,
  };
}

console.log("\n=== 1. Le fichier de base ===\n");

{
  const csv = versCSV([ligne({})]);
  verifier(
    "Commence par la marque d'ordre des octets (accents lisibles dans Excel)",
    csv.startsWith(BOM),
  );
  const lignes = csv.slice(BOM.length).split("\r\n");
  egal(
    "Entete",
    lignes[0],
    "Rang;Joueur;Points;Scores exacts;Pronostics joués;Pronostics possibles;Participation;Équipe de cœur",
  );
  egal("Ligne de donnees", lignes[1], "1;Red Evils;120;4;40;50;80%;RC Lens");
  verifier("Se termine par un retour a la ligne", csv.endsWith("\r\n"));
}

console.log("\n=== 2. Ce qui casserait le fichier ===\n");

{
  // LE cas qui compte : le separateur francais dans un pseudo.
  const csv = versCSV([ligne({ pseudo: "Jo; le boss" })]);
  const l = csv.slice(BOM.length).split("\r\n")[1];
  egal("Un point-virgule dans un pseudo est protege", l, '1;"Jo; le boss";120;4;40;50;80%;RC Lens');
  verifier(
    "...et la ligne garde ses 8 colonnes",
    (l.match(/;/g) ?? []).length === 8, // 7 separateurs + 1 dans le pseudo protege
    l,
  );
}

egal("Guillemet double", echapper('Le "Boss"'), '"Le ""Boss"""');
egal("Retour a la ligne colle depuis un telephone", echapper("Jo\nB"), '"Jo\nB"');
egal("Texte ordinaire : laisse tel quel", echapper("Mel11"), "Mel11");
egal("Valeur nulle : case vide", echapper(null), "");
egal("Valeur absente : case vide", echapper(undefined), "");
egal("Nombre", echapper(12), "12");

console.log("\n=== 3. Valeurs manquantes ===\n");

{
  const csv = versCSV([ligne({ pseudo: null, equipeCoeur: null })]);
  const l = csv.slice(BOM.length).split("\r\n")[1];
  egal(
    "Pseudo absent : « Sans pseudo », jamais une case vide",
    l,
    "1;Sans pseudo;120;4;40;50;80%;",
  );
}

{
  const csv = versCSV([ligne({ pseudo: "   " })]);
  verifier("Pseudo fait d'espaces : traite comme absent", csv.includes(";Sans pseudo;"));
}

{
  const csv = versCSV([ligne({ pronosticsJoues: 0, pronosticsAttendus: 0 })]);
  const l = csv.slice(BOM.length).split("\r\n")[1];
  egal(
    "Aucun prono attendu : pas de division par zero, case vide",
    l,
    "1;Red Evils;120;4;0;0;;RC Lens",
  );
}

console.log("\n=== 4. Un classement complet ===\n");

{
  const classement = [
    ligne({ rang: 1, pseudo: "Samuel", points: 150 }),
    ligne({ rang: 2, pseudo: "Eric", points: 150 }),
    ligne({ rang: 3, pseudo: "Red Evils", points: 112 }),
  ];
  const lignes = versCSV(classement).slice(BOM.length).trimEnd().split("\r\n");
  egal("Une ligne d'entete plus une par joueur", lignes.length, 4);
  verifier(
    "L'ordre du classement est conserve",
    lignes[1].startsWith("1;Samuel") && lignes[3].startsWith("3;Red Evils"),
  );
}

egal(
  "Classement vide : l'entete seule, pas un fichier vide",
  versCSV([]),
  BOM +
    "Rang;Joueur;Points;Scores exacts;Pronostics joués;Pronostics possibles;Participation;Équipe de cœur\r\n",
);

console.log("\n=== 5. Nom du fichier ===\n");

const LE_28 = new Date(2026, 7, 28);
egal("Avec la saison", nomFichier("2026-2027", LE_28), "classement-2026-2027-2026-08-28.csv");
egal(
  "Accents et espaces nettoyes",
  nomFichier("Saison Été 2026", LE_28),
  "classement-saison-ete-2026-2026-08-28.csv",
);
egal("Sans saison", nomFichier(null, LE_28), "classement-2026-08-28.csv");
egal("Saison vide", nomFichier("   ", LE_28), "classement-2026-08-28.csv");
egal(
  "Mois et jour sur deux chiffres",
  nomFichier(null, new Date(2027, 0, 5)),
  "classement-2027-01-05.csv",
);

verifier("Le separateur est bien le point-virgule (Excel francais)", SEPARATEUR === ";");

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
