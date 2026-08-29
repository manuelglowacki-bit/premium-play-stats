/**
 * Verification du choix de la journee ouverte sur la page Pronos.
 *   npm run verif-journee-courante
 *
 * Le cas qui a declenche tout ceci est reproduit tel quel plus bas : Accueil
 * annoncant « ouverture de la J2 dans 2 minutes » et page Pronos affichant
 * « Journee 3 ».
 */
import {
  DUREE_MEMOIRE,
  choisirJournee,
  dateVerrouillage,
  fermetureEnCours,
  journeeOuverte,
  type JourneeChoisissable,
  type MatchChoisissable,
} from "./journeeCourante";

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
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );
}

const AUTO = "auto_minus_1";

// Le calendrier reel de la saison 2026-2027 au 28 aout a 20h42.
const MAINTENANT = new Date("2026-08-28T18:42:00Z").getTime(); // 20h42 a Paris

const J1: JourneeChoisissable = { id: "j1", number: 1, deadline_mode: AUTO };
const J2: JourneeChoisissable = { id: "j2", number: 2, deadline_mode: AUTO };
const J3: JourneeChoisissable = { id: "j3", number: 3, deadline_mode: AUTO };
const JOURNEES = [J1, J2, J3];

function m(journee: string, kickoff: string, finished: boolean): MatchChoisissable {
  return { matchday_id: journee, kickoff, finished };
}

const MATCHS: MatchChoisissable[] = [
  // J1 : 21 au 23 aout, terminee.
  m("j1", "2026-08-21T18:45:00Z", true),
  m("j1", "2026-08-23T15:00:00Z", true),
  // J2 : premier match le 28 aout a 20h45 (dans 3 minutes), le reste le week-end.
  m("j2", "2026-08-28T18:45:00Z", false),
  m("j2", "2026-08-29T15:00:00Z", false),
  m("j2", "2026-08-30T19:45:00Z", false),
  // J3 : le week-end suivant.
  m("j3", "2026-09-04T18:45:00Z", false),
  m("j3", "2026-09-06T15:00:00Z", false),
];

console.log("\n=== 1. Le cas reel : 28 aout, 20h42 ===\n");

egal(
  "Sans memoire, la page s'ouvre sur la J2 — comme l'Accueil",
  choisirJournee(JOURNEES, MATCHS, null, MAINTENANT),
  "j2",
);

egal(
  "AVEC l'ancienne memoire figee sur la J3, on revient quand meme sur la J2",
  choisirJournee(JOURNEES, MATCHS, { id: "j3", a: MAINTENANT - 3 * 24 * 3600_000 }, MAINTENANT),
  "j2",
);

egal(
  "Un aller-retour vers le classement il y a 5 minutes garde la J3 choisie",
  choisirJournee(JOURNEES, MATCHS, { id: "j3", a: MAINTENANT - 5 * 60_000 }, MAINTENANT),
  "j3",
);

egal(
  "Juste avant la peremption (1h59) : memoire respectee",
  choisirJournee(
    JOURNEES,
    MATCHS,
    { id: "j3", a: MAINTENANT - (DUREE_MEMOIRE - 60_000) },
    MAINTENANT,
  ),
  "j3",
);

egal(
  "Juste apres (2h01) : on recalcule",
  choisirJournee(
    JOURNEES,
    MATCHS,
    { id: "j3", a: MAINTENANT - (DUREE_MEMOIRE + 60_000) },
    MAINTENANT,
  ),
  "j2",
);

console.log("\n=== 2. Le piege : la journee entamee ===\n");

{
  // 21h00 le 28 aout : le premier match de la J2 a commence. L'Accueil est
  // deja passe a la J3 — mais le joueur a encore neuf matchs a remplir.
  const pendantJ2 = new Date("2026-08-28T19:00:00Z").getTime();
  egal(
    "Premier match de la J2 lance : on RESTE sur la J2, pas sur la J3",
    choisirJournee(JOURNEES, MATCHS, null, pendantJ2),
    "j2",
  );
}

{
  // Lundi 31 aout : toute la J2 est jouee, la J3 est la prochaine a remplir.
  const apresJ2 = new Date("2026-08-31T10:00:00Z").getTime();
  egal(
    "Journee 2 entierement jouee : on passe a la J3",
    choisirJournee(JOURNEES, MATCHS, null, apresJ2),
    "j3",
  );
}

console.log("\n=== 3. L'ancien bug de repli ===\n");

{
  // Un seul match de J1 dont le resultat n'a pas ete synchronise. L'ancienne
  // regle (« premiere journee avec un match pas termine ») ramenait le joueur
  // sur la J1 alors qu'il n'y peut plus rien.
  const matchsAvecTrou = MATCHS.map((match, index) =>
    index === 1 ? { ...match, finished: false } : match,
  );
  egal(
    "Un resultat de J1 non synchronise ne ramene plus en arriere",
    choisirJournee(JOURNEES, matchsAvecTrou, null, MAINTENANT),
    "j2",
  );
}

console.log("\n=== 4. Fin de saison et cas limites ===\n");

