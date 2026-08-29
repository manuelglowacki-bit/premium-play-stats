/**
 * Verification de l'annonce a tous.
 *   npm run verif-annonce
 */
import { LONGUEUR_MAX, TITRE_PAR_DEFAUT, preparerAnnonce, resumerEnvoi } from "./annonce";

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
    `obtenu ${JSON.stringify(obtenu)}`,
  );
}

console.log("\n=== 1. Message accepte ===\n");

egal("Message normal", preparerAnnonce("La J2 est ouverte, pensez a vos pronos !"), {
  ok: true,
  titre: TITRE_PAR_DEFAUT,
  corps: "La J2 est ouverte, pensez a vos pronos !",
});

egal(
  "Retours a la ligne et espaces multiples ramenes a une espace",
  preparerAnnonce("La J2\n\nest   ouverte"),
  { ok: true, titre: TITRE_PAR_DEFAUT, corps: "La J2 est ouverte" },
);

egal("Titre personnalise", preparerAnnonce("Pensez aux 10 euros", "Paiements"), {
  ok: true,
  titre: "Paiements",
  corps: "Pensez aux 10 euros",
});

egal("Titre vide : on retombe sur le nom du site", preparerAnnonce("Message", "   "), {
  ok: true,
  titre: TITRE_PAR_DEFAUT,
  corps: "Message",
});

{
  const r = preparerAnnonce("Message", "u".repeat(80));
  verifier("Titre demesure : coupe a 40 caracteres", r.ok && r.titre.length === 40);
}

{
  const r = preparerAnnonce("a".repeat(LONGUEUR_MAX));
  verifier("Pile la longueur maximale : accepte", r.ok === true);
}

console.log("\n=== 2. Message refuse ===\n");

verifier("Message vide", preparerAnnonce("").ok === false);
verifier("Que des espaces", preparerAnnonce("     ").ok === false);
verifier("Que des retours a la ligne", preparerAnnonce("\n\n\n").ok === false);
verifier("Valeur nulle", preparerAnnonce(null).ok === false);
verifier("Valeur non textuelle", preparerAnnonce(42).ok === false);

{
  const r = preparerAnnonce("a".repeat(LONGUEUR_MAX + 1));
  verifier("Un caractere de trop : refuse", r.ok === false);
  verifier(
    "...et l'erreur dit combien",
    !r.ok && r.erreur.includes(String(LONGUEUR_MAX + 1)),
    !r.ok ? r.erreur : "",
  );
}

{
  // Les espaces sont compresses AVANT de mesurer : un texte aere n'est pas
  // refuse pour rien.
  const r = preparerAnnonce("a".repeat(LONGUEUR_MAX - 1) + "     ");
  verifier("Espaces en trop a la fin : ne font pas depasser", r.ok === true);
}

console.log("\n=== 3. Resume honnete de l'envoi ===\n");

egal(
  "Tout le monde touche",
  resumerEnvoi({ demandes: 23, reussis: 23, echoues: 0 }),
  "Annonce envoyée à 23 joueurs.",
);
egal(
  "Un seul joueur",
  resumerEnvoi({ demandes: 1, reussis: 1, echoues: 0 }),
  "Annonce envoyée à 1 joueur.",
);
egal(
  "Des joueurs injoignables : c'est dit, pas cache",
  resumerEnvoi({ demandes: 23, reussis: 15, echoues: 8 }),
  "Annonce envoyée à 15 joueurs — 8 n'ont rien reçu (notifications désactivées).",
);
egal(
  "Un seul injoignable : accord au singulier",
  resumerEnvoi({ demandes: 2, reussis: 1, echoues: 1 }),
  "Annonce envoyée à 1 joueur — 1 n'a rien reçu (notifications désactivées).",
);
egal(
  "Aucun envoi reussi : on ne pretend pas le contraire",
  resumerEnvoi({ demandes: 23, reussis: 0, echoues: 23 }),
  "Aucune notification n'est partie. Vérifie que ces joueurs ont activé les notifications.",
);
egal(
  "Personne a qui envoyer",
  resumerEnvoi({ demandes: 0, reussis: 0, echoues: 0 }),
  "Personne à qui envoyer.",
);

console.log("\n" + "=".repeat(60));
if (echecs === 0) {
  console.log(`${total}/${total} verifications passees.`);
  console.log("=".repeat(60) + "\n");
} else {
  console.log(`${echecs} ECHEC(S) sur ${total}.`);
  console.log("=".repeat(60) + "\n");
  process.exit(1);
}
