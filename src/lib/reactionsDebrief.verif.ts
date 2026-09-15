/**
 * Verification des reactions du Debrief.
 *   npm run verif-reactions
 */
import {
  EMOJIS_DEBRIEF,
  apresLeGeste,
  emojiAutorise,
  gesteAuClic,
  reactionsParArticle,
  type LigneReaction,
} from "./reactionsDebrief";

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

console.log("\nLES REACTIONS DU DEBRIEF");
console.log("=".repeat(64));

const MOI = "moi";
const AUTRE = "autre";

console.log("\nLes emojis autorises");
egal("douze emojis", EMOJIS_DEBRIEF.length, 12);
// LES SIX D'ORIGINE doivent survivre a tout elargissement : en retirer un
// effacerait de fait les reactions deja posees avec, qui cesseraient d'etre
// comptees.
["👏", "🔥", "😮", "😂", "😢", "💪"].forEach((emoji) =>
  verifier(`${emoji} — emoji d'origine, toujours accepte`, emojiAutorise(emoji)),
);
verifier("aucun emoji en double", new Set(EMOJIS_DEBRIEF).size === EMOJIS_DEBRIEF.length,
  JSON.stringify(EMOJIS_DEBRIEF));
verifier("un nouvel emoji passe", emojiAutorise("🐐"));
verifier("un autre emoji est refuse", !emojiAutorise("🍕"));
verifier("du texte est refuse", !emojiAutorise("coucou"));
verifier("le vide est refuse", !emojiAutorise(""));

console.log("\nLe comptage");
const lignes: LigneReaction[] = [
  { user_id: MOI,   journee: 4, article: "leader", emoji: "🔥" },
  { user_id: AUTRE, journee: 4, article: "leader", emoji: "🔥" },
  { user_id: "c",   journee: 4, article: "leader", emoji: "👏" },
  { user_id: MOI,   journee: 4, article: "chiffre", emoji: "😮" },
  // Une autre journee : ne doit pas se melanger a celle affichee.
  { user_id: MOI,   journee: 3, article: "leader", emoji: "😂" },
  // Un emoji devenu invalide : ignore plutot qu'affiche.
  { user_id: "d",   journee: 4, article: "leader", emoji: "🍕" },
];

const r = reactionsParArticle(lignes, 4, MOI);
egal("les compteurs d'un article", r.get("leader")!.comptes, { "🔥": 2, "👏": 1 });
egal("le total de l'article", r.get("leader")!.total, 3);
egal("ma reaction est reconnue", r.get("leader")!.lemien, "🔥");
egal("un autre article a les siens", r.get("chiffre")!.comptes, { "😮": 1 });
verifier("une autre journee n'est pas comptee",
  !JSON.stringify([...r.entries()]).includes("😂"), JSON.stringify([...r.entries()]));
verifier("un emoji hors liste n'est pas compte",
  !JSON.stringify([...r.entries()]).includes("🍕"));
egal("sans joueur connecte, aucune reaction n'est « la mienne »",
  reactionsParArticle(lignes, 4, null).get("leader")!.lemien, null);
egal("aucune ligne : aucun article", [...reactionsParArticle([], 4, MOI).entries()], []);

console.log("\nCe qu'un clic doit faire");
egal("aucune reaction : on ajoute", gesteAuClic(null, "🔥"), { action: "ajouter", emoji: "🔥" });
egal("le meme emoji : on retire", gesteAuClic("🔥", "🔥"), { action: "retirer" });
egal("un autre emoji : on remplace", gesteAuClic("🔥", "👏"), { action: "remplacer", emoji: "👏" });
egal("un emoji hors liste : on ne fait rien", gesteAuClic(null, "🍕"), { action: "rien" });

console.log("\nL'affichage immediat, avant la reponse du serveur");
const depart = { comptes: { "🔥": 2, "👏": 1 }, lemien: "🔥", total: 3 };

{
  const apres = apresLeGeste(depart, { action: "retirer" });
  egal("retirer : mon emoji perd une voix", apres.comptes, { "🔥": 1, "👏": 1 });
  egal("retirer : le total baisse", apres.total, 2);
  egal("retirer : je n'ai plus de reaction", apres.lemien, null);
}
{
  const apres = apresLeGeste(depart, { action: "remplacer", emoji: "👏" });
  egal("remplacer : l'ancien perd, le nouveau gagne", apres.comptes, { "🔥": 1, "👏": 2 });
  egal("remplacer : le total ne bouge pas", apres.total, 3);
  egal("remplacer : c'est le nouveau qui est le mien", apres.lemien, "👏");
}
{
  const vierge = { comptes: {}, lemien: null, total: 0 };
  const apres = apresLeGeste(vierge, { action: "ajouter", emoji: "💪" });
  egal("ajouter sur un article vide", apres, { comptes: { "💪": 1 }, lemien: "💪", total: 1 });
}
{
  // Le dernier a retirer sa reaction ne doit pas laisser « 🔥 0 » affiche.
  const seul = { comptes: { "🔥": 1 }, lemien: "🔥", total: 1 };
  egal("le dernier retrait efface le compteur",
    apresLeGeste(seul, { action: "retirer" }), { comptes: {}, lemien: null, total: 0 });
}
{
  // L'etat precedent doit rester intact : si l'enregistrement echoue, on le
  // remet tel quel.
  const avant = { comptes: { "🔥": 2 }, lemien: "🔥", total: 2 };
  apresLeGeste(avant, { action: "remplacer", emoji: "👏" });
  egal("l'etat d'origine n'est pas modifie", avant, { comptes: { "🔥": 2 }, lemien: "🔥", total: 2 });
}
egal("un article jamais touche part de zero",
  apresLeGeste(undefined, { action: "ajouter", emoji: "👏" }),
  { comptes: { "👏": 1 }, lemien: "👏", total: 1 });

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
