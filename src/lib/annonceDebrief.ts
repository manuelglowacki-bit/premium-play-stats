/**
 * « LE DEBRIEF DE LA JOURNEE EST EN LIGNE ».
 *
 * Le Debrief bascule tout seul sur la journee suivante une fois tous ses
 * matchs joues — donc le dimanche soir. Encore faut-il que les joueurs le
 * sachent : sans un mot sur l'Accueil, la page attend qu'on pense a elle.
 *
 * Ce qui est memorise : le numero de la derniere journee pour laquelle CE
 * joueur a deja vu l'annonce, dans son navigateur. Pas de table, pas de
 * colonne : le numero de journee est deja calcule a partir des matchs.
 * Consequence assumee, la meme que pour le passage de niveau : sur un
 * nouveau telephone, l'annonce se represente une fois.
 */

const PREFIXE = "prono:debrief-vu:";

/**
 * Faut-il annoncer un Debrief, et pour quelle journee ?
 *
 *   - aucune journee terminee : rien a annoncer ;
 *   - rien de memorise (premiere visite) : ON ANNONCE. Contrairement au
 *     passage de niveau, il n'y a ici aucun risque de dire une chose fausse
 *     — le Debrief de cette journee est bel et bien en ligne ;
 *   - journee plus recente que la derniere vue : on annonce ;
 *   - deja vue, ou plus ancienne : rien. Une correction de score qui ferait
 *     revenir le Debrief sur une journee anterieure ne doit pas rejouer une
 *     annonce deja lue.
 */
export function debriefAAnnoncer(
  journeeRacontee: number | null | undefined,
  derniereVue: number | null,
): number | null {
  if (journeeRacontee == null || !Number.isFinite(journeeRacontee)) return null;
  const journee = Math.floor(journeeRacontee);
  if (journee < 1) return null;

  if (derniereVue === null) return journee;
  if (!Number.isFinite(derniereVue)) return journee;

  return journee > Math.floor(derniereVue) ? journee : null;
}

/** La derniere journee dont ce joueur a vu l'annonce, ou null. */
export function lireDebriefVu(userId: string | null | undefined): number | null {
  if (!userId) return null;
  try {
    const brut = window.localStorage.getItem(PREFIXE + userId);
    if (brut === null) return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) && valeur >= 1 ? Math.floor(valeur) : null;
  } catch {
    // Navigation privee, stockage refuse : on ne sait pas. On annonce donc,
    // quitte a le refaire — mieux qu'un plantage pour une banniere.
    return null;
  }
}

/** Retient la journee annoncee, pour ne pas la reannoncer. */
export function memoriserDebriefVu(
  userId: string | null | undefined,
  journee: number,
): void {
  if (!userId || !Number.isFinite(journee) || journee < 1) return;
  try {
    window.localStorage.setItem(PREFIXE + userId, String(Math.floor(journee)));
  } catch {
    // Sans stockage, l'annonce se represente a la prochaine ouverture.
  }
}
