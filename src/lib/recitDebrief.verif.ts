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
    mouvement: rangs.length > 1 ? rangs[rangs.length - 2] - rangs[rangs.length - 1] : 0,
    rangVeille: rangs.length > 1 ? rangs[rangs.length - 2] : null,
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
// Le participe s'accorde lui aussi : « une place gagnee », jamais « gagnees ».
verifier("le participe s'accorde au singulier",
  !texteUne.includes("une place gagnées"), texteUne);
verifier("et au pluriel quand il le faut",
  sansAccents(ecrireRecit({
    ...entrees,
    fiches: [fiche("A", 1, 10, [5, 1]), fiche("B", 2, 9, [1, 2])],
    remontees: [fiche("A", 1, 10, [5, 1])],
    chutes: [], meilleureJournee: null, exAequoTete: 1,
  })!.sections.flatMap((x) => x.paragraphes).join(" ")).includes("quatre places gagnées"));
verifier("un seul point : singulier", texteUne.includes("1 point") && !texteUne.includes("1 points"), texteUne);

console.log("\nCas limites");
egal("aucun joueur : aucun texte", ecrireRecit({ ...entrees, fiches: [] }), null);

console.log("\nLes sections ajoutees");
// Une ligue complete : il faut des poursuivants ET un bas de tableau.
const ligue = [
  fcs, lulu, sanji,
  fiche("Quentin", 4, 24, [11, 1, 1, 4], 0, 5),
  fiche("Max", 5, 24, [2, 2, 4, 5], 0, 4),
  fiche("Mel11", 6, 24, [1, 5, 5, 6], 0, 4),
  fiche("Jo", 7, 23, [22, 19, 7, 7], 0, 6),
  fiche("Nour", 8, 18, [10, 6, 20, 8], 0, 2),
  fiche("Chris", 9, 15, [9, 9, 9, 9], 0, 1),
  fiche("Phiphi", 10, 12, [10, 10, 10, 10], 0, 0),
];
const complet = ecrireRecit({
  ...entrees, fiches: ligue, remontees: [sanji, fcs], chutes: [remi],
  densite: { joueurs: 6, points: 1 },
})!;
const kickers = complet.sections.map((s) => s.kicker);
verifier("il y a une section poursuivants", kickers.includes("Les poursuivants"), JSON.stringify(kickers));
verifier("il y a un bas de tableau", kickers.includes("Le bas du tableau"), JSON.stringify(kickers));

const txtComplet = sansAccents(complet.sections.flatMap((s) => s.paragraphes).join(" "));
verifier("les poursuivants sont nommes",
  ["Lulu", "Sanji", "Quentin", "Max"].every((n) => txtComplet.includes(n)), txtComplet.slice(0, 300));
verifier("au plus quatre poursuivants sont detailles",
  (complet.sections.find((s) => s.kicker === "Les poursuivants")?.paragraphes.length ?? 0) <= 4);
verifier("l'ecart a la tete est dit", txtComplet.includes("de la tête"), txtComplet.slice(0, 400));
verifier("les derniers sont nommes", txtComplet.includes("Phiphi"), txtComplet);
verifier("on ne les enterre pas", txtComplet.includes("Rien n'est perdu") || txtComplet.includes("suffit à recoller"), txtComplet.slice(-400));
verifier("les questions de fin nomment de vrais joueurs",
  txtComplet.includes("poursuivra-t-il sa remontée"), txtComplet.slice(-400));

// Une toute petite ligue n'a ni poursuivants a detailler ni bas de tableau.
const petite = ecrireRecit({
  ...entrees, fiches: [fcs, lulu], remontees: [], chutes: [],
  densite: null, exAequoTete: 2, meilleureJournee: null,
})!;
verifier("pas de bas de tableau a deux joueurs",
  !petite.sections.some((s) => s.kicker === "Le bas du tableau"),
  JSON.stringify(petite.sections.map((s) => s.kicker)));

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
  r.sections.every((s) => ["or", "vert", "rouge", "bleu", "violet", "cyan"].includes(s.ton)));
