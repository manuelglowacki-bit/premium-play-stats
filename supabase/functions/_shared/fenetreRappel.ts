/**
 * FENÊTRE DE RAPPEL
 * =================
 * Quels matchs sont « dans environ une heure », vus depuis l'instant présent.
 *
 * Extrait ici pour une raison précise : cette règle et la fréquence de la
 * tâche planifiée doivent rester COHÉRENTES. Si la tâche tourne moins souvent
 * que la fenêtre n'est large, des matchs passent entre deux passages et
 * personne n'est prévenu — sans la moindre erreur nulle part.
 *
 * La tâche tournait toutes les minutes avec une fenêtre de ±5 minutes : 43 200
 * réveils par mois, dont l'immense majorité pour ne rien faire, et une charge
 * constante sur la base. Elle tourne maintenant toutes les 10 minutes avec une
 * fenêtre de ±10 minutes : chaque match est vu par DEUX passages au moins.
 *
 * Être vu deux fois ne coûte rien : la table `prono_reminder_sent` porte une
 * contrainte d'unicité sur (user_id, match_id), donc personne n'est relancé
 * deux fois pour le même match.
 */

/** Minutes de part et d'autre de T−1h. Doit rester > à l'intervalle du cron. */
export const DEMI_FENETRE_MINUTES = 10;

/** Intervalle de la tâche planifiée, en minutes (cron : toutes les 10 min). */
export const INTERVALLE_CRON_MINUTES = 10;

export function targetWindow(now: Date) {
  const cible = new Date(now.getTime() + 60 * 60 * 1000);
  const marge = DEMI_FENETRE_MINUTES * 60 * 1000;

  return {
    from: new Date(cible.getTime() - marge),
    to: new Date(cible.getTime() + marge),
  };
}
