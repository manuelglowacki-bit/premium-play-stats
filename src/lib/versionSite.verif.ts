/**
 * Verification de la detection de nouvelle version.
 *   npm run verif-version
 *
 * La regle qui compte : au moindre doute, PAS de bandeau. Un faux positif
 * reviendrait en boucle apres chaque rechargement — bien pire qu'un bandeau
 * manquant, la nouvelle version etant de toute facon prise au prochain vrai
 * chargement.
 */
import {
  INTERVALLE_MINIMUM,
  doitVerifier,
  lireVersionPubliee,
  nouvelleVersion,
} from "./versionSite";

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

console.log("\n=== 1. Quand faut-il verifier ? ===\n");

verifier("Jamais verifie : on verifie", doitVerifier(1_000_000, 0));
verifier("Il y a 10 secondes : on ne verifie pas", !doitVerifier(1_010_000, 1_000_000));
verifier(
  "Il y a exactement 5 minutes : on verifie",
  doitVerifier(1_000_000 + INTERVALLE_MINIMUM, 1_000_000),
);
verifier(
  "Il y a 6 minutes : on verifie",
  doitVerifier(1_000_000 + INTERVALLE_MINIMUM + 60_000, 1_000_000),
);
verifier(
  "Dix retours au premier plan dans la minute : une seule verification",
  [0, 5_000, 10_000, 20_000, 40_000].filter((decalage) =>
    doitVerifier(1_000_000 + decalage, 1_000_000),
  ).length === 0,
);

console.log("\n=== 2. Faut-il proposer le rechargement ? ===\n");

verifier("Versions differentes : oui", nouvelleVersion("abc123", "def456"));
verifier("Versions identiques : non", !nouvelleVersion("abc123", "abc123"));
verifier("Espaces autour : toujours la meme version", !nouvelleVersion("abc123", " abc123 "));

console.log("\n  -- au moindre doute, non --\n");

verifier("Version publiee introuvable (null) : non", !nouvelleVersion("abc123", null));
verifier("Reponse non textuelle : non", !nouvelleVersion("abc123", { version: 1 }));
verifier("Nombre au lieu d'une chaine : non", !nouvelleVersion("abc123", 42));
verifier("Version publiee vide : non", !nouvelleVersion("abc123", "   "));
verifier("Version embarquee vide : non", !nouvelleVersion("", "def456"));
verifier(
  "En developpement (embarquee = dev) : jamais de bandeau",
  !nouvelleVersion("dev", "def456"),
);
verifier("Fichier de developpement servi en production : non", !nouvelleVersion("abc123", "dev"));

console.log("\n=== 3. Lecture du fichier publie ===\n");

function fauxFetch(reponse: Partial<Response> & { corps?: unknown }): typeof fetch {
  return (async (url: string) => {
    derniereUrl = String(url);
    return {
      ok: reponse.ok ?? true,
      json: async () => {
        if (reponse.corps instanceof Error) throw reponse.corps;
        return reponse.corps;
      },
    } as Response;
  }) as unknown as typeof fetch;
}

let derniereUrl = "";

{
  const v = await lireVersionPubliee(
    fauxFetch({ corps: { version: "abc123" } }),
    "/version.json",
    777,
  );
  verifier("Lecture normale", v === "abc123", `obtenu ${v}`);
  verifier(
    "L'adresse porte un parametre anti-cache",
    derniereUrl === "/version.json?t=777",
    derniereUrl,
  );
}

{
  const v = await lireVersionPubliee(fauxFetch({ ok: false, corps: {} }));
  verifier("404 : null, pas d'erreur", v === null);
}

{
  const v = await lireVersionPubliee(fauxFetch({ corps: new Error("JSON casse") }));
  verifier("JSON illisible (page de maintenance HTML) : null", v === null);
}

{
  const v = await lireVersionPubliee(fauxFetch({ corps: { version: "" } }));
  verifier("Champ version vide : null", v === null);
}

{
  const v = await lireVersionPubliee(fauxFetch({ corps: {} }));
  verifier("Champ version absent : null", v === null);
}

{
  const v = await lireVersionPubliee(fauxFetch({ corps: null }));
  verifier("Corps nul : null", v === null);
}

{
  // Hors ligne : fetch lui-meme echoue.
  const horsLigne = (async () => {
    throw new Error("Failed to fetch");
  }) as unknown as typeof fetch;
  const v = await lireVersionPubliee(horsLigne);
  verifier("Hors ligne : null, aucune exception qui remonte", v === null);
}

console.log("\n=== 4. Le scenario complet ===\n");

{
  // Le joueur iPhone qui n'a pas ferme l'application depuis mardi.
  const embarquee = "commit-de-mardi";
  const publiee = await lireVersionPubliee(fauxFetch({ corps: { version: "commit-de-vendredi" } }));
  verifier(
    "Deploiement passe pendant que l'appli dormait : bandeau",
    nouvelleVersion(embarquee, publiee),
  );
}

{
  // Le meme joueur, juste apres avoir recharge.
  const embarquee = "commit-de-vendredi";
  const publiee = await lireVersionPubliee(fauxFetch({ corps: { version: "commit-de-vendredi" } }));
  verifier("Apres rechargement : plus de bandeau", !nouvelleVersion(embarquee, publiee));
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
