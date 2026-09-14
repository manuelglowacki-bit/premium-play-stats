/**
 * QUELS MATCHS ENTRENT DANS UN CLASSEMENT.
 *
 * Une page qui recalcule le classement doit partir EXACTEMENT des memes
 * matchs que la page Classement. Sinon elle raconte une autre ligue — et
 * c'est arrive : le Debrief affichait 51 points a un joueur que le
 * Classement donnait a 25, avec un ordre d'arrivee sans rapport.
 *
 * La cause n'etait pas le calcul, qui est commun (computeLeagueStats), mais
 * ce qu'on lui donnait a manger. Trois ecarts, chacun suffisant :
 *
 *   1. LA SAISON. Le Debrief gardait les journees de toutes les saisons
 *      presentes en base. Deux « journees 1 » portent le meme numero : leurs
 *      points s'additionnaient.
 *   2. `match_type` AU LIEU DE `is_bonus`. `match_type` n'est pas renseigne
 *      partout ; un match bonus passait donc pour un match de Ligue 1 tout
 *      en restant un match bonus, et comptait deux fois.
 *   3. LES LIGNES BONUS D'AUTRES SAISONS, qui n'etaient filtrees nulle part.
 *
 * Ces trois regles vivent desormais ici, ecrites une fois et verifiees. Elles
 * reproduisent celles de src/routes/classement.tsx, qui reste la reference :
 * si cette page change de regle un jour, c'est ce fichier qu'il faut suivre.
 *
 * Aucun point n'est calcule ici : on ne fait que choisir les lignes.
 */

export type JourneeConnue = {
  id?: string | null;
  /** Nom de saison porte par la journee (« 2026-2027 »). */
  season?: string | null;
  competition_id?: string | null;
};

export type MatchConnu = {
  matchday_id?: string | null;
  is_bonus?: boolean | null;
};

export type OptionBonusConnue = {
  matchday_id?: string | null;
};

/**
 * LES JOURNEES DE LA SAISON EN COURS, toutes competitions confondues.
 *
 * Toutes, et pas seulement la Ligue 1 : un match bonus appartient au
 * championnat etranger dont il vient, et doit rester dans le perimetre.
 *
 * Une journee sans saison renseignee est CONSERVEE : d'anciennes lignes
 * n'ont pas cette colonne, et les exclure ferait disparaitre des points
 * deja marques. Une journee sans competition est ecartee, comme le fait le
 * Classement. Si la saison courante est inconnue, on ne filtre pas sur elle
 * plutot que de tout vider.
 */
export function journeesDeLaSaison(
  journees: readonly JourneeConnue[],
  saisonCourante: string | null | undefined,
): Set<string> {
  const saison = String(saisonCourante ?? "").trim();
  const ids = new Set<string>();

  journees.forEach((journee) => {
    if (!journee?.id || !journee?.competition_id) return;
    if (saison && String(journee.season ?? saison) !== saison) return;
    ids.add(String(journee.id));
  });

  return ids;
}

/**
 * LES MATCHS QUI COMPTENT : ceux de la saison, hors matchs bonus.
 *
 * `is_bonus === true` et rien d'autre : une valeur absente vaut « ce n'est
 * pas un match bonus », comme en base ou la colonne est un booleen non nul.
 */
export function matchsDuClassement<T extends MatchConnu>(
  matchs: readonly T[],
  journees: ReadonlySet<string>,
): T[] {
  return matchs.filter(
    (match) =>
      match?.is_bonus !== true &&
      match?.matchday_id != null &&
      journees.has(String(match.matchday_id)),
  );
}

/** Les lignes bonus rattachees a une journee de la saison en cours. */
export function optionsBonusDuClassement<T extends OptionBonusConnue>(
  options: readonly T[],
  journees: ReadonlySet<string>,
): T[] {
  return options.filter(
    (option) => option?.matchday_id != null && journees.has(String(option.matchday_id)),
  );
}
