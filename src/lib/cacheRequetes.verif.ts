/**
 * CACHE PARTAGÉ — VÉRIFICATIONS
 * =============================
 * `npm run verif-cache`
 *
 * Un cache qui sert des données périmées est pire que pas de cache : le joueur
 * enregistre son pronostic et ne le voit pas. Ces contrôles portent donc
 * d'abord sur ce que le cache doit REFUSER de garder.
 */

import { avecCache, viderCache, etatCache } from "./cacheRequetes";

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`OK    ${nom}`);
    return;
  }
  echecs += 1;
  console.log(`ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  viderCache();

  // ---------- 1. Une seule requête pour deux demandes ----------
  {
    let appels = 0;
    const charger = async () => {
      appels += 1;
      return "valeur";
    };
    await avecCache("a", charger);
    await avecCache("a", charger);
    verifier("deux demandes successives = une seule requête", appels === 1, `appels=${appels}`);
  }

  // ---------- 2. Deux demandes EN MÊME TEMPS ----------
  // C'est le cas reel : deux composants montes ensemble sur la meme page.
  {
    let appels = 0;
    const charger = async () => {
      appels += 1;
      await attendre(30);
      return "valeur";
    };
    viderCache();
    await Promise.all([avecCache("b", charger), avecCache("b", charger), avecCache("b", charger)]);
    verifier("trois demandes simultanées = une seule requête", appels === 1, `appels=${appels}`);
  }

  // ---------- 3. La durée de vie est respectée ----------
  {
    let appels = 0;
    const charger = async () => {
      appels += 1;
      return appels;
    };
    viderCache();
    const premier = await avecCache("c", charger, 40);
    await attendre(70);
    const second = await avecCache("c", charger, 40);
    verifier("passé sa durée de vie, on recharge", premier === 1 && second === 2, `${premier} puis ${second}`);
  }

  // ---------- 4. Une écriture rend la main immédiatement ----------
  // Le point le plus important : sans lui, un joueur validerait sa journee
  // sans la voir apparaitre.
  {
    let valeur = "avant";
    const charger = async () => valeur;
    viderCache();
    const premier = await avecCache("d", charger, 60_000);
    valeur = "apres";
    viderCache();
    const second = await avecCache("d", charger, 60_000);
    verifier(
      "après vidage, la nouvelle valeur est servie tout de suite",
      premier === "avant" && second === "apres",
      `${premier} puis ${second}`,
    );
  }

  // ---------- 5. Le vidage par préfixe ne touche que sa famille ----------
  {
    viderCache();
    await avecCache("predictions|x", async () => 1, 60_000);
    await avecCache("matches|x", async () => 2, 60_000);
    viderCache("predictions");
    const restantes = etatCache().cles;
    verifier(
      "vider un préfixe laisse le reste en place",
      restantes.length === 1 && restantes[0] === "matches|x",
      restantes.join(","),
    );
  }

  // ---------- 6. Une erreur n'est jamais mémorisée ----------
  {
    viderCache();
    let appels = 0;
    const charger = async () => {
      appels += 1;
      throw new Error("panne réseau");
    };
    await avecCache("e", charger).catch(() => {});
    await avecCache("e", charger).catch(() => {});
    verifier("une requête en échec est retentée, pas mémorisée", appels === 2, `appels=${appels}`);
  }

  console.log(echecs === 0 ? "\nTOUT PASSE" : `\n${echecs} ECHEC(S)`);
  process.exit(echecs === 0 ? 0 : 1);
}

void principal();