verifier("les couleurs ne sont pas toutes identiques",
  new Set(r.sections.map((s) => s.ton)).size > 1,
  JSON.stringify(r.sections.map((s) => s.ton)));
verifier("deux sections qui se suivent n'ont jamais la meme couleur",
  complet.sections.every((s, i) => i === 0 || s.ton !== complet.sections[i - 1].ton),
  JSON.stringify(complet.sections.map((s) => `${s.kicker}:${s.ton}`)));


console.log("\nL'article parle de LA JOURNEE, pas de la saison");
// Le defaut signale par l'organisateur : « Chris » etait presente comme
// revenant de loin (19e a la J1, 11e aujourd'hui) alors qu'il venait de
// PERDRE quatre places sur la journee racontee.
{
  // Le rang d'une fiche doit toujours egaler le dernier rang de son parcours,
  // et les points suivre les rangs : c'est ce que produit le Debrief.
  const chris = fiche("Chris", 11, 15, [19, 20, 7, 11], 0, 3);   // saison +8, journee -4
  const marseillais = fiche("Marseillais", 9, 18, [23, 23, 11, 9], 0, 8); // saison +14, journee +2

  verifier("un joueur qui recule sur la journee n'est pas une remontee",
    chris.mouvement === -4 && chris.progression === 8,
    `mouvement ${chris.mouvement}, progression ${chris.progression}`);

  const art = ecrireRecit({
    ...entrees,
    fiches: [fcs, lulu, sanji, marseillais, chris],
    remontees: [marseillais],
    chutes: [chris],
  })!;
  const texte = sansAccents(art.sections.flatMap((x) => x.paragraphes).join(" "));

  verifier("la remontee est chiffree sur la journee, pas sur la saison",
    texte.includes("deux places gagnées") && !texte.includes("14 places gagnées"),
    texte.slice(0, 500));
  verifier("le rang de la veille est donne",
    texte.includes("de 11e à 9e"), texte.slice(0, 500));
  verifier("le parcours complet reste cite en contexte",
    texte.includes("23e, puis 23e, puis 11e, et enfin 9e"), texte.slice(0, 500));
  verifier("celui qui a recule est bien dans les chutes, sur la journee",
    texte.includes("Chris recule de quatre places sur cette journée"), texte);
  verifier("les titres de sections parlent du week-end",
    art.sections.some((x) => x.titre === "Ils ont grimpé ce week-end") ||
    art.sections.some((x) => x.titre.includes("grimp")), JSON.stringify(art.sections.map((x) => x.titre)));
}

console.log("\nLe retard du bas de tableau");
// Il etait calcule sur le MIEUX classe des trois derniers : le chiffre ne
// correspondait a aucun des noms cites juste avant.
{
  const bas = [
    fcs, lulu, sanji,
    fiche("A", 4, 40, [4, 4, 4, 4], 0, 5),
    fiche("B", 5, 38, [5, 5, 5, 5], 0, 5),
    fiche("C", 6, 36, [6, 6, 6, 6], 0, 5),
    fiche("D", 7, 34, [7, 7, 7, 7], 0, 5),
    fiche("Lolomat62", 8, 25, [8, 8, 8, 8], 0, 2),
    fiche("Red Evils", 9, 22, [9, 9, 9, 9], 0, 2),
    fiche("Nour", 10, 16, [10, 10, 10, 10], 0, 1),
  ];
  // Le leader du tableau ci-dessus est `fcs`, 25 points : on prend donc un
  // leader plus haut pour que l'ecart soit lisible.
  const tete = fiche("Tete", 1, 51, [1, 1, 1, 1], 0, 9);
  const art = ecrireRecit({
    ...entrees,
    fiches: [tete, ...bas.slice(3)],
    remontees: [], chutes: [],
  })!;
  const texte = sansAccents(art.sections.flatMap((x) => x.paragraphes).join(" "));

  verifier("le retard est donne en fourchette, du premier au dernier du groupe",
    texte.includes("va de 26 points à 35 points"), texte.slice(-600));
  verifier("l'ancien chiffre seul a disparu",
    !texte.includes("Le retard sur la tête est de 26 points"), texte.slice(-600));
}


