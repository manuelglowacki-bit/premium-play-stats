/**
 * Verification de l'annonce « le Debrief est en ligne ».
 *   npm run verif-annonce-debrief
 */
import { debriefAAnnoncer } from "./annonceDebrief";

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

console.log("\nANNONCE DU DEBRIEF");
console.log("=".repeat(58));

console.log("\nOn annonce");
egal("nouvelle journee apres la J3 vue", debriefAAnnoncer(4, 3), 4);
egal("premiere visite : on annonce quand meme", debriefAAnnoncer(4, null), 4);
egal("premiere visite, premiere journee", debriefAAnnoncer(1, null), 1);
egal("deux journees d'un coup (absence)", debriefAAnnoncer(6, 4), 6);

console.log("\nOn n'annonce pas");
egal("deja vue", debriefAAnnoncer(4, 4), null);
egal("le Debrief revient en arriere (correction de score)", debriefAAnnoncer(3, 4), null);
egal("aucune journee terminee", debriefAAnnoncer(null, 2), null);
egal("journee indefinie", debriefAAnnoncer(undefined, 2), null);

console.log("\nDonnees abimees : jamais de plantage");
egal("journee non numerique", debriefAAnnoncer(Number.NaN, 2), null);
egal("journee zero", debriefAAnnoncer(0, null), null);
egal("journee negative", debriefAAnnoncer(-3, null), null);
egal("memoire non numerique : on annonce", debriefAAnnoncer(4, Number.NaN), 4);
egal("journee decimale : on compare les entiers", debriefAAnnoncer(4.8, 4), null);
egal("journee decimale superieure", debriefAAnnoncer(5.2, 4), 5);

console.log("\n" + "=".repeat(58));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
