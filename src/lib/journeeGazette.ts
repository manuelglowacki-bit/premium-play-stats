/**
 * QUELLE JOURNEE LA GAZETTE RACONTE.
 *
 * Regle, dans cet ordre :
 *
 *   1. une journee a un match AUJOURD'HUI  -> c'est elle ;
 *   2. sinon, la derniere journee DEJA COMMENCEE — la Gazette continue de
 *      raconter le week-end ecoule pendant les jours creux ;
 *   3. sinon (avant le premier match de la saison), la prochaine a venir ;
 *   4. sinon, la journee au plus grand numero.
 *
 * Le point 2 est celui qui a change : la Gazette sautait a la journee
 * SUIVANTE des le lundi. Or entre deux journees — souvent du lundi au jeudi —
 * cette journee-la n'a aucun match joue : la page n'avait rien a raconter, et
 * le week-end disparaissait avant que les joueurs aient pu le lire.
 *
 * Fonction pure : aucune date implicite, `maintenant` et `cleDuJour` sont
 * fournis par l'appelant. Elle ne calcule aucun point.
 */
export type JourneeCandidate = {
  id: string;
  /** Numero de journee, pour le dernier recours. */
  numero: number;
  /** Coup d'envoi le plus tot de la journee (ms). NaN si inconnu. */
  premierCoupDEnvoi: number;
  /** Les dates locales (AAAA-MM-JJ) des matchs de cette journee. */
  clesDeDate: readonly string[];
};

export function choisirJourneeGazette(
  journees: readonly JourneeCandidate[],
  maintenant: number,
  cleDuJour: string,
): string | null {
  if (!journees.length) return null;

  // 1) Un match aujourd'hui.
  const aujourdhui = journees.find((j) => j.clesDeDate.includes(cleDuJour));
  if (aujourdhui) return aujourdhui.id;

  // 2) La derniere journee deja commencee.
  const commencees = journees
    .filter((j) => Number.isFinite(j.premierCoupDEnvoi) && j.premierCoupDEnvoi < maintenant)
    .sort((a, b) => b.premierCoupDEnvoi - a.premierCoupDEnvoi);
  if (commencees.length) return commencees[0].id;

  // 3) La prochaine a venir.
  const aVenir = journees
    .filter((j) => Number.isFinite(j.premierCoupDEnvoi) && j.premierCoupDEnvoi >= maintenant)
    .sort((a, b) => a.premierCoupDEnvoi - b.premierCoupDEnvoi);
  if (aVenir.length) return aVenir[0].id;

  // 4) Dernier recours.
  return [...journees].sort((a, b) => b.numero - a.numero)[0]?.id ?? null;
}