{
  // Saison finie : plus aucune fermeture a venir, et tous les resultats sont
  // tombes. (La premiere version de ce test laissait les matchs `finished:
  // false` : le repli « journee en cours » repondait alors la J2, et il avait
  // raison — c'etait le jeu d'essai qui decrivait un mois de juin ou aucun
  // match n'aurait ete joue.)
  const finDeSaison = new Date("2027-06-01T10:00:00Z").getTime();
  const saisonJouee = MATCHS.map((match) => ({ ...match, finished: true }));
  egal(
    "Plus rien d'ouvert ni en cours : derniere journee",
    choisirJournee(JOURNEES, saisonJouee, null, finDeSaison),
    "j3",
  );
  // Dans MATCHS, la J1 est entierement synchronisee et la J2 ne l'est pas :
  // c'est donc la J2 que le repli « journee en cours » designe.
  egal(
    "Saison finie mais des resultats manquants : on montre la premiere journee incomplete",
    choisirJournee(JOURNEES, MATCHS, null, finDeSaison),
    "j2",
  );
}

egal("Aucune journee : rien a choisir", choisirJournee([], MATCHS, null, MAINTENANT), null);

egal(
  "Aucun match synchronise : on ne plante pas, on prend la derniere",
  choisirJournee(JOURNEES, [], null, MAINTENANT),
  "j3",
);

egal(
  "Memoire pointant une journee qui n'existe plus : ignoree",
  choisirJournee(JOURNEES, MATCHS, { id: "j99", a: MAINTENANT - 60_000 }, MAINTENANT),
  "j2",
);

egal(
  "Memoire datee du futur (horloge remise a l'heure) : ignoree",
  choisirJournee(JOURNEES, MATCHS, { id: "j3", a: MAINTENANT + 3600_000 }, MAINTENANT),
  "j2",
);

console.log("\n=== 5. Date de fermeture d'un match ===\n");

egal(
  "Mode automatique : coup d'envoi moins une minute",
  dateVerrouillage({ kickoff: "2026-08-28T18:45:00Z" }, J2)?.toISOString(),
  "2026-08-28T18:44:00.000Z",
);

egal(
  "Mode manuel : la date limite de la journee",
  dateVerrouillage(
    { kickoff: "2026-08-28T18:45:00Z" },
    { id: "x", number: 9, deadline_mode: "manual", deadline: "2026-08-28T17:00:00Z" },
  )?.toISOString(),
  "2026-08-28T17:00:00.000Z",
);

egal(
  "Mode manuel sans date limite : aucune fermeture connue",
  dateVerrouillage({ kickoff: "2026-08-28T18:45:00Z" }, { id: "x", number: 9 }),
  null,
);

egal(
  "Sans coup d'envoi : la date limite de la journee seule",
  dateVerrouillage(
    { kickoff: null },
    { id: "x", number: 9, deadline_mode: AUTO, deadline: "2026-08-28T17:00:00Z" },
  )?.toISOString(),
  "2026-08-28T17:00:00.000Z",
);

egal(
  "Coup d'envoi illisible : aucune fermeture",
  dateVerrouillage({ kickoff: "pas une date" }, J2),
  null,
);

verifier(
  "Une journee sans fermeture connue n'est jamais consideree ouverte",
  !journeeOuverte(
    { id: "x", number: 9 },
    [{ matchday_id: "x", kickoff: "2027-01-01T12:00:00Z", finished: false }],
    MAINTENANT,
  ),
);

console.log("\n=== 6. Accueil : l'echeance de la journee en cours ===\n");

{
  // Vendredi 20h46 : le premier match de la J2 vient de commencer, il en
  // reste trois. L'Accueil annoncait la J3 « dans 6 jours ».
  const vendrediSoir = new Date("2026-08-28T18:46:00Z").getTime();
  const e = fermetureEnCours(JOURNEES, MATCHS, vendrediSoir);
  egal("Journee 2 entamee : c'est elle qu'on annonce", e?.journee, 2);
  egal(
    "...et l'echeance est la fermeture du PROCHAIN match, pas du dernier",
    e ? new Date(e.at).toISOString() : null,
    "2026-08-29T14:59:00.000Z",
  );
}

{
  // Jeudi : rien n'a commence, l'Accueil garde son « ouverture de la J2 ».
  const jeudi = new Date("2026-08-27T10:00:00Z").getTime();
  egal("Aucune journee commencee : rien a annoncer ici", fermetureEnCours(JOURNEES, MATCHS, jeudi), null);
}

{
  // Lundi : la J2 est finie, la J3 n'a pas commence.
  const lundi = new Date("2026-08-31T10:00:00Z").getTime();
  egal("Journee terminee : plus d'echeance", fermetureEnCours(JOURNEES, MATCHS, lundi), null);
}

{
  // Le dernier match de la J2 est a 19h45 : il se ferme a 19h44 pile.
  const dimanche = new Date("2026-08-30T19:43:59Z").getTime();
  const e = fermetureEnCours(JOURNEES, MATCHS, dimanche);
  egal("Une seconde avant la derniere fermeture : on l'annonce encore", e?.journee, 2);
  const apres = fermetureEnCours(JOURNEES, MATCHS, dimanche + 62_000);
  egal("Une seconde apres la fermeture : plus rien", apres, null);
}

{
  // Mode manuel sans date limite : aucune fermeture connue, donc rien a
  // annoncer — plutot qu'une date inventee.
  const sansVerrou = JOURNEES.map((j) => (j.id === "j2" ? { ...j, deadline_mode: "manual" } : j));
  const vendrediSoir = new Date("2026-08-28T18:46:00Z").getTime();
  egal("Journee sans date limite : rien a annoncer", fermetureEnCours(sansVerrou, MATCHS, vendrediSoir), null);
}

{
  egal("Aucun match synchronise : rien, aucune erreur", fermetureEnCours(JOURNEES, [], MAINTENANT), null);
  egal("Aucune journee : rien", fermetureEnCours([], MATCHS, MAINTENANT), null);
}

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
