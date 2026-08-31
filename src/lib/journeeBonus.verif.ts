/**
 * Verification du rattachement d'un match bonus a sa journee de Ligue 1.
 *   npm run verif-journee-bonus
 */
import { journeeParMatchBonus, type OptionBonus } from "./journeeBonus";

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

const J1 = "journee-1";
const J2 = "journee-2";
const M = "match-bonus";

console.log("\nRATTACHEMENT D'UN MATCH BONUS A SA JOURNEE");
console.log("=".repeat(64));

egal("aucune option : aucun rattachement",
  [...journeeParMatchBonus([]).entries()], []);

egal("une seule option : elle fait foi",
  journeeParMatchBonus([{ matchday_id: J1, match_id: M }]).get(M), J1);

// Le cas reel : le tirage a ete rejoue, l'ancien reste en base.
const rejoue: OptionBonus[] = [
  { matchday_id: J1, match_id: M, is_active: false, created_at: "2026-08-10T10:00:00Z" },
  { matchday_id: J2, match_id: M, is_active: true, created_at: "2026-08-20T10:00:00Z" },
];
egal("la ligne active tranche", journeeParMatchBonus(rejoue).get(M), J2);
egal("l'ordre de lecture ne change rien",
  journeeParMatchBonus([...rejoue].reverse()).get(M), J2);

egal("sans ligne active, la plus recente l'emporte",
  journeeParMatchBonus([
    { matchday_id: J1, match_id: M, is_active: false, created_at: "2026-08-10T10:00:00Z" },
    { matchday_id: J2, match_id: M, is_active: false, created_at: "2026-08-20T10:00:00Z" },
  ]).get(M), J2);

egal("colonnes absentes : la premiere lue, sans planter",
  journeeParMatchBonus([
    { matchday_id: J1, match_id: M },
    { matchday_id: J2, match_id: M },
  ]).get(M), J1);

egal("une seule ligne active parmi plusieurs inactives",
  journeeParMatchBonus([
    { matchday_id: J1, match_id: M, is_active: false, created_at: "2026-08-25T10:00:00Z" },
    { matchday_id: J2, match_id: M, is_active: true, created_at: "2026-08-01T10:00:00Z" },
    { matchday_id: J1, match_id: M, is_active: false, created_at: "2026-08-28T10:00:00Z" },
  ]).get(M),
  J2);

egal("deux matchs distincts gardent chacun leur journee",
  [...journeeParMatchBonus([
    { matchday_id: J1, match_id: "a", is_active: true },
    { matchday_id: J2, match_id: "b", is_active: true },
  ]).entries()].sort(),
  [["a", J1], ["b", J2]]);

// ==========================================================================
// L'ETIQUETTE D'UNE JOURNEE NE DOIT PAS VENIR D'UN MATCH BONUS
// ==========================================================================
// La page Stats regroupe ses journees par etiquette. Elle deduisait celle-ci
// du champ `matchday` du premier match rencontre — or pour un match bonus ce
// champ porte le numero de journee de SON championnat. Un bonus joue pendant
// la 1re journee de Premier League etiquetait la journee 2 de Ligue 1 en
// "J1", et les deux journees fusionnaient.
console.log("\nEtiquette d'une journee");

type Journee = { id: string; number: number };
const journees: Journee[] = [{ id: J1, number: 1 }, { id: J2, number: 2 }];

// La bonne methode : lire matchdays.number.
const etiquettes = new Map<string, string>();
journees.forEach((md) => etiquettes.set(md.id, `J${md.number}`));

egal("chaque journee garde son propre numero",
  [etiquettes.get(J1), etiquettes.get(J2)], ["J1", "J2"]);
verifier("deux journees ne peuvent pas partager la meme etiquette",
  new Set(etiquettes.values()).size === journees.length,
  `obtenu ${JSON.stringify([...etiquettes.values()])}`);

// L'ancienne methode, reproduite pour montrer ce qu'elle donnait.
const ancienne = new Map<string, string>();
[
  { matchdayIdResolu: J1, matchdayDuMatch: 1 }, // vrai match de Ligue 1, J1
  { matchdayIdResolu: J2, matchdayDuMatch: 1 }, // match BONUS : 1re journee de PL
].forEach((m) => {
  if (ancienne.has(m.matchdayIdResolu)) return;
  ancienne.set(m.matchdayIdResolu, `J${m.matchdayDuMatch}`);
});
verifier("l'ancienne methode donnait bien deux fois la meme etiquette",
  new Set(ancienne.values()).size === 1,
  `obtenu ${JSON.stringify([...ancienne.values()])} — le scenario ne reproduit plus le defaut`);

console.log("\n" + "=".repeat(64));
console.log(echecs === 0 ? `TOUT PASSE (${total} verifications)` : `${echecs} ECHEC(S) sur ${total}`);
if (echecs > 0) process.exit(1);
