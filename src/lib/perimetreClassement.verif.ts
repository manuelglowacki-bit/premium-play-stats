/**
 * Verification du perimetre d'un classement.
 *   npm run verif-perimetre
 */
import {
  journeesDeLaSaison,
  matchsDuClassement,
  optionsBonusDuClassement,
} from "./perimetreClassement";

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

console.log("\nLE PERIMETRE D'UN CLASSEMENT");
console.log("=".repeat(64));

const L1 = "competition-l1";
const PL = "competition-pl";

console.log("\nLes journees de la saison");
const journees = [
  { id: "j1-2627", season: "2026-2027", competition_id: L1 },
  { id: "j2-2627", season: "2026-2027", competition_id: L1 },
  { id: "j1-2526", season: "2025-2026", competition_id: L1 },  // saison passee
  { id: "j1-pl",   season: "2026-2027", competition_id: PL },  // championnat bonus
  { id: "sans-compet", season: "2026-2027", competition_id: null },
  { id: "sans-saison", season: null, competition_id: L1 },
];

egal("la saison passee est ecartee",
  [...journeesDeLaSaison(journees, "2026-2027")].sort(),
  ["j1-2627", "j1-pl", "j2-2627", "sans-saison"]);
verifier("les championnats bonus restent dans le perimetre",
  journeesDeLaSaison(journees, "2026-2027").has("j1-pl"));
verifier("une journee sans competition est ecartee",
  !journeesDeLaSaison(journees, "2026-2027").has("sans-compet"));
// Une ancienne ligne sans saison ne doit pas faire disparaitre des points
// deja marques : on la garde, comme le fait la page Classement.
verifier("une journee sans saison renseignee est conservee",
  journeesDeLaSaison(journees, "2026-2027").has("sans-saison"));
egal("saison inconnue : on ne filtre pas sur elle plutot que tout vider",
  [...journeesDeLaSaison(journees, "")].length, 5);
egal("aucune journee", [...journeesDeLaSaison([], "2026-2027")], []);

console.log("\nLes matchs du classement");
const perimetre = journeesDeLaSaison(journees, "2026-2027");
const matchs = [
  { id: "a", matchday_id: "j1-2627", is_bonus: false },
  { id: "b", matchday_id: "j1-2627", is_bonus: true },   // match bonus
  { id: "c", matchday_id: "j1-2526", is_bonus: false },  // saison passee
  { id: "d", matchday_id: null, is_bonus: false },
  { id: "e", matchday_id: "j2-2627" },                   // is_bonus absent
];
egal("seuls les matchs de la saison, hors bonus",
  matchsDuClassement(matchs, perimetre).map((m) => m.id), ["a", "e"]);
verifier("un match bonus n'est jamais compte comme match de championnat",
  !matchsDuClassement(matchs, perimetre).some((m) => m.id === "b"));
verifier("un match de la saison passee non plus",
  !matchsDuClassement(matchs, perimetre).some((m) => m.id === "c"));
verifier("is_bonus absent vaut « ce n'est pas un bonus »",
  matchsDuClassement(matchs, perimetre).some((m) => m.id === "e"));

console.log("\nLes lignes bonus");
const options = [
  { match_id: "x", matchday_id: "j1-2627" },
  { match_id: "y", matchday_id: "j1-2526" },
  { match_id: "z", matchday_id: null },
];
egal("seules celles de la saison en cours",
  optionsBonusDuClassement(options, perimetre).map((o) => o.match_id), ["x"]);

console.log("\nLE DEFAUT REPRODUIT — deux saisons qui s'additionnent");
{
  // Sans filtre de saison, les deux « journees 1 » se retrouvent ensemble :
  // c'est ce qui donnait 51 points la ou le Classement en affichait 25.
  const sansFiltre = matchs.filter((m) => m.is_bonus !== true && m.matchday_id);
  verifier("l'ancienne methode gardait bien les deux saisons",
    sansFiltre.some((m) => m.matchday_id === "j1-2526") &&
    sansFiltre.some((m) => m.matchday_id === "j1-2627"),
    JSON.stringify(sansFiltre.map((m) => m.id)));
  verifier("la nouvelle n'en garde qu'une",
    !matchsDuClassement(matchs, perimetre).some((m) => m.matchday_id === "j1-2526"));
}

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
