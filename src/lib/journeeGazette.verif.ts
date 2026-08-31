/**
 * Verification du choix de journee de la Gazette.
 *   npm run verif-journee-gazette
 */
import { choisirJourneeGazette, type JourneeCandidate } from "./journeeGazette";

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

const t = (iso: string) => new Date(iso).getTime();

// Saison : J1 le samedi 22 aout, J2 le samedi 29 aout, J3 le samedi 5 septembre.
const J1: JourneeCandidate = { id: "j1", numero: 1, premierCoupDEnvoi: t("2026-08-22T19:00:00Z"), clesDeDate: ["2026-08-22", "2026-08-23"] };
const J2: JourneeCandidate = { id: "j2", numero: 2, premierCoupDEnvoi: t("2026-08-29T19:00:00Z"), clesDeDate: ["2026-08-29", "2026-08-30"] };
const J3: JourneeCandidate = { id: "j3", numero: 3, premierCoupDEnvoi: t("2026-09-05T19:00:00Z"), clesDeDate: ["2026-09-05", "2026-09-06"] };
const SAISON = [J1, J2, J3];

console.log("\nQUELLE JOURNEE LA GAZETTE RACONTE");
console.log("=".repeat(64));

egal("aucune journee : rien a raconter", choisirJourneeGazette([], t("2026-08-31T09:00:00Z"), "2026-08-31"), null);

console.log("\nUn jour de match");
egal("le samedi de la J2", choisirJourneeGazette(SAISON, t("2026-08-29T20:00:00Z"), "2026-08-29"), "j2");
egal("le dimanche de la J2", choisirJourneeGazette(SAISON, t("2026-08-30T17:00:00Z"), "2026-08-30"), "j2");

console.log("\nLes jours creux — le defaut corrige");
egal("lundi apres la J2 : on reste sur la J2, pas la J3",
  choisirJourneeGazette(SAISON, t("2026-08-31T09:00:00Z"), "2026-08-31"), "j2");
egal("mercredi : toujours la J2", choisirJourneeGazette(SAISON, t("2026-09-02T12:00:00Z"), "2026-09-02"), "j2");
egal("jeudi soir : toujours la J2", choisirJourneeGazette(SAISON, t("2026-09-03T22:00:00Z"), "2026-09-03"), "j2");
egal("vendredi, veille de J3 sans match : encore la J2",
  choisirJourneeGazette(SAISON, t("2026-09-04T12:00:00Z"), "2026-09-04"), "j2");
egal("samedi de la J3 : on bascule enfin",
  choisirJourneeGazette(SAISON, t("2026-09-05T10:00:00Z"), "2026-09-05"), "j3");

console.log("\nDebut et fin de saison");
egal("avant le premier match : la J1 a venir",
  choisirJourneeGazette(SAISON, t("2026-08-10T12:00:00Z"), "2026-08-10"), "j1");
egal("apres la derniere journee : on reste dessus",
  choisirJourneeGazette(SAISON, t("2026-09-20T12:00:00Z"), "2026-09-20"), "j3");
egal("des journees sans date : dernier recours sur le numero",
  choisirJourneeGazette(
    [{ id: "x", numero: 1, premierCoupDEnvoi: NaN, clesDeDate: [] },
     { id: "y", numero: 2, premierCoupDEnvoi: NaN, clesDeDate: [] }],
    t("2026-08-31T09:00:00Z"), "2026-08-31"),
  "y");

console.log("\nL'ordre d'arrivee ne doit rien changer");
egal("saison melangee, lundi apres la J2",
  choisirJourneeGazette([J3, J1, J2], t("2026-08-31T09:00:00Z"), "2026-08-31"), "j2");

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
