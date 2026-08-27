/**
 * SUIVI DES PAGES — quelles pages les joueurs utilisent
 *
 * Une visite est enregistrée au changement de page. Deux garde-fous :
 *
 *   1. UN COMPTAGE PAR PAGE ET PAR DEMI-HEURE. Sans cela, un aller-retour
 *      Classement -> Pronos -> Classement compterait trois visites, et une
 *      page qui se remonte toute seule (retour arrière, rafraîchissement)
 *      gonflerait ses chiffres. Ce qu'on veut mesurer, c'est « ce joueur a
 *      consulté cette page », pas « le composant s'est affiché ».
 *
 *   2. RIEN QUAND L'ONGLET EST CACHÉ. Même règle que les rafraîchissements
 *      (voir ongletVisible) : une application laissée ouverte en arrière-plan
 *      ne doit pas produire de trafic.
 *
 * Ce qui n'est jamais transmis : aucun paramètre d'URL, donc jamais un
 * identifiant de match, de journée ou de joueur consulté. Juste le chemin.
 */

/** Deux visites de la même page à moins de 30 minutes n'en font qu'une. */
export const FENETRE_ANTI_DOUBLON = 30 * 60_000;

/** Longueur maximale acceptée par la base (contrainte page_stats_page_check). */
const LONGUEUR_MAX = 39;

/**
 * Réduit une adresse à un chemin comptabilisable, ou `null` si elle ne l'est
 * pas. Même normalisation que la fonction SQL — les deux doivent tomber
 * d'accord, sinon on enverrait des appels que la base ignore en silence.
 */
export function normaliserChemin(chemin: unknown): string | null {
  if (typeof chemin !== "string") return null;

  let page = chemin.trim().toLowerCase();
  page = page.split("?")[0] ?? "";
  page = page.split("#")[0] ?? "";
  if (page.length > 1) page = page.replace(/\/+$/, "");
  if (page === "") return null;
  if (page.length > LONGUEUR_MAX) return null;
  if (!/^\/[a-z0-9/-]*$/.test(page)) return null;

  return page;
}

/**
 * Faut-il compter cette visite ?
 *
 * @param vues Dernière visite comptée par page, en millisecondes.
 */
export function doitCompter(
  page: string,
  maintenant: number,
  vues: Record<string, number>,
  fenetre: number = FENETRE_ANTI_DOUBLON,
): boolean {
  const derniere = vues[page];
  if (typeof derniere !== "number" || !Number.isFinite(derniere)) return true;
  // Une date dans le futur (horloge du téléphone remise à l'heure) ne doit pas
  // bloquer le comptage jusqu'à ce qu'elle soit rattrapée.
  if (derniere > maintenant) return true;
  return maintenant - derniere >= fenetre;
}
