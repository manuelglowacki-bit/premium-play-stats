/**
 * Verification des controles de la saison.
 *   npm run verif-controles
 *
 * Deux exigences, et la seconde compte autant que la premiere :
 *   1. reperer ce qui casse reellement les points ou les rappels ;
 *   2. NE RIEN dire quand tout va bien, ou quand la donnee manque. Un panneau
 *      qui crie tout le temps ne se lit plus.
 */
import {
  DELAI_RESULTAT_MS,
  compterAlertes,
  controlerSaison,
  type EntreeControles,
} from "./controlesSaison";

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

const MAINTENANT = new Date("2026-08-28T18:42:00Z").getTime();
const HEURE = 3600_000;
const JOUR = 24 * HEURE;

/** Une saison en bon ordre : aucun controle ne doit rien trouver. */
function saisonSaine(): EntreeControles {
  return {
    joueurs: [
      { id: "u1", pseudo: "Red Evils", favorite_team_id: "t1" },
      { id: "u2", pseudo: "Mel11", favorite_team_id: "t2" },
    ],
    journees: [
      { id: "j1", number: 1, deadline_mode: "auto_minus_1" },
      { id: "j2", number: 2, deadline_mode: "auto_minus_1" },
    ],
    matchs: [
      {
        id: "m1",
        matchday_id: "j1",
        kickoff: new Date(MAINTENANT - 7 * JOUR).toISOString(),
        home_team: "Paris",
        away_team: "Marseille",
        home_score: 2,
        away_score: 1,
      },
      {
        id: "m2",
        matchday_id: "j2",
        kickoff: new Date(MAINTENANT + HEURE).toISOString(),
        home_team: "Lens",
        away_team: "Lyon",
        home_score: null,
        away_score: null,
      },
    ],
    optionsBonus: [
      { matchday_id: "j1", match_id: "b1", is_active: true },
      { matchday_id: "j2", match_id: "b2", is_active: true },
    ],
    paiements: [
      { user_id: "u1", paid: true, amount: 10 },
      { user_id: "u2", paid: true, amount: 10 },
    ],
    joignables: new Set(["u1", "u2"]),
    maintenant: MAINTENANT,
  };
}

const idsDe = (e: EntreeControles) => controlerSaison(e).map((c) => c.id);

console.log("\n=== 1. Silence quand tout va bien ===\n");

verifier(
  "Saison saine : aucun controle declenche",
  idsDe(saisonSaine()).length === 0,
  JSON.stringify(idsDe(saisonSaine())),
);

verifier(
  "Un match a venir sans score n'est PAS une anomalie",
  !idsDe(saisonSaine()).includes("resultats-manquants"),
);

{
  // Match termine il y a une heure : la synchronisation a le droit d'etre en
  // retard, on ne crie pas tout de suite.
  const e = saisonSaine();
  e.matchs.push({
    id: "m3",
    matchday_id: "j2",
    kickoff: new Date(MAINTENANT - HEURE).toISOString(),
    home_team: "Nice",
    away_team: "Rennes",
    home_score: null,
    away_score: null,
  });
  verifier(
    "Match fini il y a 1 h sans score : encore tolere",
    !idsDe(e).includes("resultats-manquants"),
  );
}

console.log("\n=== 2. Resultats manquants ===\n");

{
  const e = saisonSaine();
  e.matchs.push({
    id: "m3",
    matchday_id: "j1",
    kickoff: new Date(MAINTENANT - (DELAI_RESULTAT_MS + HEURE)).toISOString(),
    home_team: "Nice",
    away_team: "Rennes",
    home_score: null,
    away_score: null,
  });
  const c = controlerSaison(e).find((x) => x.id === "resultats-manquants");
  verifier("Match fini depuis plus de 3 h sans score : signale", !!c);
  verifier("...en critique", c?.gravite === "critique");
  verifier(
    "...avec le nom du match et sa journee",
    c?.elements[0] === "J1 · Nice – Rennes",
    c?.elements[0],
  );
}

