/**
 * Verification du texte du Debrief.
 *   npm run verif-recit
 */
import {
  ecrireRecit,
  listeFr,
  morceaux,
  sansAccents,
  nombreEcrit,
  parcoursEcrit,
  rangEcrit,
  type EntreesRecit,
  type FicheRecit,
} from "./recitDebrief";

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

console.log("\nLE TEXTE DU DEBRIEF");
console.log("=".repeat(62));

console.log("\nLes petites formes");
egal("1er, pas 1e", rangEcrit(1), "1er");
egal("2e", rangEcrit(2), "2e");
egal("23e", rangEcrit(23), "23e");
egal("les petits nombres s'ecrivent en lettres", nombreEcrit(3), "trois");
egal("dix aussi", nombreEcrit(10), "dix");
egal("au-dela, en chiffres", nombreEcrit(17), "17");
egal("le negatif est ecrit en valeur absolue", nombreEcrit(-9), "neuf");

console.log("\nLe parcours");
egal("un seul rang", parcoursEcrit([{ numero: 1, rang: 4, points: 2, gainJournee: 2 }]), "4e");
egal("deux rangs", parcoursEcrit([
  { numero: 1, rang: 8, points: 2, gainJournee: 2 },
  { numero: 2, rang: 3, points: 6, gainJournee: 4 },
]), "8e, puis 3e");
egal("quatre rangs", parcoursEcrit([
  { numero: 1, rang: 17, points: 5, gainJournee: 5 },
  { numero: 2, rang: 9, points: 9, gainJournee: 4 },
  { numero: 3, rang: 6, points: 16, gainJournee: 7 },
  { numero: 4, rang: 1, points: 25, gainJournee: 9 },
]), "17e, puis 9e, puis 6e, et enfin 1er");
egal("aucun rang", parcoursEcrit([]), "");

function fiche(name: string, rang: number, points: number, rangs: number[], exact = 0, derniere = 0): FicheRecit {
  return {
    id: name, name, rang, points, exactScores: exact,
    progression: rangs.length > 1 ? rangs[0] - rangs[rangs.length - 1] : 0,
    derniereJournee: derniere,
    etapes: rangs.map((r, i) => ({ numero: i + 1, rang: r, points: 0, gainJournee: 0 })),
  };
}

const fcs = fiche("FCS", 1, 25, [17, 9, 6, 1], 2, 9);
const lulu = fiche("Lulu", 2, 25, [8, 3, 2, 2], 1, 7);
const sanji = fiche("Sanji", 3, 25, [20, 7, 3, 3], 1, 7);
const remi = fiche("Remi_lille", 23, 18, [14, 12, 14, 23]);

const entrees: EntreesRecit = {
  journeesJouees: 4,
  numeroDerniereJournee: 4,
  fiches: [fcs, lulu, sanji],
  remontees: [sanji, fcs],
  chutes: [remi],
  meilleureJournee: fcs,
  densite: { joueurs: 10, points: 3 },
  exAequoTete: 3,
};

const r = ecrireRecit(entrees)!;
const tout = sansAccents([r.chapeau, ...r.sections.flatMap((s) => s.paragraphes)].join(" "));

console.log("\nL'article");
egal("le surtitre compte les journees", r.surtitre, "Le grand bilan après quatre journées");
egal("le titre annonce l'egalite", r.titre, "Trois joueurs à égalité en tête");
verifier("le chapeau dit la densite", tout.includes("Dix joueurs se tiennent en trois points"), r.chapeau);
verifier("le leader est nomme", tout.includes("FCS"));
verifier("le parcours du leader est raconte",
  tout.includes("17e, puis 9e, puis 6e, et enfin 1er"), tout.slice(0, 400));
verifier("les ex aequo sont relies par « et »", tout.includes("Lulu et Sanji"), tout);
verifier("jamais d'enumeration sans « et »", !tout.includes("Lulu, Sanji comptent"), tout);
verifier("la chute est racontee", tout.includes("Remi_lille recule de neuf places"), tout);
verifier("la nuance sur les chutes est presente",
  tout.includes("reculer ne veut pas dire avoir mal joué"));
