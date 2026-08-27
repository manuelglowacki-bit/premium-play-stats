/**
 * REPARTITION 1 / N / 2 DES MATCHS DE LIGUE 1
 *
 * Meme idee que la repartition des choix bonus, appliquee a chaque match de
 * la journee : sous les trois boutons, la part des joueurs ayant pris la
 * victoire a domicile, le nul, la victoire a l'exterieur.
 *
 * Le denominateur est, comme pour le bonus, le nombre de joueurs ayant
 * REELLEMENT pronostique CE match — jamais l'effectif total. Un match que
 * trois joueurs seulement ont rempli affiche donc 67/33/0, pas 9/4/0.
 * Chaque match a son propre denominateur : ils ne se remplissent pas tous
 * au meme rythme.
 */

import { repartirCent } from "./pourcentages";

export type Issue = "1" | "N" | "2";

export type PredictionMatch = {
  user_id: string | null;
  match_id: string | null;
  home_prediction: number | null;
  away_prediction: number | null;
  created_at?: string | null;
};

export type RepartitionMatch = {
  /** Nombre de joueurs par issue. */
  comptes: Record<Issue, number>;
  /** Pourcentages, somme = 100 des qu'au moins un joueur a pronostique. */
  pourcentages: Record<Issue, number>;
  /** Denominateur : joueurs ayant pronostique ce match. */
  joueurs: number;
};

/** Meme regle que derivePick dans la page Pronos et que le calcul des points. */
export function issueDuScore(home: number, away: number): Issue {
  if (home > away) return "1";
  if (home < away) return "2";
  return "N";
}

const VIDE = (): RepartitionMatch => ({
  comptes: { "1": 0, N: 0, "2": 0 },
  pourcentages: { "1": 0, N: 0, "2": 0 },
  joueurs: 0,
});

/**
 * @param predictions Les pronostics de TOUS les joueurs, pour n'importe quels
 *   matchs — la fonction range elle-meme chaque ligne sous son match.
 * @returns Une entree par match rencontre. Un match sans aucun pronostic
 *   n'apparait pas : l'appelant retombe sur `repartitionVide()`.
 */
export function repartition1N2(predictions: PredictionMatch[]): Record<string, RepartitionMatch> {
  // UN SEUL PRONOSTIC PAR JOUEUR ET PAR MATCH, LE PLUS RECENT — meme regle
  // que le classement (src/lib/leaderboardStats.ts) et que la repartition
  // bonus : une ligne laissee par un changement d'avis ne doit pas compter
  // deux fois, sans quoi la somme depasse 100 %.
  const dernier = new Map<string, { createdAt: number; issue: Issue; matchId: string }>();

  for (const prediction of predictions) {
    if (!prediction?.user_id || !prediction?.match_id) continue;
    if (prediction.home_prediction == null || prediction.away_prediction == null) continue;

    const matchId = String(prediction.match_id);
    const cle = `${prediction.user_id}:${matchId}`;
    const createdAt = prediction.created_at ? new Date(prediction.created_at).getTime() : 0;
    const precedent = dernier.get(cle);

    if (!precedent || createdAt >= precedent.createdAt) {
      dernier.set(cle, {
        createdAt,
        matchId,
        issue: issueDuScore(Number(prediction.home_prediction), Number(prediction.away_prediction)),
      });
    }
  }

  const comptesParMatch: Record<string, Record<Issue, number>> = {};

  for (const { matchId, issue } of dernier.values()) {
    const comptes = comptesParMatch[matchId] ?? { "1": 0, N: 0, "2": 0 };
    comptes[issue] += 1;
    comptesParMatch[matchId] = comptes;
  }

  const resultat: Record<string, RepartitionMatch> = {};

  for (const [matchId, comptes] of Object.entries(comptesParMatch)) {
    const pourcentages = repartirCent(comptes) as Record<Issue, number>;
    resultat[matchId] = {
      comptes,
      pourcentages,
      joueurs: comptes["1"] + comptes.N + comptes["2"],
    };
  }

  return resultat;
}

/** Valeur de repli pour un match que personne n'a encore pronostique. */
export function repartitionVide(): RepartitionMatch {
  return VIDE();
}
