/**
 * Verification de la boucle de pagination.
 *   npm run verif-pagination
 *
 * PostgREST plafonne toute requete a 1000 lignes et NE LE DIT PAS : pas
 * d'erreur, pas d'avertissement, juste des lignes qui manquent. Ce projet
 * s'est deja fait avoir — le classement calculait les points de tout le monde
 * sur un lot tronque. C'est donc la boucle qu'il faut verrouiller, pas le
 * calcul qui vient apres.
 */
import { paginer } from "./supabaseFetchAll";

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

/** Une fausse table de `n` lignes, qui se comporte comme PostgREST. */
function table(n: number, pageSize: number) {
  const lignes = Array.from({ length: n }, (_, i) => ({ i }));
  const appels: [number, number][] = [];

  return {
    appels,
    charger: async (from: number, to: number) => {
      appels.push([from, to]);
      // PostgREST ne renvoie jamais plus que la taille de page demandee.
      const tranche = lignes.slice(from, Math.min(to + 1, from + pageSize));
      return { data: tranche, error: null };
    },
  };
}

console.log("\n=== 1. Tout est lu, quelle que soit la taille ===\n");

for (const n of [0, 1, 999, 1000, 1001, 2000, 2500]) {
  const t = table(n, 1000);
  const { data, error } = await paginer<{ i: number }>("predictions", t.charger, 1000, 200);
  verifier(
    `${String(n).padStart(4)} lignes -> ${data?.length ?? "erreur"} lues en ${t.appels.length} requete(s)`,
    !error && data?.length === n,
    error ? String(error) : `obtenu ${data?.length}`,
  );
}

console.log("\n=== 2. Aucune ligne perdue ni dupliquee ===\n");

{
  const t = table(2500, 1000);
  const { data } = await paginer<{ i: number }>("predictions", t.charger, 1000, 200);
  const vus = new Set((data ?? []).map((l) => l.i));
  verifier("2500 lignes distinctes, aucun doublon", vus.size === 2500);
  verifier(
    "L'ordre est conserve",
    (data ?? []).every((l, index) => l.i === index),
  );
  verifier(
    "Les tranches demandees s'enchainent sans trou",
    JSON.stringify(t.appels) ===
      JSON.stringify([
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ]),
    JSON.stringify(t.appels),
  );
}

console.log("\n=== 3. Une page pleine ne fait jamais croire que c'est fini ===\n");

{
  // Le piege : 1000 lignes pile. Une boucle naive s'arrete la et croit avoir
  // tout lu, alors qu'il faut redemander pour savoir qu'il ne reste rien.
  const t = table(1000, 1000);
  const { data } = await paginer<{ i: number }>("predictions", t.charger, 1000, 200);
  verifier(
    "1000 lignes pile : une seconde requete confirme la fin",
    data?.length === 1000 && t.appels.length === 2,
    `${data?.length} lignes en ${t.appels.length} requete(s)`,
  );
}

console.log("\n=== 4. Erreurs et garde-fou ===\n");

{
  const { data, error } = await paginer("predictions", async () => ({
    data: null,
    error: new Error("reseau coupe"),
  }));
  verifier("Une erreur remonte telle quelle, sans donnees partielles", data === null && !!error);
}

{
  // Une page toujours pleine : sans garde-fou, la boucle tournerait sans fin.
  let appels = 0;
  const { data, error } = await paginer(
    "predictions",
    async () => {
      appels += 1;
      return { data: Array.from({ length: 10 }, (_, i) => ({ i })), error: null };
    },
    10,
    5,
  );
  verifier(
    "Pagination sans fin : arret au plafond, avec une erreur explicite",
    data === null && !!error && appels === 5,
    `${appels} appels, error=${error}`,
  );
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