verifier("la conclusion annonce la journee suivante", tout.includes("journée 5"), tout.slice(-300));

console.log("\nL'enumeration");
egal("un seul nom", listeFr(["A"]), "A");
egal("deux noms", listeFr(["A", "B"]), "A et B");
egal("trois noms", listeFr(["A", "B", "C"]), "A, B et C");
egal("aucun nom", listeFr([]), "");

console.log("\nLe parcours d'un joueur qui ne bouge plus");
egal("« et toujours », pas « et enfin »", parcoursEcrit([
  { numero: 1, rang: 20, points: 0, gainJournee: 0 },
  { numero: 2, rang: 3, points: 0, gainJournee: 0 },
  { numero: 3, rang: 3, points: 0, gainJournee: 0 },
]), "20e, puis 3e, et toujours 3e");

console.log("\nLes accords, la ou un gabarit se trompe");
const solo = ecrireRecit({
  ...entrees,
  journeesJouees: 1,
  numeroDerniereJournee: 1,
  fiches: [fiche("Seul", 1, 3, [1])],
  remontees: [], chutes: [], meilleureJournee: null, densite: null, exAequoTete: 1,
})!;
const texteSolo = sansAccents([solo.chapeau, ...solo.sections.flatMap((s) => s.paragraphes)].join(" "));
egal("une seule journee : singulier", solo.surtitre, "Le grand bilan après une journée");
verifier("un seul joueur : pas d'ex aequo annonce", !texteSolo.includes("égalité"), texteSolo);
verifier("pas de parcours a raconter sur une journee",
  !texteSolo.includes("journée après journée"), texteSolo);

const unePlace = ecrireRecit({
  ...entrees,
  fiches: [fiche("A", 1, 10, [2, 1]), fiche("B", 2, 9, [1, 2])],
  remontees: [fiche("A", 1, 10, [2, 1])],
  chutes: [fiche("B", 2, 9, [1, 2])],
  densite: { joueurs: 3, points: 1 },
  exAequoTete: 1,
  meilleureJournee: null,
})!;
const texteUne = sansAccents([unePlace.chapeau, ...unePlace.sections.flatMap((s) => s.paragraphes)].join(" "));
verifier("une seule place : singulier", texteUne.includes("une place") && !texteUne.includes("une places"), texteUne);
verifier("un seul point : singulier", texteUne.includes("1 point") && !texteUne.includes("1 points"), texteUne);

console.log("\nCas limites");
egal("aucun joueur : aucun texte", ecrireRecit({ ...entrees, fiches: [] }), null);

console.log("\nLes chiffres mis en avant");
const brut = [r.chapeau, ...r.sections.flatMap((s) => s.paragraphes)].join(" ");
verifier("des passages sont marques", brut.includes("**"), brut.slice(0, 120));
verifier("les marqueurs vont par paires", (brut.match(/\*\*/g) ?? []).length % 2 === 0,
  `${(brut.match(/\*\*/g) ?? []).length} marqueurs`);
egal("sansAccents les retire", sansAccents("un **gros** chiffre"), "un gros chiffre");
egal("morceaux separe le texte et l'accent",
  morceaux("un **gros** chiffre"),
  [{ texte: "un ", accent: false }, { texte: "gros", accent: true }, { texte: " chiffre", accent: false }]);
egal("un texte sans marqueur reste entier",
  morceaux("rien a signaler"), [{ texte: "rien a signaler", accent: false }]);
egal("un texte vide ne produit rien", morceaux(""), []);
verifier("aucun marqueur ne survit a l'affichage",
  morceaux(brut).every((m) => !m.texte.includes("**")));

console.log("\nEmojis et couleurs");
verifier("le titre porte un emoji", r.emoji.length > 0, r.emoji);
verifier("chaque section a un emoji", r.sections.every((s) => s.emoji.length > 0));
verifier("chaque section a une couleur",
  r.sections.every((s) => ["or", "vert", "rouge", "bleu"].includes(s.ton)));
verifier("les couleurs ne sont pas toutes identiques",
  new Set(r.sections.map((s) => s.ton)).size > 1,
  JSON.stringify(r.sections.map((s) => s.ton)));

console.log("\n" + "=".repeat(62));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
