/**
 * NUMÉRO DE JOURNÉE D'UN MATCH
 * ============================
 * Trois colonnes peuvent le porter, selon d'où vient la ligne :
 * `matchday_code` (« J2 »), `matchday` (2) ou `match_day` (2). Toutes ne sont
 * pas renseignées, et laquelle l'est dépend de la façon dont le match a été
 * créé — import automatique, saisie manuelle, ou reprise d'une ancienne
 * version du site.
 *
 * Ne regarder qu'une partie d'entre elles ne provoque AUCUNE erreur : la
 * fonction renvoie simplement 0, le filtre ne trouve rien, et le bloc qui en
 * dépend disparaît de la page sans un mot. C'est exactement ce qui est arrivé
 * au rappel de l'accueil : il cherchait la journée sur `matchday` et
 * `match_day` seulement, alors que les matchs portaient `matchday_code`.
 *
 * D'où ce fichier : une seule façon de répondre à la question, partagée, et
 * vérifiée par npm run verif-journee.
 */

export type MatchAvecJournee = {
  matchday_code?: string | number | null;
  matchday?: string | number | null;
  match_day?: string | number | null;
};

/**
 * Le numéro de journée, ou 0 si aucune des trois colonnes ne le porte.
 *
 * On prend le PREMIER nombre trouvé dans la valeur : « J2 » donne 2, « 2 »
 * donne 2, « Journée 12 » donne 12.
 */
export function numeroDeJournee(match: MatchAvecJournee | null | undefined): number {
  if (!match) return 0;

  for (const valeur of [match.matchday_code, match.matchday, match.match_day]) {
    if (valeur === null || valeur === undefined || valeur === "") continue;
    const trouve = String(valeur).match(/\d+/);
    if (trouve) return Number(trouve[0]);
  }

  return 0;
}
