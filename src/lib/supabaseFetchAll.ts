import { supabase } from "./supabase";
import { avecCache, viderCache } from "./cacheRequetes";

// PostgREST plafonne toute requête non paginée (Supabase : 1000 lignes par
// défaut). La troncature est SILENCIEUSE : pas d'erreur, juste des lignes
// manquantes — d'où des pages qui affichaient 0 point et "0 pronostic" alors
// que le Classement, lui, filtrait ses requêtes en base et restait sous le
// seuil.
//
// Cette fonction pagine explicitement jusqu'à épuisement. L'ordre est
// OBLIGATOIRE et doit être stable (colonnes uniques ou clé composite),
// sinon deux pages successives peuvent renvoyer la même ligne ou en sauter.
const PAGE_SIZE = 1000;

// Garde-fou : au-delà, on considère qu'une pagination part en boucle plutôt
// que de charger indéfiniment.
const MAX_PAGES = 200;

/**
 * Version mise en cache. C'est celle que les pages doivent appeler.
 *
 * Meme signature, meme resultat. La difference : deux pages qui demandent la
 * meme chose pendant la meme minute ne la telechargent qu'une fois — et si
 * elles la demandent EN MEME TEMPS, une seule requete part.
 *
 * Mesure sur le site construit, un joueur qui fait Accueil -> Classement ->
 * Stats : trois lots complets de pronostics telecharges, pour trois fois les
 * memes lignes.
 */
export async function fetchAllRowsCache<T = any>(
  table: string,
  columns: string,
  orderBy: string[],
): Promise<{ data: T[] | null; error: any }> {
  const cle = `${table}|${columns}|${orderBy.join(",")}`;
  const resultat = await avecCache(cle, () => fetchAllRows<T>(table, columns, orderBy));
  // Une erreur n'est jamais mémorisée : on ne veut pas la resservir pendant
  // une minute a toutes les pages.
  if (resultat.error) viderCache(cle);
  return resultat;
}

/**
 * Meme pagination, mais filtree sur une liste de valeurs (`column in (...)`).
 *
 * Sert aux statistiques d'une journee : les pronostics de TOUS les joueurs
 * sur la douzaine de matchs affiches. A 23 joueurs cela tient largement sous
 * la limite, mais a 100 joueurs (23 x 14 = 322 lignes contre 100 x 14 = 1400)
 * la requete simple serait tronquee EN SILENCE a 1000 lignes et les
 * pourcentages afficheraient n'importe quoi sans le moindre message d'erreur.
 */
export async function fetchAllRowsIn<T = any>(
  table: string,
  columns: string,
  orderBy: string[],
  column: string,
  values: string[],
): Promise<{ data: T[] | null; error: any }> {
  if (values.length === 0) return { data: [], error: null };

  return fetchAllRows<T>(table, columns, orderBy, (query) => query.in(column, values));
}

export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  orderBy: string[],
  filtre?: (query: any) => any,
): Promise<{ data: T[] | null; error: any }> {
  if (orderBy.length === 0) {
    return { data: null, error: new Error(`fetchAllRows(${table}) : ordre stable requis`) };
  }

  return paginer<T>(table, async (from, to) => {
    let query = supabase.from(table).select(columns).range(from, to);

    // Le filtre s'applique AVANT l'ordre et la pagination : chaque page est
    // alors une tranche du resultat filtre, jamais de la table entiere.
    if (filtre) query = filtre(query);

    orderBy.forEach((column) => {
      query = query.order(column, { ascending: true });
    });

    return query;
  });
}

/**
 * La boucle de pagination, isolee de Supabase pour etre verifiable.
 *
 * `chargerPage(from, to)` doit renvoyer la tranche demandee. La boucle
 * s'arrete a la premiere page incomplete — c'est la seule facon de savoir
 * qu'on a tout lu, PostgREST ne disant pas combien de lignes restent.
 *
 * Testee par npm run verif-pagination.
 */
export async function paginer<T = any>(
  table: string,
  chargerPage: (from: number, to: number) => Promise<{ data: any; error: any }>,
  pageSize: number = PAGE_SIZE,
  maxPages: number = MAX_PAGES,
): Promise<{ data: T[] | null; error: any }> {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;

    const { data, error } = await chargerPage(from, from + pageSize - 1);
    if (error) return { data: null, error };

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    // Page incomplète = dernière page.
    if (batch.length < pageSize) return { data: rows, error: null };
  }

  return {
    data: null,
    error: new Error(
      `fetchAllRows(${table}) : plus de ${maxPages * pageSize} lignes, pagination interrompue`,
    ),
  };
}
