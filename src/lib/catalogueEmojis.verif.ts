/**
 * Verification du catalogue d'emojis.
 *   npm run verif-emojis
 */
import {
  CATEGORIES_EMOJIS,
  EMOJIS_FAVORIS,
  emojiValide,
  tousLesEmojis,
} from "./catalogueEmojis";

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

console.log("\nLE CATALOGUE D'EMOJIS");
console.log("=".repeat(64));

console.log("\nLe catalogue");
verifier("plusieurs categories", CATEGORIES_EMOJIS.length >= 8, String(CATEGORIES_EMOJIS.length));
verifier("chaque categorie a une clef, un nom et un onglet",
  CATEGORIES_EMOJIS.every((c) => c.cle && c.nom && c.onglet));
verifier("aucune clef de categorie en double",
  new Set(CATEGORIES_EMOJIS.map((c) => c.cle)).size === CATEGORIES_EMOJIS.length);
verifier("aucune categorie vide", CATEGORIES_EMOJIS.every((c) => c.emojis.length > 0));
verifier("le catalogue est fourni", tousLesEmojis().length >= 300, String(tousLesEmojis().length));
verifier("aucun doublon dans le catalogue final",
  new Set(tousLesEmojis()).size === tousLesEmojis().length);
verifier("chaque onglet est lui-meme un emoji valide",
  CATEGORIES_EMOJIS.every((c) => emojiValide(c.onglet)),
  JSON.stringify(CATEGORIES_EMOJIS.filter((c) => !emojiValide(c.onglet)).map((c) => c.onglet)));

console.log("\nTout le catalogue doit etre enregistrable");
{
  const refuses = tousLesEmojis().filter((e) => !emojiValide(e));
  verifier("aucun emoji du catalogue n'est refuse par la regle",
    refuses.length === 0, JSON.stringify(refuses));
}

console.log("\nLes favoris");
egal("douze favoris", EMOJIS_FAVORIS.length, 12);
verifier("les favoris sont valides", EMOJIS_FAVORIS.every(emojiValide));
// Les emojis avec lesquels des reactions ont deja ete posees doivent rester
// proposes : sinon un joueur voit sa reaction disparaitre du choix.
["👏", "🔥", "😮", "😂", "😢", "💪"].forEach((emoji) =>
  verifier(`${emoji} — emoji d'origine, toujours en favori`,
    (EMOJIS_FAVORIS as readonly string[]).includes(emoji)),
);
verifier("chaque favori figure aussi dans le catalogue",
  EMOJIS_FAVORIS.every((e) => tousLesEmojis().includes(e)),
  JSON.stringify(EMOJIS_FAVORIS.filter((e) => !tousLesEmojis().includes(e))));

console.log("\nCE QUI NE DOIT PAS PASSER — le champ ne doit jamais devenir du texte libre");
verifier("un mot est refuse", !emojiValide("coucou"));
verifier("une phrase est refusee", !emojiValide("salut les gars"));
verifier("un chiffre est refuse", !emojiValide("42"));
verifier("une lettre seule est refusee", !emojiValide("a"));
verifier("un emoji suivi d'un mot est refuse", !emojiValide("🔥 arnaque"));
verifier("le vide est refuse", !emojiValide(""));
verifier("un espace est refuse", !emojiValide(" "));
verifier("de la ponctuation seule est refusee", !emojiValide("..."));
verifier("un texte trop long est refuse", !emojiValide("🔥".repeat(20)));
verifier("un saut de ligne est refuse", !emojiValide("🔥\n🔥"));

console.log("\nCE QUI DOIT PASSER");
verifier("un emoji simple", emojiValide("🔥"));
verifier("un emoji avec variante", emojiValide("❤️"));
verifier("un emoji compose (teinte de peau)", emojiValide("👏🏽"));
verifier("un emoji compose (famille)", emojiValide("👨‍👩‍👧"));
verifier("un drapeau", emojiValide("🇫🇷"));

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
