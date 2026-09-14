/**
 * Verification du lecteur d'article ecrit a la main.
 *   npm run verif-article
 */
import { lireArticle, titreDeUne, type BlocArticle } from "./articleManuel";

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
const types = (blocs: BlocArticle[]) => blocs.map((b) => b.type);

console.log("\nL'ARTICLE ECRIT A LA MAIN");
console.log("=".repeat(64));

console.log("\nRien a afficher");
egal("texte vide", lireArticle(""), []);
egal("que des espaces", lireArticle("   \n\n  "), []);
egal("null", lireArticle(null), []);
egal("undefined", lireArticle(undefined), []);

console.log("\nLes formes reconnues");
egal("un paragraphe simple", lireArticle("Bonjour tout le monde."),
  [{ type: "paragraphe", texte: "Bonjour tout le monde." }]);
// Les retours a la ligne sont VOULUS : un parcours aligne ligne par ligne
// doit le rester. C'est ce que l'organisateur ecrit dans ses articles.
egal("les retours a la ligne d'un paragraphe sont gardes",
  lireArticle("Une phrase\nqui continue."),
  [{ type: "paragraphe", texte: "Une phrase\nqui continue." }]);
egal("un parcours aligne garde ses quatre lignes",
  lireArticle("J1 : 17e — 5 pts\n⬆️ J2 : 9e — 9 pts\n⬆️ J3 : 6e — 16 pts\n⬆️ J4 : 1er — 25 pts"),
  [{ type: "paragraphe", texte: "J1 : 17e — 5 pts\n⬆️ J2 : 9e — 9 pts\n⬆️ J3 : 6e — 16 pts\n⬆️ J4 : 1er — 25 pts" }]);
egal("une ligne vide separe deux paragraphes",
  types(lireArticle("Un.\n\nDeux.")), ["paragraphe", "paragraphe"]);
egal("un titre en majuscules",
  lireArticle("LE PATRON DU MOMENT"),
  [{ type: "titre", texte: "LE PATRON DU MOMENT", emoji: "" }]);
egal("un titre avec son emoji",
  lireArticle("👑 FCS PREND LE POUVOIR !"),
  [{ type: "titre", texte: "FCS PREND LE POUVOIR !", emoji: "👑" }]);
egal("un titre en dièse",
  lireArticle("# Le grand bilan"),
  [{ type: "titre", texte: "Le grand bilan", emoji: "" }]);
egal("une citation", lireArticle("> Tout est encore ouvert."),
  [{ type: "citation", texte: "Tout est encore ouvert." }]);
egal("une liste a tirets", lireArticle("- Un\n- Deux"),
  [{ type: "liste", elements: ["Un", "Deux"] }]);
egal("une liste numerotee", lireArticle("1. Un\n2. Deux"),
  [{ type: "liste", elements: ["Un", "Deux"] }]);
egal("une liste en medailles", lireArticle("🥇 FCS — 25 pts\n🥈 Lulu — 25 pts"),
  [{ type: "liste", elements: ["FCS — 25 pts", "Lulu — 25 pts"] }]);
egal("un separateur", types(lireArticle("Un.\n\n---\n\nDeux.")),
  ["paragraphe", "separateur", "paragraphe"]);

console.log("\nCe qui ne doit PAS passer pour un titre");
egal("une phrase normale", types(lireArticle("Le classement est serré.")), ["paragraphe"]);
egal("une phrase criee qui se termine par un point",
  types(lireArticle("TOUT EST ENCORE OUVERT.")), ["paragraphe"]);
egal("une ligne sans lettre", types(lireArticle("2026-2027")), ["paragraphe"]);
egal("une ligne trop longue pour un titre",
  types(lireArticle("A".repeat(120))), ["paragraphe"]);
egal("une ligne majoritairement minuscule",
  types(lireArticle("FCS prend le pouvoir")), ["paragraphe"]);

console.log("\nLes tableaux");
egal("un tableau a deux lignes",
  lireArticle("| Rang | Joueur | Points |\n| 1 | FCS | 25 |"),
  [{ type: "tableau", lignes: [["Rang", "Joueur", "Points"], ["1", "FCS", "25"]] }]);
egal("la ligne de separation Markdown est ignoree",
  lireArticle("| a | b |\n|---|---|\n| 1 | 2 |"),
  [{ type: "tableau", lignes: [["a", "b"], ["1", "2"]] }]);


console.log("\nLes tableaux colles depuis un traitement de texte");
egal("les tabulations font un tableau",
  lireArticle("Rang\tJoueur\tPoints\n1\tFCS\t25"),
  [{ type: "tableau", lignes: [["Rang", "Joueur", "Points"], ["1", "FCS", "25"]] }]);
egal("une ligne vide ne coupe pas le tableau en deux",
  lireArticle("Rang\tJoueur\tPoints\n\n🥇\tFCS\t25\n🥈\tLulu\t25"),
  [{ type: "tableau", lignes: [["Rang", "Joueur", "Points"], ["🥇", "FCS", "25"], ["🥈", "Lulu", "25"]] }]);
egal("une medaille en debut de ligne de tableau n'est pas une puce",
  types(lireArticle("🥇\tFCS\t25")), ["tableau"]);
egal("mais une medaille sans tabulation reste une puce",
  types(lireArticle("🥇 FCS — 25 pts")), ["liste"]);
egal("un texte qui suit ferme le tableau",
  types(lireArticle("a\tb\n\nUne phrase normale ici.")), ["tableau", "paragraphe"]);

console.log("\nLes bords");
egal("un separateur en tete est retire", types(lireArticle("---\nUn.")), ["paragraphe"]);
egal("un separateur en fin est retire", types(lireArticle("Un.\n---")), ["paragraphe"]);
egal("deux separateurs de suite n'en font qu'un",
  types(lireArticle("Un.\n---\n\n---\nDeux.")), ["paragraphe", "separateur", "paragraphe"]);
egal("le gras n'est pas touche ici",
  lireArticle("Il compte **25 points**."),
  [{ type: "paragraphe", texte: "Il compte **25 points**." }]);

console.log("\nLe titre de une");
egal("le premier titre sert d'en-tete",
  titreDeUne(lireArticle("🏆 LE GRAND BILAN\n\nUn texte.\n\n👑 EN TETE")),
  { texte: "LE GRAND BILAN", emoji: "🏆" });
egal("aucun titre : aucun en-tete", titreDeUne(lireArticle("Juste du texte.")), null);

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
