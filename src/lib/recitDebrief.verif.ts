/**
 * Verification du texte du Debrief.
 *   npm run verif-recit
 *
 * Ce qui est verifie ici n'est pas « le texte est joli » mais « le texte ne
 * ment pas et ne se trompe pas d'accord » : un article lu par vingt-trois
 * personnes qui se reconnaissent dedans n'a pas droit a « une place gagnées »
 * ni a « il » pour une joueuse.
 */
import {
  ecrireRecit,
  listeFr,
  nombreEcrit,
  parcoursEcrit,
  rangEcrit,
  sansAccents,
  morceaux,
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
console.log("=".repeat(64));

console.log("\nLes petites formes");
egal("1er, pas 1e", rangEcrit(1), "1er");
egal("2e", rangEcrit(2), "2e");
egal("23e", rangEcrit(23), "23e");
egal("les petits nombres s'ecrivent en lettres", nombreEcrit(3), "trois");
egal("dix aussi", nombreEcrit(10), "dix");
egal("au-dela, en chiffres", nombreEcrit(17), "17");
egal("le negatif est ecrit en valeur absolue", nombreEcrit(-9), "neuf");

console.log("\nL'enumeration");
egal("un seul nom", listeFr(["A"]), "A");
egal("deux noms", listeFr(["A", "B"]), "A et B");
egal("trois noms", listeFr(["A", "B", "C"]), "A, B et C");
egal("aucun nom", listeFr([]), "");

console.log("\nLe parcours");
egal("un seul rang", parcoursEcrit([{ numero: 1, rang: 4, points: 2, gainJournee: 2 }]), "4e");
egal("quatre rangs", parcoursEcrit([
  { numero: 1, rang: 17, points: 5, gainJournee: 5 },
  { numero: 2, rang: 9, points: 9, gainJournee: 4 },
  { numero: 3, rang: 6, points: 16, gainJournee: 7 },
  { numero: 4, rang: 1, points: 25, gainJournee: 9 },
]), "17e, puis 9e, puis 6e, et enfin 1er");
egal("« et toujours » quand le rang ne bouge plus", parcoursEcrit([
  { numero: 1, rang: 20, points: 0, gainJournee: 0 },
  { numero: 2, rang: 3, points: 0, gainJournee: 0 },
  { numero: 3, rang: 3, points: 0, gainJournee: 0 },
]), "20e, puis 3e, et toujours 3e");
egal("aucun rang", parcoursEcrit([]), "");

console.log("\nLa mise en avant");
egal("le gras est isole", morceaux("Il a **25 points**."),
  [{ texte: "Il a ", accent: false }, { texte: "25 points", accent: true }, { texte: ".", accent: false }]);
egal("sansAccents retire les etoiles", sansAccents("Il a **25 points**."), "Il a 25 points.");

// ------------------------------------------------------------------
// UNE LIGUE COMPLETE, avec les vrais pseudos de l'organisateur
// ------------------------------------------------------------------
function fiche(
  name: string, rang: number, rangs: number[], cumuls: number[], gains: number[], exact = 0,
  genre: string | null = null,
): FicheRecit {
  return {
    id: name, name, rang, genre,
    points: cumuls[cumuls.length - 1],
    exactScores: exact,
    progression: rangs.length > 1 ? rangs[0] - rangs[rangs.length - 1] : 0,
    mouvement: rangs.length > 1 ? rangs[rangs.length - 2] - rangs[rangs.length - 1] : 0,
    rangVeille: rangs.length > 1 ? rangs[rangs.length - 2] : null,
    derniereJournee: gains[gains.length - 1],
    etapes: rangs.map((r, i) => ({ numero: i + 1, rang: r, points: cumuls[i], gainJournee: gains[i] })),
  };
}

const fcs      = fiche("FCS",         1, [17, 9, 6, 1],   [5, 9, 16, 25],  [5, 4, 7, 9], 2);
const lulu     = fiche("Lulu",        2, [8, 3, 2, 2],    [6, 12, 18, 25], [6, 6, 6, 7], 1);
const sanji    = fiche("Sanji",       3, [20, 7, 3, 3],   [4, 11, 18, 25], [4, 7, 7, 7], 1);
const quentin  = fiche("Quentin",     4, [11, 1, 1, 4],   [6, 13, 19, 24], [6, 7, 6, 5]);
const max      = fiche("Max",         5, [2, 2, 4, 5],    [7, 13, 18, 24], [7, 6, 5, 6]);
const mel11    = fiche("Mel11",       6, [1, 5, 5, 6],    [8, 13, 18, 24], [8, 5, 5, 6]);
const jo       = fiche("Jo gunners",  8, [22, 19, 7, 8],  [4, 8, 16, 23],  [4, 4, 8, 7]);
const lapetite = fiche("Lapetitepute", 13, [18, 10, 21, 13], [5, 10, 14, 21], [5, 5, 4, 7]);
const remi     = fiche("Remi_lille", 23, [14, 12, 14, 23], [5, 10, 14, 18], [5, 5, 4, 4]);
const nour     = fiche("Nour",       22, [10, 6, 20, 22],  [6, 12, 14, 19], [6, 6, 2, 5]);

const ligue = [fcs, lulu, sanji, quentin, max, mel11, jo, lapetite, nour, remi];

const entrees: EntreesRecit = {
  journeesJouees: 4,
  numeroDerniereJournee: 4,
  fiches: ligue,
  remontees: [lapetite, jo],
  chutes: [remi, nour],
  meilleureJournee: fcs,
  densite: { joueurs: 10, points: 3 },
  exAequoTete: 3,
};

const r = ecrireRecit(entrees)!;
const tout = sansAccents([
  r.titre, r.sousTitre, ...r.chapeau,
  ...r.sections.flatMap((s) => [s.intertitre, ...s.paragraphes, s.phraseForte ?? ""]),
].join(" "));

console.log("\nLa une");
egal("le surtitre est celui du journal", r.surtitre, "Prono Ligue 1 LM — Le grand débrief");
verifier("le titre parle de la course ouverte", r.titre.includes("plus ouverte que jamais"), r.titre);
verifier("le sous-titre nomme le leader et le total", r.sousTitre.includes("FCS") && r.sousTitre.includes("25 points"), r.sousTitre);
verifier("le chapo fait plusieurs paragraphes", r.chapeau.length >= 3, String(r.chapeau.length));
verifier("le chapo annonce les six dans un point",
  sansAccents(r.chapeau.join(" ")).includes("Six joueurs dans un seul point"), r.chapeau.join(" | "));

console.log("\nLes articles");
verifier("le leader a son article", r.sections.some((s) => s.intertitre.startsWith("FCS")), JSON.stringify(r.sections.map((s) => s.intertitre)));
verifier("le haut du classement a le sien", r.sections.some((s) => s.intertitre.includes("un même objectif")));
verifier("la remontee de la saison est racontee", tout.includes("Sanji") && tout.includes("17 places"), tout.slice(0, 200));
verifier("l'ancien leader a son article", r.sections.some((s) => s.intertitre.startsWith("Quentin")));
verifier("ceux qui reculent ont le leur", r.sections.some((s) => s.intertitre.includes("perdu du terrain")));
verifier("l'article se conclut sur la journee suivante", r.sections[r.sections.length - 1].intertitre === "Cap sur la journée 5",
  r.sections[r.sections.length - 1].intertitre);
verifier("au moins une phrase forte", r.sections.some((s) => s.phraseForte), "aucune");
verifier("au moins un encadre chiffre", r.sections.some((s) => s.encadre), "aucun");
verifier("les echelles de parcours restent occasionnelles",
  r.sections.filter((s) => s.echelles?.length).length <= 2,
  String(r.sections.filter((s) => s.echelles?.length).length));

console.log("\nLES ACCORDS — le point ou un gabarit se trompe sur une vraie personne");
const articleLulu = r.sections.find((s) => s.intertitre.startsWith("Lulu"));
verifier("Lulu a son article", Boolean(articleLulu), JSON.stringify(r.sections.map((s) => s.intertitre)));
if (articleLulu) {
  const texteLulu = sansAccents([...articleLulu.paragraphes, articleLulu.phraseForte ?? ""].join(" "));
  verifier("Lulu est au feminin", texteLulu.includes("Elle") || texteLulu.includes(" elle "), texteLulu);
  verifier("jamais « il » pour Lulu", !/\bIl\b|\bil\b/.test(texteLulu), texteLulu);
}
// Mel11 est la seconde joueuse de la ligue : elle aussi doit etre accordee.
{
  const seule = ecrireRecit({
    ...entrees,
    fiches: [mel11, max],
    remontees: [], chutes: [], densite: null, exAequoTete: 1,
  })!;
  const texte = sansAccents([...seule.chapeau, ...seule.sections.flatMap((s) => s.paragraphes)].join(" "));
  verifier("Mel11 est au feminin", /\belle\b|\bElle\b/.test(texte), texte.slice(0, 400));
  verifier("jamais « il » pour Mel11",
    !/\bil\b|\bIl\b/.test(texte), texte.slice(0, 400));
}
// Le masculin des autres vient de l'organisateur, pas d'une supposition.
{
  const lui = ecrireRecit({
    ...entrees,
    fiches: [max, quentin],
    remontees: [], chutes: [], densite: null, exAequoTete: 1,
  })!;
  const texte = sansAccents([...lui.chapeau, ...lui.sections.flatMap((s) => s.paragraphes)].join(" "));
  verifier("les joueurs sont au masculin", /\bIl\b|\bil\b/.test(texte), texte.slice(0, 300));
}

console.log("\nLes accords de nombre");
verifier("jamais « une places »", !tout.includes("une places"), tout);
verifier("jamais « 1 points »", !/\b1 points\b/.test(tout), tout);
verifier("jamais « une place gagnées »", !tout.includes("une place gagnées"), tout);

console.log("\nCas limites");
egal("aucun joueur : aucun texte", ecrireRecit({ ...entrees, fiches: [] }), null);
{
  const solo = ecrireRecit({
    ...entrees,
    journeesJouees: 1,
    numeroDerniereJournee: 1,
    fiches: [fiche("Seul", 1, [1], [3], [3])],
    remontees: [], chutes: [], meilleureJournee: null, densite: null, exAequoTete: 1,
  })!;
  verifier("une seule journee : un article quand meme", solo.sections.length >= 1);
  verifier("pas de parcours a raconter sur une journee",
    !sansAccents(solo.sections.flatMap((s) => s.paragraphes).join(" ")).includes("journée après journée"));
  verifier("aucune echelle sur une seule journee",
    solo.sections.every((s) => (s.echelles ?? []).length === 0));
}


console.log("\nLes clefs d'article (ce a quoi les reactions se rattachent)");
{
  const clefs = r.sections.map((s) => s.cle);
  verifier("chaque article a une clef", clefs.every(Boolean), JSON.stringify(clefs));
  verifier("aucune clef en double", new Set(clefs).size === clefs.length, JSON.stringify(clefs));
  // La clef ne doit PAS dependre du titre affiche : celui-ci contient un
  // pseudo et change d'une journee a l'autre. Les reactions se perdraient.
  verifier("la clef ne contient aucun pseudo",
    clefs.every((c) => !/FCS|Lulu|Sanji|Quentin|Max|Mel11/i.test(c)), JSON.stringify(clefs));
  verifier("la clef du leader est stable", clefs.includes("leader"), JSON.stringify(clefs));
  verifier("celle de la conclusion aussi", clefs.includes("conclusion"), JSON.stringify(clefs));
}


console.log("\nLE GENRE DECLARE SUR LE PROFIL l'emporte");
// Un joueur qui corrige son profil doit voir l'article changer. Sans cela,
// la correction resterait sans effet et il n'aurait aucun recours.
{
  const declare = fiche("Sanji", 1, [1, 1], [10, 20], [10, 10], 0, "feminin");
  const art = ecrireRecit({
    ...entrees,
    fiches: [declare, fiche("B", 2, [2, 2], [8, 15], [8, 7])],
    remontees: [], chutes: [], densite: null, exAequoTete: 1,
  })!;
  const texte = sansAccents(art.sections.flatMap((x) => x.paragraphes).join(" "));
  verifier("Sanji declare au feminin est ecrit au feminin",
    /\belle\b|\bElle\b/.test(texte), texte.slice(0, 300));
  verifier("et plus au masculin", !/\bIl\b|\bil\b/.test(texte), texte.slice(0, 300));
}

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