console.log("\nLes echelles de parcours (ce que la page dessine)");
{
  const art = ecrireRecit(entrees)!;
  const enTete = art.sections.find((x) => x.kicker === "En tête")!;
  verifier("le leader a son echelle", (enTete.echelles ?? []).length === 1,
    JSON.stringify(enTete.echelles));
  egal("l'echelle porte le nom du joueur", enTete.echelles?.[0]?.nom, "FCS");
  egal("elle contient une etape par journee", enTete.echelles?.[0]?.etapes.length, 4);

  const remontees = art.sections.find((x) => x.kicker === "Les remontées")!;
  egal("chaque remontee a la sienne", (remontees.echelles ?? []).length, 2);

  // Un joueur qui n'a qu'une seule journee n'a pas de parcours a dessiner.
  const debut = ecrireRecit({
    ...entrees,
    journeesJouees: 1,
    numeroDerniereJournee: 1,
    fiches: [fiche("Seul", 1, 3, [1])],
    remontees: [], chutes: [], meilleureJournee: null, densite: null, exAequoTete: 1,
  })!;
  verifier("une seule journee : aucune echelle",
    debut.sections.every((x) => (x.echelles ?? []).length === 0),
    JSON.stringify(debut.sections.map((x) => x.echelles)));
}


console.log("\nDeux superlatifs sur la meme journee : dire ce qu'on mesure");
// L'organisateur a bute dessus : « la meilleure copie de la journee » (des
// POINTS) et « le plus beau coup de la journee » (des PLACES) se suivaient
// sans nommer leur critere, et designaient deux joueurs differents.
{
  const gros = fiche("Lapetitepute", 13, 21, [18, 10, 21, 13], 0, 14);   // 14 pts, +8 places
  const bouge = fiche("Mel11", 12, 31, [14, 15, 17, 12], 0, 13);          // 13 pts, +5 places
  const art = ecrireRecit({
    ...entrees,
    fiches: [fcs, lulu, sanji, bouge, gros],
    remontees: [bouge],
    chutes: [],
    meilleureJournee: gros,
  })!;
  const texte = sansAccents(art.sections.flatMap((x) => x.paragraphes).join(" "));

  verifier("le critere « points » est nomme",
    texte.includes("Le plus gros total de la journée 4 revient à Lapetitepute"), texte.slice(0, 900));
  verifier("le critere « places » est nomme",
    texte.includes("La plus forte progression de cette 4e journée est signée Mel11"), texte);
  verifier("plus de « meilleure copie » sans critere",
    !texte.includes("meilleure copie"), texte);
}

// Deux joueurs au meme total : on ne peut pas n'en nommer qu'un.
{
  const a = fiche("A", 4, 30, [5, 5, 5, 4], 0, 14);
  const b = fiche("B", 5, 29, [6, 6, 6, 5], 0, 14);
  const art = ecrireRecit({
    ...entrees,
    fiches: [fcs, lulu, sanji, a, b],
    remontees: [], chutes: [],
    meilleureJournee: a,
  })!;
  const texte = sansAccents(art.sections.flatMap((x) => x.paragraphes).join(" "));
  verifier("les ex aequo de la journee sont tous nommes",
    texte.includes("revient à A et B") && texte.includes("marqués chacun"), texte.slice(0, 900));
}


verifier("le brief ne digresse pas sur la saison",
  !sansAccents(ecrireRecit(entrees)!.sections.flatMap((x) => x.paragraphes).join(" "))
    .includes("Sur l'ensemble de la saison"));

console.log("\n" + "=".repeat(62));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
