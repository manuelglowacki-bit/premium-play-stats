/**
 * Verification du resume personnel.
 *   npm run verif-resume
 */
import {
  podiumDuJoueur,
  resumeDuJoueur,
  titrePodium,
  titreResume,
  type ParcoursJoueur,
} from "./resumePerso";

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


console.log("\nLE PODIUM — l'accueil des trois premiers");
{
  const fcs = podiumDuJoueur("fcs", ligue, 4)!;
  egal("le leader est sur le podium", fcs.rang, 1);
  egal("il y est depuis quatre journees", fcs.depuis, 4);
  egal("personne devant lui", fcs.devant, null);
  egal("Lulu le suit a trois points", fcs.derriere, { nom: "Lulu", ecart: 3 });
  verifier("ce n'est pas une prise de pouvoir recente", fcs.nouveau === false);
  egal("le titre du leader installe", titrePodium(fcs), "Tu es le patron");

  const lulu = podiumDuJoueur("lulu", ligue, 4)!;
  egal("Lulu est 2e", lulu.rang, 2);
  egal("elle vient d'y arriver", lulu.depuis, 1);
  verifier("c'est nouveau pour elle", lulu.nouveau);
  egal("FCS est devant, a trois points", lulu.devant, { nom: "FCS", ecart: 3 });
  egal("Sanji est derriere, a trois points", lulu.derriere, { nom: "Sanji", ecart: 3 });
  egal("le titre le dit", titrePodium(lulu), "Tu montes sur le podium");
  // Elle etait 4e la veille : sa serie sur le podium commence maintenant.
  egal("un seul passage sur le podium", lulu.surLePodiumDepuis, 1);

  const sanji = podiumDuJoueur("sanji", ligue, 4)!;
  egal("Sanji est 3e", sanji.rang, 3);
  egal("mais sur le podium depuis le debut", sanji.surLePodiumDepuis, 4);
  verifier("sa place a change, donc « depuis » repart a un", sanji.depuis === 1);

  egal("le quatrieme n'a pas d'accueil special", podiumDuJoueur("max", ligue, 4), null);
  egal("un joueur inconnu non plus", podiumDuJoueur("personne", ligue, 4), null);
  egal("une journee sans classement non plus", podiumDuJoueur("fcs", ligue, 9), null);
}

{
  // A la toute premiere journee, personne ne « prend » la tete : il n'y a
  // pas d'avant. Dire « tu prends la tete » serait faux.
  const j1 = podiumDuJoueur("fcs", ligue, 1)!;
  verifier("premiere journee : ce n'est pas une prise de pouvoir", j1.nouveau === false);
  egal("le titre reste sobre", titrePodium(j1), "Tu es le patron");
}

{
  // Une journee absente du parcours ne casse pas la serie : c'est la suite
  // des classements qui compte, pas le calendrier.
  const troue: ParcoursJoueur[] = [
    { id: "a", nom: "A", etapes: [
      { numero: 1, rang: 1, points: 10, gainJournee: 10 },
      { numero: 4, rang: 1, points: 20, gainJournee: 10 },
    ] },
    { id: "b", nom: "B", etapes: [
      { numero: 1, rang: 2, points: 8, gainJournee: 8 },
      { numero: 4, rang: 2, points: 15, gainJournee: 7 },
    ] },
  ];
  const r = podiumDuJoueur("a", troue, 4)!;
  egal("la serie compte les journees classees", r.depuis, 2);
  egal("l'ecart avec le second", r.derriere, { nom: "B", ecart: 5 });
}

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
