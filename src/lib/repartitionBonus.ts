/**
 * REPARTITION DES CHOIX BONUS — « 🔥 40 % des joueurs »
 *
 * Le badge affiché sous chaque championnat de la page Pronos répondait mal
 * à la question qu'il pose. Il divisait le nombre de joueurs ayant choisi
 * CE match par le nombre TOTAL d'inscrits :
 *
 *     lundi, 5 joueurs sur 23 ont choisi
 *     -> 9 % / 9 % / 4 % / 0 %, soit 22 % en tout
 *
 * Quatre badges qui totalisent 22 % ne se lisent pas comme une répartition,
 * ils se lisent comme un bug — et c'était bien le retour reçu. Le même écran
 * consulté le vendredi soir, tout le monde ayant joué, affichait 39/30/17/13
 * et paraissait normal : ce n'était pas l'appareil qui changeait, c'était le
 * moment de la semaine.
 *
 * La bonne question est « parmi ceux qui ont choisi, combien ont pris
 * celui-là ? ». Le dénominateur est donc le nombre de joueurs AYANT
 * réellement fait un choix, et la somme des quatre badges vaut toujours
 * 100 % (voir repartirCent dans ./pourcentages pour l'arrondi).
 */

export { repartirCent } from "./pourcentages";

export type PredictionBonus = {
  user_id: string | null;
  match_id: string | null;
  created_at?: string | null;
};

export type RepartitionBonus = {
  /** Nombre de joueurs par match bonus. Toujours une clé par candidat, y
   * compris ceux que personne n'a pris (0) — sinon le badge disparaîtrait. */
  comptes: Record<string, number>;
  /** Dénominateur : joueurs ayant fait un choix, quel qu'il soit. */
  joueursAyantChoisi: number;
};

/**
 * UN SEUL CHOIX PAR JOUEUR, LE PLUS RECENT.
 *
 * Changer d'avis laisse parfois deux lignes en base (l'ancienne et la
 * nouvelle). Sans départage, un joueur indécis compterait double et la somme
 * dépasserait 100 %. On applique donc exactement la même règle que le
 * classement (src/lib/leaderboardStats.ts) : `created_at` le plus récent
 * l'emporte. Les quatre candidats appartenant à la même journée, cela
 * revient bien à « un bonus par joueur ».
 */
export function repartitionBonus(
  predictions: PredictionBonus[],
  matchIds: string[],
): RepartitionBonus {
  const candidats = new Set(matchIds.map(String));

  const comptes: Record<string, number> = {};
  for (const matchId of matchIds) comptes[String(matchId)] = 0;

  const dernierParJoueur = new Map<string, { createdAt: number; matchId: string }>();

  for (const prediction of predictions) {
    if (!prediction?.user_id || !prediction?.match_id) continue;

    const matchId = String(prediction.match_id);
    if (!candidats.has(matchId)) continue;

    const userId = String(prediction.user_id);
    const createdAt = prediction.created_at ? new Date(prediction.created_at).getTime() : 0;
    const precedent = dernierParJoueur.get(userId);

    // `>=` et non `>` : à date égale (ou deux dates absentes, donc 0 des deux
    // côtés) on garde la dernière ligne rencontrée, comme le classement.
    if (!precedent || createdAt >= precedent.createdAt) {
      dernierParJoueur.set(userId, { createdAt, matchId });
    }
  }

  for (const { matchId } of dernierParJoueur.values()) {
    comptes[matchId] = (comptes[matchId] ?? 0) + 1;
  }

  return { comptes, joueursAyantChoisi: dernierParJoueur.size };
}
