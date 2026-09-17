/**
 * Verification du resume personnel.
 *   npm run verif-resume
 */
import { resumeDuJoueur, titreResume, type ParcoursJoueur } from "./resumePerso";

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
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
}

console.log("\nLE RESUME PERSONNEL D'UN JOUEUR");
console.log("=".repeat(64));

// J3 -> J4 : Lulu passe 4e -> 2e, elle double Max et Sanji ; Nour tombe.
const p = (id: string, nom: string, rangs: number[], cumuls: number[], gains: number[]): ParcoursJoueur => ({
  id, nom,
  etapes: rangs.map((r, i) => ({ numero: i + 1, rang: r, points: cumuls[i], gainJournee: gains[i] })),
});

const ligue: ParcoursJoueur[] = [
  p("fcs",   "FCS",   [1, 1, 1, 1], [9, 18, 27, 34], [9, 9, 9, 7]),
  p("lulu",  "Lulu",  [5, 4, 4, 2], [5, 12, 20, 31], [5, 7, 8, 11]),
  p("sanji", "Sanji", [2, 2, 2, 3], [8, 16, 24, 28], [8, 8, 8, 4]),
  p("max",   "Max",   [3, 3, 3, 4], [7, 14, 22, 27], [7, 7, 8, 5]),
  p("nour",  "Nour",  [4, 5, 5, 5], [6, 10, 16, 20], [6, 4, 6, 4]),
];

console.log("\nCelle qui monte");
const lulu = resumeDuJoueur("lulu", ligue, 4)!;
egal("ses points de la journee", lulu.gain, 11);
egal("son rang", lulu.rang, 2);
egal("son rang la veille", lulu.rangVeille, 4);
egal("deux places gagnees", lulu.mouvement, 2);
egal("elle a double Sanji et Max", lulu.doubles.sort(), ["Max", "Sanji"]);
egal("personne ne l'a doublee", lulu.doublePar, []);
egal("son retard sur la tete", lulu.retard, 3);
egal("le nombre de participants", lulu.participants, 5);
verifier("c'est la meilleure journee du groupe", lulu.meilleureJournee);
egal("le titre le dit", titreResume(lulu), "La meilleure journée du groupe");

console.log("\nCeux qui se font doubler");
const sanji = resumeDuJoueur("sanji", ligue, 4)!;
egal("une place perdue", sanji.mouvement, -1);
egal("il s'est fait doubler par Lulu", sanji.doublePar, ["Lulu"]);
egal("il n'a double personne", sanji.doubles, []);
egal("le titre reste mesure", titreResume(sanji), "Tu recules un peu");

console.log("\nLe leader");
const fcs = resumeDuJoueur("fcs", ligue, 4)!;
egal("aucun retard", fcs.retard, 0);
egal("aucun mouvement", fcs.mouvement, 0);
egal("le titre le dit", titreResume(fcs), "Tu es en tête");

console.log("\nLa premiere journee : il n'y a pas de veille");
const j1 = resumeDuJoueur("lulu", ligue, 1)!;
egal("aucun rang de veille", j1.rangVeille, null);
egal("aucun mouvement calcule", j1.mouvement, 0);
egal("personne double", j1.doubles, []);
egal("personne ne l'a doublee", j1.doublePar, []);

console.log("\nLes titres selon ce qui s'est passe");
const faux = (rangs: number[], gains: number[]) =>
  titreResume(resumeDuJoueur("x", [
    p("x", "X", rangs, gains.map((_, i) => gains.slice(0, i + 1).reduce((a, b) => a + b, 0)), gains),
    p("y", "Y", rangs.map(() => 1), gains.map(() => 99), gains.map(() => 20)),
  ], rangs.length)!);
egal("une grosse remontee", faux([9, 8, 7, 2], [2, 2, 2, 6]), "Belle remontée");
egal("une petite montee", faux([4, 4, 4, 3], [2, 2, 2, 3]), "Tu grimpes");
egal("une grosse chute", faux([2, 2, 2, 8], [2, 2, 2, 1]), "Journée compliquée");
egal("aucun point marque", faux([5, 5, 5, 5], [2, 2, 2, 0]), "Journée blanche");
egal("il tient sa place", faux([5, 5, 5, 5], [2, 2, 2, 3]), "Tu tiens ta place");

console.log("\nCas limites");
egal("un joueur inconnu : aucun resume", resumeDuJoueur("personne", ligue, 4), null);
egal("une journee sans parcours : aucun resume", resumeDuJoueur("lulu", ligue, 9), null);
egal("aucun joueur : aucun resume", resumeDuJoueur("lulu", [], 4), null);
{
  // Une journee absente du parcours (report) : la « veille » doit etre la
  // derniere journee REELLEMENT classee, pas `journee - 1`.
  const trou: ParcoursJoueur[] = [
    { id: "a", nom: "A", etapes: [
      { numero: 1, rang: 3, points: 5, gainJournee: 5 },
      { numero: 4, rang: 1, points: 20, gainJournee: 15 },
    ] },
  ];
  const r = resumeDuJoueur("a", trou, 4)!;
  egal("la veille est la derniere journee classee", r.rangVeille, 3);
  egal("le mouvement est calcule dessus", r.mouvement, 2);
}

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