{
  // Un score partiel (un seul cote renseigne) est aussi un score manquant.
  const e = saisonSaine();
  e.matchs.push({
    id: "m3",
    matchday_id: "j1",
    kickoff: new Date(MAINTENANT - 2 * JOUR).toISOString(),
    home_team: "Nice",
    away_team: "Rennes",
    home_score: 1,
    away_score: null,
  });
  verifier("Score a moitie saisi : signale aussi", idsDe(e).includes("resultats-manquants"));
}

{
  // Le vrai piege : la base contient les championnats etrangers en entier.
  const e = saisonSaine();
  for (let i = 0; i < 200; i += 1) {
    e.matchs.push({
      id: `etranger${i}`,
      matchday_id: null,
      kickoff: new Date(MAINTENANT - 30 * JOUR).toISOString(),
      home_team: "Club A",
      away_team: "Club B",
      home_score: null,
      away_score: null,
    });
  }
  verifier(
    "200 matchs etrangers sans score, jamais proposes : ignores",
    !idsDe(e).includes("resultats-manquants"),
  );

  // Sauf celui qui a servi de bonus.
  e.optionsBonus = [
    ...(e.optionsBonus ?? []),
    { matchday_id: "j1", match_id: "etranger7", is_active: true },
  ];
  const c = controlerSaison(e).find((x) => x.id === "resultats-manquants");
  verifier(
    "Le match etranger REELLEMENT propose en bonus, lui, est signale",
    c?.elements.length === 1,
    JSON.stringify(c?.elements),
  );
  verifier(
    "...et annonce comme bonus",
    c?.elements[0]?.startsWith("Bonus ·") === true,
    c?.elements[0],
  );
}

console.log("\n=== 3. Journees qui ne se verrouillent jamais ===\n");

{
  const e = saisonSaine();
  e.journees[1] = { id: "j2", number: 2, deadline_mode: "manual", deadline: null };
  const c = controlerSaison(e).find((x) => x.id === "journees-sans-verrou");
  verifier("Mode manuel sans date, journee a venir : critique", c?.gravite === "critique");
  verifier("...la bonne journee est nommee", c?.elements[0] === "Journée 2", c?.elements[0]);
}

{
  const e = saisonSaine();
  e.journees[1] = {
    id: "j2",
    number: 2,
    deadline_mode: "manual",
    deadline: new Date(MAINTENANT + HEURE).toISOString(),
  };
  verifier("Mode manuel AVEC date : rien a signaler", !idsDe(e).includes("journees-sans-verrou"));
}

{
  // Journee passee sans verrou : regrettable, mais plus rien a corriger.
  const e = saisonSaine();
  e.journees[0] = { id: "j1", number: 1, deadline_mode: "manual", deadline: null };
  verifier(
    "Journee deja jouee sans date limite : on n'encombre pas la liste",
    !idsDe(e).includes("journees-sans-verrou"),
  );
}

console.log("\n=== 4. Bonus non publie ===\n");

{
  const e = saisonSaine();
  e.optionsBonus = [{ matchday_id: "j1", match_id: "b1", is_active: true }];
  const c = controlerSaison(e).find((x) => x.id === "bonus-manquant");
  verifier(
    "Journee a venir sans bonus : signale",
    c?.elements[0] === "Journée 2",
    JSON.stringify(c?.elements),
  );
  verifier("...en attention, pas en critique", c?.gravite === "attention");
}

{
  const e = saisonSaine();
  e.optionsBonus = [
    { matchday_id: "j1", match_id: "b1", is_active: true },
    { matchday_id: "j2", match_id: "b2", is_active: false },
  ];
  verifier(
    "Un tirage bonus desactive ne compte pas comme publie",
    idsDe(e).includes("bonus-manquant"),
  );
}

{
  const e = saisonSaine();
  e.optionsBonus = null;
  verifier(
    "Options bonus pas encore chargees : le controle se tait (ne pas savoir n'est pas une anomalie)",
    !idsDe(e).includes("bonus-manquant"),
  );
}

console.log("\n=== 5. Joueurs ===\n");

