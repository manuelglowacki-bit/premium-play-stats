/**
 * L'ANNONCE DE PASSAGE DE NIVEAU.
 *
 * Quand un joueur gagne un niveau de carriere, il doit le voir la prochaine
 * fois qu'il ouvre le site — une seule fois, pas a chaque visite.
 *
 * Ce qui est memorise : le dernier niveau DEJA ANNONCE a ce joueur, dans le
 * navigateur (localStorage). Pas de table, pas de colonne : le niveau lui-meme
 * est deja calcule a partir des points par src/lib/careerLevel.ts, il n'y a
 * rien de nouveau a stocker cote serveur. La consequence assumee : sur un
 * nouveau telephone, la premiere ouverture ne rejoue pas les annonces passees
 * (voir `niveauAAnnoncer`, cas "rien de memorise").
 *
 * La regle de decision est une fonction pure, verifiable sans navigateur.
 */

const PREFIXE = "prono:niveau-annonce:";

/**
 * Faut-il annoncer quelque chose, et quel niveau ?
 *
 *   - rien de memorise (premiere ouverture, nouveau telephone) : on
 *     n'annonce RIEN. Sans cette regle, tout le monde verrait une fausse
 *     "montee de niveau" a sa premiere visite, y compris un joueur de
 *     niveau 1 qui n'a jamais rien gagne ;
 *   - niveau actuel superieur au dernier annonce : on annonce ;
 *   - egal ou inferieur : rien. Inferieur ne devrait pas arriver, mais une
 *     correction de points peut faire redescendre un joueur : lui annoncer
 *     une montee serait absurde.
 */
export function niveauAAnnoncer(
  niveauActuel: number,
  dernierAnnonce: number | null,
): number | null {
  if (!Number.isFinite(niveauActuel)) return null;
  const actuel = Math.floor(niveauActuel);
  if (actuel < 1) return null;
  if (dernierAnnonce === null) return null;
  if (!Number.isFinite(dernierAnnonce)) return null;
  return actuel > Math.floor(dernierAnnonce) ? actuel : null;
}

/** Le dernier niveau annonce a ce joueur, ou null si on ne sait pas. */
export function lireNiveauMemorise(userId: string | null | undefined): number | null {
  if (!userId) return null;
  try {
    const brut = window.localStorage.getItem(PREFIXE + userId);
    if (brut === null) return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) && valeur >= 1 ? Math.floor(valeur) : null;
  } catch {
    // Navigation privee, stockage refuse : on ne sait pas, donc on n'annonce
    // rien. Jamais de plantage pour une banniere de felicitations.
    return null;
  }
}

/** Retient le niveau atteint, pour ne pas reannoncer le meme. */
export function memoriserNiveau(
  userId: string | null | undefined,
  niveau: number,
): void {
  if (!userId || !Number.isFinite(niveau) || niveau < 1) return;
  try {
    window.localStorage.setItem(PREFIXE + userId, String(Math.floor(niveau)));
  } catch {
    // Sans stockage, l'annonce se represente a la prochaine ouverture.
    // Genant, jamais grave.
  }
}
