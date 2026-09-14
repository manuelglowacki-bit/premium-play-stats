/**
 * Verification des accords et des anciens pseudos.
 *   npm run verif-joueurs
 */
import { accordsDe, clefPseudo, genreDe, pseudoActuel } from "./joueurs";

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

console.log("\nLES JOUEURS : GENRE ET ANCIENS PSEUDOS");
console.log("=".repeat(64));

console.log("\nLa clef de comparaison");
egal("la casse ne compte pas", clefPseudo("LULU"), "lulu");
egal("les accents non plus", clefPseudo("Rémi"), "remi");
egal("les espaces en trop sont ramenes a un", clefPseudo("  Jo   gunners "), "jo gunners");
egal("vide", clefPseudo(null), "");

console.log("\nLes anciens pseudos");
egal("North London devient Jo gunners", pseudoActuel("North London"), "Jo gunners");
egal("quelle que soit la casse", pseudoActuel("north  LONDON"), "Jo gunners");
egal("un pseudo inconnu n'est jamais renomme", pseudoActuel("Mel11"), "Mel11");
egal("un pseudo deja a jour reste tel quel", pseudoActuel("Jo gunners"), "Jo gunners");
egal("vide", pseudoActuel(""), "");

console.log("\nLe genre");
egal("Lulu est une joueuse", genreDe("Lulu"), "feminin");
egal("la casse ne change rien", genreDe("LULU"), "feminin");
egal("FCS a ete indique au masculin", genreDe("FCS"), "masculin");
egal("l'ancien pseudo herite du genre du nouveau",
  genreDe("North London"), genreDe("Jo gunners"));
// LE POINT IMPORTANT : un joueur inconnu n'est PAS masculin par defaut.
// Se tromper de genre sur une vraie personne est une faute ; le neutre, non.
egal("un joueur non renseigne reste au neutre", genreDe("Mel11"), "neutre");
egal("un pseudo vide aussi", genreDe(""), "neutre");

console.log("\nLes accords");
egal("au feminin", accordsDe("Lulu"),
  { il: "elle", lui: "elle", leJoueur: "la joueuse", son: "son", e: "e", aUnPronom: true });
egal("au masculin", accordsDe("Sanji"),
  { il: "il", lui: "lui", leJoueur: "le joueur", son: "son", e: "", aUnPronom: true });
verifier("au neutre, aucun pronom n'est propose", accordsDe("Mel11").aUnPronom === false);
egal("au neutre, le nom commun reste neutre", accordsDe("Mel11").leJoueur, "le joueur");
// « derriere il » n'existe pas en francais : il faut le pronom tonique.
egal("le pronom tonique au feminin", accordsDe("Lulu").lui, "elle");
egal("le pronom tonique au masculin", accordsDe("Sanji").lui, "lui");
egal("aucun pronom tonique au neutre", accordsDe("Mel11").lui, "");

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
