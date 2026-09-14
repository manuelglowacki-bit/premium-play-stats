/**
 * Verification du parcours journee par journee.
 *   npm run verif-parcours
 */
import { rankPlayers } from "./leaderboardRanking";
import {
  cheminLisible,
  journeeTerminee,
  parcoursSaison,
  progressionJournee,
  progressionTotale,
  type JourneeSaison,
  type JoueurSaison,
} from "./parcoursSaison";

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

const joueurs: JoueurSaison[] = [
  { id: "a", name: "FCS" },
  { id: "b", name: "Quentin" },
  { id: "c", name: "Sanji" },
];
const journees: JourneeSaison[] = [
  { id: "j1", numero: 1, matchIds: ["m1"] },
  { id: "j2", numero: 2, matchIds: ["m2"] },
  { id: "j3", numero: 3, matchIds: ["m3"] },
];

// FCS part mal puis explose ; Quentin mene puis cale ; Sanji remonte.
// Cumuls attendus :
//   FCS      0 ->  3 -> 14   rangs 3 -> 3 -> 1
//   Quentin  6 -> 11 -> 12   rangs 1 -> 1 -> 3
//   Sanji    2 ->  6 -> 13   rangs 2 -> 2 -> 2
const POINTS: Record<string, Record<string, number>> = {
  a: { m1: 0, m2: 3, m3: 11 },
  b: { m1: 6, m2: 5, m3: 1 },
  c: { m1: 2, m2: 4, m3: 7 },
};

const base = {
  joueurs,
  journees,
  pointsDe: (u: string, m: string) => POINTS[u]?.[m] ?? 0,
  exactDe: () => false,
  classer: rankPlayers,
};

console.log("\nPARCOURS JOURNEE PAR JOURNEE");
console.log("=".repeat(60));

const p = parcoursSaison(base);

console.log("\nLes cumuls et les rangs");
egal("FCS : 0 puis 3 puis 14 points",
  p.get("a")!.map((e) => e.points), [0, 3, 14]);
egal("Quentin : 6 puis 11 puis 12 points",
  p.get("b")!.map((e) => e.points), [6, 11, 12]);
egal("Sanji : 2 puis 6 puis 13 points",
  p.get("c")!.map((e) => e.points), [2, 6, 13]);

egal("FCS remonte de dernier a premier", p.get("a")!.map((e) => e.rang), [3, 3, 1]);
egal("Quentin mene puis se fait doubler par les deux", p.get("b")!.map((e) => e.rang), [1, 1, 3]);
egal("Sanji ne bouge pas de la 2e place", p.get("c")!.map((e) => e.rang), [2, 2, 2]);

console.log("\nLe gain de chaque journee");
egal("FCS gagne 0, 3 puis 11 points",
  p.get("a")!.map((e) => e.gainJournee), [0, 3, 11]);

console.log("\nProgression et chemin lisible");
egal("FCS : +2 places", progressionTotale(p.get("a")!), 2);
egal("Quentin : -2 places", progressionTotale(p.get("b")!), -2);
egal("le chemin de FCS", cheminLisible(p.get("a")!), "3e → 3e → 1er");

console.log("\nL'ordre des journees ne depend pas de celui des donnees");
const melange = parcoursSaison({ ...base, journees: [journees[2], journees[0], journees[1]] });
egal("meme parcours, journees melangees",
  melange.get("a")!.map((e) => e.rang), [3, 3, 1]);
egal("les numeros restent dans l'ordre",
  melange.get("a")!.map((e) => e.numero), [1, 2, 3]);

console.log("\nLes departages viennent du vrai classement");
// Deux joueurs a egalite de points : le score exact tranche.
const exAequo = parcoursSaison({
  joueurs: [{ id: "x", name: "X" }, { id: "y", name: "Y" }],
  journees: [{ id: "j1", numero: 1, matchIds: ["m1"] }],
  pointsDe: (u) => (u === "x" ? 3 : 3),
  exactDe: (u) => u === "y",
  classer: rankPlayers,
});
egal("a points egaux, le score exact passe devant",
  [exAequo.get("y")![0].rang, exAequo.get("x")![0].rang], [1, 2]);

console.log("\nCas limites");
const aucune = parcoursSaison({ ...base, journees: [] });
egal("aucune journee terminee : parcours vide", aucune.get("a"), []);
egal("progression d'un parcours vide", progressionTotale([]), 0);
egal("progression d'une seule journee", progressionTotale([{ numero: 1, rang: 4, points: 2, gainJournee: 2, exactScores: 0 }]), 0);
egal("chemin vide", cheminLisible([]), "");

const sansJoueur = parcoursSaison({ ...base, joueurs: [] });
egal("aucun joueur : aucune entree", [...sansJoueur.keys()], []);

console.log("\nLes scores exacts cumules");
const avecExacts = parcoursSaison({
  ...base,
  exactDe: (u, m) => u === "a" && m !== "m1",
});
egal("FCS : 0 puis 1 puis 2 scores exacts",
  avecExacts.get("a")!.map((e) => e.exactScores), [0, 1, 2]);
egal("les autres restent a zero",
  avecExacts.get("b")!.map((e) => e.exactScores), [0, 0, 0]);

console.log("\nUne journee entierement terminee");
egal("tous les matchs joues", journeeTerminee([true, true, true]), true);
egal("un seul match non joue : pas terminee", journeeTerminee([true, true, false]), false);
egal("un match bonus oublie bloque la journee",
  journeeTerminee([true, true, true, true, true, true, true, true, true, false]), false);
egal("aucun match : pas terminee, elle n'a pas commence", journeeTerminee([]), false);
egal("un seul match, joue", journeeTerminee([true]), true);
egal("un seul match, pas joue", journeeTerminee([false]), false);


console.log("\nLe mouvement sur la SEULE derniere journee");
// La distinction qui a fait dire a l'organisateur que l'article n'avait
// « plus aucun sens » : un joueur peut monter sur la saison et descendre
// sur la journee racontee. Les deux chiffres ne disent pas la meme chose.
{
  const etapes = [
    { numero: 1, rang: 19, points: 4, gainJournee: 4, exactScores: 0 },
    { numero: 2, rang: 20, points: 9, gainJournee: 5, exactScores: 0 },
    { numero: 3, rang: 7, points: 22, gainJournee: 13, exactScores: 1 },
    { numero: 4, rang: 11, points: 25, gainJournee: 3, exactScores: 1 },
  ];
  egal("sur la saison il a gagne huit places", progressionTotale(etapes), 8);
  egal("sur la journee il en a perdu quatre", progressionJournee(etapes), -4);
}
egal("aucune etape : aucun mouvement", progressionJournee([]), 0);
egal("une seule journee : aucun mouvement", progressionJournee([
  { numero: 1, rang: 3, points: 5, gainJournee: 5, exactScores: 0 },
]), 0);
egal("deux journees : la difference des deux rangs", progressionJournee([
  { numero: 1, rang: 8, points: 3, gainJournee: 3, exactScores: 0 },
  { numero: 2, rang: 5, points: 9, gainJournee: 6, exactScores: 0 },
]), 3);
egal("un joueur qui ne bouge pas : zero", progressionJournee([
  { numero: 1, rang: 5, points: 3, gainJournee: 3, exactScores: 0 },
  { numero: 2, rang: 5, points: 9, gainJournee: 6, exactScores: 0 },
]), 0);

console.log("\n" + "=".repeat(60));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
