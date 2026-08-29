/**
 * Verification de la reconnaissance d'un appel cron.
 *   npm run verif-cron
 *
 * C'est une decision de securite : elle decide si l'appelant peut sauter la
 * verification admin. Les cas qui comptent sont ceux ou une comparaison naive
 * repondrait OUI a tort.
 */
import { estAppelCron } from "../supabase/functions/_shared/appelCron.ts";

let total = 0;
let echecs = 0;

function verifier(titre: string, condition: boolean) {
  total += 1;
  if (condition) console.log(`  ok    ${titre}`);
  else {
    echecs += 1;
    console.log(`  ECHEC ${titre}`);
  }
}

console.log("\n=== Le cron est reconnu ===\n");

verifier("Secret correct", estAppelCron("s3cr3t", "s3cr3t") === true);

console.log("\n=== ...et personne d'autre ===\n");

verifier("Mauvais secret", estAppelCron("s3cr3t", "autre") === false);
verifier("Aucun en-tete envoye (appel navigateur)", estAppelCron("s3cr3t", null) === false);
verifier("En-tete vide", estAppelCron("s3cr3t", "") === false);
verifier("Casse differente", estAppelCron("s3cr3t", "S3CR3T") === false);
verifier("Espace en trop", estAppelCron("s3cr3t", "s3cr3t ") === false);

console.log("\n  -- le piege : secret absent cote serveur --\n");

verifier(
  "Secret non configure + en-tete absent : REFUSE (une comparaison naive dirait oui)",
  estAppelCron("", null) === false,
);
verifier("Secret non configure + en-tete vide : refuse", estAppelCron("", "") === false);
verifier("Secret non configure + n'importe quoi : refuse", estAppelCron("", "devine") === false);
verifier("Secret nul cote serveur : refuse", estAppelCron(null, "devine") === false);
verifier("Secret absent cote serveur : refuse", estAppelCron(undefined, undefined) === false);

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
