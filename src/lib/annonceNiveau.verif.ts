/**
 * Verification de l'annonce de passage de niveau.
 *   npm run verif-annonce-niveau
 */
import { niveauAAnnoncer } from "./annonceNiveau";

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

console.log("\nANNONCE DE PASSAGE DE NIVEAU");
console.log("=".repeat(60));

console.log("\nLe cas normal");
egal("niveau 5 alors que 4 etait annonce : on annonce 5", niveauAAnnoncer(5, 4), 5);
egal("niveau 2 alors que 1 etait annonce : on annonce 2", niveauAAnnoncer(2, 1), 2);
egal("deux niveaux d'un coup : on annonce le niveau atteint", niveauAAnnoncer(7, 5), 7);

console.log("\nOn ne doit RIEN annoncer");
egal("meme niveau qu'avant", niveauAAnnoncer(4, 4), null);
egal("premiere ouverture, rien de memorise", niveauAAnnoncer(1, null), null);
egal("premiere ouverture d'un joueur deja haut", niveauAAnnoncer(12, null), null);
egal("le joueur redescend (correction de points)", niveauAAnnoncer(3, 5), null);

console.log("\nDonnees abimees : ne jamais planter, ne jamais annoncer");
egal("niveau non numerique", niveauAAnnoncer(Number.NaN, 3), null);
egal("niveau zero", niveauAAnnoncer(0, 1), null);
egal("niveau negatif", niveauAAnnoncer(-4, 1), null);
egal("memoire non numerique", niveauAAnnoncer(5, Number.NaN), null);
egal("niveau decimal : on compare les entiers", niveauAAnnoncer(5.9, 5), null);
egal("niveau decimal superieur", niveauAAnnoncer(6.2, 5), 6);

console.log("\nLe niveau maximum");
egal("niveau 30 depuis 29", niveauAAnnoncer(30, 29), 30);
egal("deja au niveau 30", niveauAAnnoncer(30, 30), null);

console.log("\n" + "=".repeat(60));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