{
  const e = saisonSaine();
  e.joueurs = [
    { id: "u1", pseudo: "Red Evils", favorite_team_id: "t1" },
    { id: "u2", pseudo: "Mel11", favorite_team_id: null },
    { id: "u3", pseudo: null, favorite_team_id: null },
  ];
  e.joignables = new Set(["u1", "u2", "u3"]);
  e.paiements = [];
  const c = controlerSaison(e).find((x) => x.id === "sans-equipe-coeur");
  verifier("Deux joueurs sans equipe de coeur", c?.elements.length === 2);
  verifier(
    "...classes par ordre alphabetique, pseudo vide compris",
    JSON.stringify(c?.elements) === JSON.stringify(["Mel11", "Sans pseudo"]),
    JSON.stringify(c?.elements),
  );
}

{
  const e = saisonSaine();
  e.joignables = new Set(["u1"]);
  const c = controlerSaison(e).find((x) => x.id === "sans-notifications");
  verifier("Joueur sans notification : signale", c?.elements[0] === "Mel11");
  verifier("...accord au singulier", c?.titre.includes("ne reçoit") === true, c?.titre);
  verifier("...en info : rien n'est casse, c'est son choix", c?.gravite === "info");
}

{
  const e = saisonSaine();
  e.joignables = null;
  verifier(
    "Information Push indisponible : le controle se tait",
    !idsDe(e).includes("sans-notifications"),
  );
}

console.log("\n=== 6. Paiements ===\n");

{
  const e = saisonSaine();
  e.paiements = [
    { user_id: "u1", paid: true, amount: 10 },
    { user_id: "u2", paid: false, amount: 10 },
    { user_id: "inconnu", paid: false, amount: 10 },
  ];
  const c = controlerSaison(e).find((x) => x.id === "paiements-en-attente");
  verifier("Deux paiements en attente", c?.elements.length === 2);
  verifier("...le total est affiche", c?.titre.includes("20 €") === true, c?.titre);
  verifier(
    "...un paiement sans joueur connu ne fait pas planter",
    c?.elements.includes("Joueur inconnu") === true,
    JSON.stringify(c?.elements),
  );
}

console.log("\n=== 7. Pastille de l'onglet ===\n");

{
  const e = saisonSaine();
  e.journees[1] = { id: "j2", number: 2, deadline_mode: "manual", deadline: null };
  e.joueurs = [{ id: "u1", pseudo: "Red Evils", favorite_team_id: null }];
  e.joignables = new Set([]);
  e.paiements = [{ user_id: "u1", paid: false, amount: 10 }];

  const controles = controlerSaison(e);
  verifier(
    "Quatre constats au total",
    controles.length === 4,
    JSON.stringify(controles.map((c) => c.id)),
  );
  verifier(
    "Mais seuls les deux vrais problemes comptent pour la pastille",
    compterAlertes(controles) === 2,
    String(compterAlertes(controles)),
  );
  verifier("Le plus grave est en tete", controles[0].gravite === "critique");
}

verifier("Saison saine : pastille a zero", compterAlertes(controlerSaison(saisonSaine())) === 0);

console.log("\n=== 8. Cas limites ===\n");

{
  const vide: EntreeControles = {
    joueurs: [],
    journees: [],
    matchs: [],
    optionsBonus: [],
    paiements: [],
    joignables: new Set(),
    maintenant: MAINTENANT,
  };
  verifier(
    "Base entierement vide : aucun controle, aucune erreur",
    controlerSaison(vide).length === 0,
  );
}

{
  const e = saisonSaine();
  e.matchs.push({
    id: "m9",
    matchday_id: "j1",
    kickoff: null,
    home_team: "Sans",
    away_team: "Date",
    home_score: null,
    away_score: null,
  });
  verifier(
    "Match sans coup d'envoi : ignore plutot que signale a tort",
    !idsDe(e).includes("resultats-manquants"),
  );
}

{
  const e = saisonSaine();
  e.matchs.push({
    id: "m9",
    matchday_id: "j1",
    kickoff: "pas une date",
    home_team: "Date",
    away_team: "Illisible",
    home_score: null,
    away_score: null,
  });
  verifier("Coup d'envoi illisible : ignore", !idsDe(e).includes("resultats-manquants"));
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
