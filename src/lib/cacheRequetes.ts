/**
 * CACHE PARTAGÉ ENTRE LES PAGES
 * =============================
 * Le site est une application d'une seule page : passer de l'Accueil au
 * Classement ne recharge pas le navigateur, mais monte un nouveau composant —
 * qui redemandait jusqu'ici les MÊMES données à la base, pour son propre
 * compte. Un joueur qui fait Accueil → Pronos → Classement → Stats
 * téléchargeait quatre fois tous les pronostics de tous les joueurs.
 *
 * Ce cache vit en mémoire, pour la durée de la session. Volontairement PAS
 * dans le stockage du navigateur : à 200 joueurs le lot de pronostics pèse
 * 10 Mo, et le sérialiser à chaque écriture coûterait plus cher que la
 * requête qu'on cherche à éviter.
 *
 * DEUX GARANTIES, et elles comptent autant l'une que l'autre :
 *
 *  - Rien n'est servi périmé au-delà de sa durée de vie. Elle est courte
 *    (une minute) : un pronostic enregistré par quelqu'un d'autre apparaît
 *    au pire une minute plus tard.
 *  - Ses propres écritures sont visibles TOUT DE SUITE. Le cache est vidé
 *    explicitement à chaque enregistrement ou suppression de pronostic ;
 *    sans cela, un joueur validerait sa journée et ne la verrait pas.
 *
 * Le direct n'est jamais mis en cache : les scores en cours viennent d'une
 * autre source (src/lib/liveMatches.ts), qui ne passe pas par ici.
 */

type Entree = {
  expiration: number;
  valeur: unknown;
};

const entrees = new Map<string, Entree>();

/** Requêtes déjà en vol : deux pages montées ensemble n'en lancent qu'une. */
const enVol = new Map<string, Promise<unknown>>();

/** Une minute : assez pour couvrir une navigation, trop court pour égarer. */
export const DUREE_PAR_DEFAUT = 60_000;

/**
 * Renvoie la valeur en cache si elle est encore valable, sinon exécute
 * `charger` et la mémorise.
 *
 * Si une requête identique est déjà en cours, on attend celle-là au lieu
 * d'en lancer une seconde — c'est le cas exact de deux composants montés
 * en même temps sur la même page.
 */
export async function avecCache<T>(
  cle: string,
  charger: () => Promise<T>,
  duree: number = DUREE_PAR_DEFAUT,
): Promise<T> {
  const maintenant = Date.now();

  const existante = entrees.get(cle);
  if (existante && existante.expiration > maintenant) {
    return existante.valeur as T;
  }

  const dejaEnCours = enVol.get(cle);
  if (dejaEnCours) return dejaEnCours as Promise<T>;

  const promesse = (async () => {
    try {
      const valeur = await charger();
      entrees.set(cle, { expiration: Date.now() + duree, valeur });
      return valeur;
    } finally {
      enVol.delete(cle);
    }
  })();

  enVol.set(cle, promesse);
  return promesse as Promise<T>;
}

/**
 * Oublie ce qui a été mémorisé. Sans argument, tout ; avec un préfixe, les
 * seules clés qui commencent par lui.
 *
 * À appeler après CHAQUE écriture : un joueur doit voir son propre pronostic
 * immédiatement, pas au bout d'une minute.
 */
export function viderCache(prefixe?: string) {
  if (!prefixe) {
    entrees.clear();
    enVol.clear();
    return;
  }
  [...entrees.keys()].forEach((cle) => {
    if (cle.startsWith(prefixe)) entrees.delete(cle);
  });
  [...enVol.keys()].forEach((cle) => {
    if (cle.startsWith(prefixe)) enVol.delete(cle);
  });
}

/** Pour les vérifications : ce que le cache contient à cet instant. */
export function etatCache() {
  return {
    entrees: entrees.size,
    enVol: enVol.size,
    cles: [...entrees.keys()],
  };
}
