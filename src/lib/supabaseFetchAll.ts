import { supabase } from "./supabase";

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

export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  orderBy: string[],
): Promise<{ data: T[] | null; error: any }> {
  if (orderBy.length === 0) {
    return { data: null, error: new Error(`fetchAllRows(${table}) : ordre stable requis`) };
  }

  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;

    let query = supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    orderBy.forEach((column) => {
      query = query.order(column, { ascending: true });
    });

    const { data, error } = await query;
    if (error) return { data: null, error };

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    // Page incomplète = dernière page.
    if (batch.length < PAGE_SIZE) return { data: rows, error: null };
  }

  return {
    data: null,
    error: new Error(`fetchAllRows(${table}) : plus de ${MAX_PAGES * PAGE_SIZE} lignes, pagination interrompue`),
  };
}
