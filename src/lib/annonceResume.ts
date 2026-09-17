/**
 * QUAND MONTRER LA BULLE « TA JOURNEE ».
 *
 * Une fois par journee et par joueur, a sa premiere visite apres la fin de
 * la journee. Elle raconte SON week-end : ce n'est pas une notification a
 * repeter, c'est une nouvelle qu'on apprend une fois.
 *
 * Meme principe que l'annonce du Debrief (src/lib/annonceDebrief.ts) : le
 * numero de la derniere journee vue est garde dans le navigateur du joueur.
 * Ni table, ni colonne — le numero est deja calcule a partir des matchs, et
 * cette memoire ne regarde que celui qui l'a.
 *
 * Consequence assumee : sur un nouveau telephone, la bulle se represente une
 * fois. C'est sans gravite ici — elle ne dit rien de faux, juste quelque
 * chose de deja lu.
 */

const PREFIXE = "prono:resume-vu:";

/**
 * @param journee La journee racontee, ou null s'il n'y en a pas encore.
 * @param derniereVue Le numero deja memorise pour ce joueur, ou null.
 * @returns Le numero a montrer, ou null s'il n'y a rien a montrer.
 */
export function resumeAMontrer(
  journee: number | null | undefined,
  derniereVue: number | null,
): number | null {
  if (journee == null || !Number.isFinite(journee)) return null;
  const numero = Math.floor(journee);
  if (numero < 1) return null;

  // Premiere visite : on montre. Contrairement au passage de niveau, il n'y
  // a aucun risque de dire une chose fausse — cette journee a bien eu lieu.
  if (derniereVue === null || !Number.isFinite(derniereVue)) return numero;

  // Deja vue, ou plus ancienne : rien. Une correction de score qui ferait
  // revenir le classement sur une journee anterieure ne doit pas rouvrir
  // une bulle deja lue.
  return numero > Math.floor(derniereVue) ? numero : null;
}

export function lireResumeVu(userId: string | null | undefined): number | null {
  if (!userId) return null;
  try {
    const brut = window.localStorage.getItem(PREFIXE + userId);
    if (brut === null) return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) ? valeur : null;
  } catch {
    // Navigation privee, stockage refuse : la bulle se representera. Mieux
    // vaut la revoir qu'afficher une erreur.
    return null;
  }
}

export function memoriserResumeVu(userId: string | null | undefined, journee: number): void {
  if (!userId || !Number.isFinite(journee)) return;
  try {
    window.localStorage.setItem(PREFIXE + userId, String(Math.floor(journee)));
  } catch {
    /* sans stockage, la bulle reviendra — et c'est tout */
  }
}

/** Remet la bulle en attente pour ce compte seul (Admin -> Revoir les annonces). */
export function oublierResumeVu(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(PREFIXE + userId);
  } catch {
    /* rien a oublier si rien n'a pu etre ecrit */
  }
}
