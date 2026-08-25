/**
 * NUMÉRO DE JOURNÉE — VÉRIFICATIONS
 * =================================
 * `npm run verif-journee`
 *
 * Le cas qui compte est le dernier de cette liste : un match qui ne porte QUE
 * `matchday_code`. C'est celui qui a fait disparaître le rappel de l'accueil,
 * sans erreur ni message — la fonction renvoyait 0, le filtre ne trouvait rien,
 * le bloc se cachait.
 */

import { numeroDeJournee } from "./numeroJournee";

let echecs = 0;
function verifier(nom: string, obtenu: number, attendu: number) {
  if (obtenu === attendu) {
    console.log(`OK    ${nom}`);
    return;
  }
  echecs += 1;
  console.log(`ECHEC ${nom} — attendu ${attendu}, obtenu ${obtenu}`);
}

verifier("code « J2 » seul", numeroDeJournee({ matchday_code: "J2" }), 2);
verifier("code « J12 » seul", numeroDeJournee({ matchday_code: "J12" }), 12);
verifier("nombre dans matchday", numeroDeJournee({ matchday: 5 }), 5);
verifier("nombre dans match_day", numeroDeJournee({ match_day: 7 }), 7);
verifier("texte « Journée 30 »", numeroDeJournee({ matchday_code: "Journée 30" }), 30);
verifier("le code prime sur les autres", numeroDeJournee({ matchday_code: "J3", matchday: 9 }), 3);
verifier("colonnes vides", numeroDeJournee({ matchday_code: null, matchday: null, match_day: null }), 0);
verifier("chaîne vide ignorée", numeroDeJournee({ matchday_code: "", matchday: 4 }), 4);
verifier("objet absent", numeroDeJournee(null), 0);

// Le cas reel : un match importe, qui ne porte que le code.
verifier(
  "match importé (code seul) — le cas qui avait cassé le rappel",
  numeroDeJournee({ matchday_code: "J2", matchday: null, match_day: null }),
  2,
);

console.log(echecs === 0 ? "\nTOUT PASSE" : `\n${echecs} ECHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);
