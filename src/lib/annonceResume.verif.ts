/**
 * Verification de l'annonce du resume personnel.
 *   npm run verif-annonce-resume
 */
import { resumeAMontrer } from "./annonceResume";

let total = 0;
let echecs = 0;
function egal(titre: string, obtenu: unknown, attendu: unknown) {
  total += 1;
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) console.log(`  ok    ${titre}`);
  else {
    echecs += 1;
    console.log(`  ECHEC ${titre}\n        obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
  }
}

console.log("\nQUAND MONTRER LA BULLE « TA JOURNEE »");
console.log("=".repeat(64));

egal("premiere visite : on montre", resumeAMontrer(4, null), 4);
egal("journee plus recente que la derniere vue : on montre", resumeAMontrer(5, 4), 5);
egal("deja vue : on ne remontre pas", resumeAMontrer(4, 4), null);
egal("plus ancienne : on ne remontre pas", resumeAMontrer(3, 4), null);
egal("aucune journee terminee : rien", resumeAMontrer(null, 4), null);
egal("journee indefinie : rien", resumeAMontrer(undefined, null), null);
egal("journee 0 : rien", resumeAMontrer(0, null), null);
egal("journee negative : rien", resumeAMontrer(-2, null), null);
egal("une memoire abimee vaut une premiere visite", resumeAMontrer(4, Number.NaN), 4);
egal("un numero a virgule est ramene a l'entier", resumeAMontrer(4.9, null), 4);
egal("et compare a l'entier de la derniere vue", resumeAMontrer(4.9, 4.2), null);

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
