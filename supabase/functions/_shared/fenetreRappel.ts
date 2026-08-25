/**
 * FENÊTRE DE RAPPEL — LA RÈGLE, ET SA VÉRIFICATION
 * ================================================
 * Quels matchs sont « dans environ une heure », vus depuis l'instant présent.
 *
 * Extrait ici pour une raison précise : cette règle et la fréquence de la
 * tâche planifiée doivent rester COHÉRENTES. Si la tâche tourne moins souvent
 * que la fenêtre n'est large, des matchs passent entre deux passages et
 * personne n'est prévenu — sans la moindre erreur nulle part.
 *
 * La tâche tournait toutes les MINUTES avec une fenêtre de ±5 minutes : 43 200
 * réveils par mois, dont l'immense majorité pour ne rien faire, et une charge
 * constante sur la base. Elle tourne maintenant toutes les 5 minutes, fenêtre
 * inchangée : chaque match reste vu par DEUX passages au moins.
 *
 * POURQUOI 5 ET NON 10 : passer à 10 minutes aurait imposé d'élargir la
 * fenêtre, donc de redéployer les 534 lignes de la fonction. Pour 10 % de
 * réveils en moins, ça ne valait pas le risque d'une manipulation de plus.
 * À 5 minutes, la fenêtre actuelle (±5, soit 10 minutes de large) garde déjà
 * sa marge de deux passages, et le changement tient dans un script SQL.
 *
 * Les valeurs ci-dessous doivent rester le reflet exact de la fonction
 * déployée (supabase/functions/send-prono-reminders/index.ts) et du programme
 * de la tâche. `npm run verif-rappels` contrôle qu'elles restent cohérentes
 * entre elles ET avec le code réel de la fonction.
 *
 * Être vu deux fois ne coûte rien : la table `prono_reminder_sent` porte une
 * contrainte d'unicité sur (user_id, match_id), donc personne n'est relancé
 * deux fois pour le même match.
 */

/** Minutes de part et d'autre de T−1h. Doit rester > à l'intervalle du cron. */
export const DEMI_FENETRE_MINUTES = 5;

/** Intervalle de la tâche planifiée, en minutes (cron : toutes les 5 min). */
export const INTERVALLE_CRON_MINUTES = 5;

export function targetWindow(now: Date) {
  const cible = new Date(now.getTime() + 60 * 60 * 1000);
  const marge = DEMI_FENETRE_MINUTES * 60 * 1000;

  return {
    from: new Date(cible.getTime() - marge),
    to: new Date(cible.getTime() + marge),
  };
}
