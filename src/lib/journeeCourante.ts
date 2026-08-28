/**
 * QUELLE JOURNÉE OUVRIR SUR LA PAGE PRONOS
 *
 * L'Accueil annonçait « ouverture de la J2 dans 2 minutes » pendant que la
 * page Pronos affichait « Journée 3 ». Trois causes se cumulaient :
 *
 *   1. La journée consultée était mémorisée SANS DATE DE PÉREMPTION. Un joueur
 *      qui avait un jour cliqué sur la flèche pour aller voir la J3 rouvrait
 *      la page sur la J3 pour toujours, y compris le soir où la J2 s'ouvrait.
 *
 *   2. La règle de choix automatique n'était pas celle de l'Accueil : « la
 *      première journée contenant un match pas terminé ». Un seul match d'une
 *      journée passée dont le résultat n'a pas été synchronisé suffisait à
 *      ramener le joueur en arrière.
 *
 *   3. Le bandeau des journées ne défilait pas jusqu'à la journée choisie :
 *      on voyait J1 à l'écran alors que J3 était sélectionnée. (Corrigé dans
 *      la page, pas ici.)
 *
 * La règle retenue répond à « sur quoi ai-je encore quelque chose à faire ? »,
 * qui n'est pas tout à fait la question de l'Accueil (« quelle journée
 * s'ouvre ? »). La nuance compte : dès le coup d'envoi du premier match, la
 * J2 s'efface de l'Accueil, alors que le joueur a encore neuf rencontres à
 * remplir. Le ramener sur la J3 à ce moment-là lui ferait manquer sa journée.
 */

export type JourneeChoisissable = {
  id: string;
  number: number;
  deadline_mode?: string | null;
  deadline?: string | null;
};

export type MatchChoisissable = {
  matchday_id?: string | null;
  kickoff?: string | null;
  finished?: boolean | null;
};

/** La journée mémorisée, telle qu'écrite dans le navigateur. */
export type Memoire = { id: string; a: number } | null;

/** Au-delà, la journée mémorisée n'a plus de sens : on recalcule. */
export const DUREE_MEMOIRE = 2 * 60 * 60_000;

/**
 * Date de fermeture d'un match. Règle inchangée, simplement sortie de la page
 * pour être partagée et vérifiable :
 *   - mode « auto_minus_1 » : coup d'envoi moins une minute ;
 *   - sinon la date limite de la journée, si elle existe ;
 *   - sans coup d'envoi, la date limite de la journée seule fait foi.
 */
export function dateVerrouillage(
  match: MatchChoisissable,
  journee: JourneeChoisissable | null | undefined,
): Date | null {
  const limite = journee?.deadline ? new Date(journee.deadline) : null;
  const limiteValide = limite && !Number.isNaN(limite.getTime()) ? limite : null;

  if (!match.kickoff) return limiteValide;

  const coupDEnvoi = new Date(match.kickoff);
  if (Number.isNaN(coupDEnvoi.getTime())) return null;

  if ((journee?.deadline_mode ?? "manual") === "auto_minus_1") {
    return new Date(coupDEnvoi.getTime() - 60_000);
  }

  return limiteValide;
}

/** Reste-t-il au moins un match à remplir dans cette journée ? */
export function journeeOuverte(
  journee: JourneeChoisissable,
  matchs: MatchChoisissable[],
  maintenant: number,
): boolean {
  return matchs.some((match) => {
    if (String(match.matchday_id ?? "") !== String(journee.id)) return false;
    const fermeture = dateVerrouillage(match, journee);
    return fermeture !== null && fermeture.getTime() > maintenant;
  });
}

/**
 * @param memoire La dernière journée ouverte par ce joueur, avec l'instant où
 *   il l'a quittée. Respectée moins de deux heures — le temps de faire un
 *   aller-retour vers le classement sans perdre sa place, pas celui de
 *   revenir le lendemain sur une journée périmée.
 */
export function choisirJournee(
  journees: JourneeChoisissable[],
  matchs: MatchChoisissable[],
  memoire: Memoire,
  maintenant: number = Date.now(),
): string | null {
  if (journees.length === 0) return null;

  const triees = [...journees].sort((a, b) => a.number - b.number);

  if (
    memoire &&
    Number.isFinite(memoire.a) &&
    maintenant - memoire.a < DUREE_MEMOIRE &&
    // Une mémoire datée du futur (horloge remise à l'heure) est ignorée
    // plutôt que respectée indéfiniment.
    memoire.a <= maintenant &&
    triees.some((journee) => journee.id === memoire.id)
  ) {
    return memoire.id;
  }

  const aRemplir = triees.find((journee) => journeeOuverte(journee, matchs, maintenant));
  if (aRemplir) return aRemplir.id;

  // Plus rien d'ouvert : on montre la journée en cours de déroulement, celle
  // dont les résultats tombent, plutôt que de renvoyer au début de saison.
  const enCours = triees.find((journee) =>
    matchs.some(
      (match) => String(match.matchday_id ?? "") === String(journee.id) && !match.finished,
    ),
  );
  if (enCours) return enCours.id;

  return triees[triees.length - 1].id;
}
