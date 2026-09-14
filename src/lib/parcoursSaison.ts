/**
 * LE PARCOURS D'UN JOUEUR, JOURNEE PAR JOURNEE.
 *
 * « J1 : 17e -> J2 : 9e -> J3 : 6e -> J4 : 1er » raconte une saison mieux
 * qu'un total de points. Ce rang n'est stocke nulle part : il se reconstruit
 * en rejouant le classement apres chaque journee terminee.
 *
 * La regle de classement n'est PAS reecrite ici : `classer` recoit
 * `rankPlayers` (src/lib/leaderboardRanking.ts), celui du vrai classement,
 * departages compris. Les points d'un pronostic ne sont pas recalcules non
 * plus : `pointsDe` vient du moteur. Ce fichier ne fait qu'accumuler et
 * ordonner.
 */

export type JoueurSaison = {
  id: string;
  name: string;
};

export type JourneeSaison = {
  id: string;
  numero: number;
  /** Les matchs de cette journee, bonus compris. */
  matchIds: readonly string[];
};

export type EtapeParcours = {
  numero: number;
  /** Rang a l'issue de cette journee. */
  rang: number;
  /** Total cumule a l'issue de cette journee. */
  points: number;
  /** Points marques SUR cette journee. */
  gainJournee: number;
  /** Scores exacts cumules a l'issue de cette journee. */
  exactScores: number;
};

export type LigneClassable = {
  id: string;
  points: number;
  exactScores: number;
  predictionsCount: number;
  regularitySuccess: number;
};

export type EntreesParcours = {
  joueurs: readonly JoueurSaison[];
  /** Journees TERMINEES uniquement, dans n'importe quel ordre. */
  journees: readonly JourneeSaison[];
  pointsDe: (userId: string, matchId: string) => number;
  exactDe: (userId: string, matchId: string) => boolean;
  /** A jouer : rankPlayers. */
  classer: <T extends LigneClassable>(lignes: T[]) => (T & { rank: number })[];
};

/**
 * @returns Pour chaque joueur, son parcours dans l'ordre des journees.
 *   Un joueur sans aucune journee terminee ressort avec un parcours vide.
 */
export function parcoursSaison(entrees: EntreesParcours): Map<string, EtapeParcours[]> {
  const { joueurs, journees, pointsDe, exactDe, classer } = entrees;

  const parcours = new Map<string, EtapeParcours[]>();
  joueurs.forEach((joueur) => parcours.set(String(joueur.id), []));

  // L'ordre des journees fait tout : un cumul se lit dans le sens du temps.
  const ordonnees = [...journees].sort((a, b) => a.numero - b.numero);

  const cumulPoints = new Map<string, number>();
  const cumulExacts = new Map<string, number>();
  const cumulPronos = new Map<string, number>();

  for (const journee of ordonnees) {
    const gains = new Map<string, number>();

    for (const joueur of joueurs) {
      const id = String(joueur.id);
      let gain = 0;
      let exacts = 0;
      let pronos = 0;

      for (const matchId of journee.matchIds) {
        const points = pointsDe(id, String(matchId));
        // Un match non pronostique rapporte 0 : on ne peut pas le distinguer
        // d'un pronostic rate par les seuls points. `exactDe` tranche pour
        // les scores exacts ; pour le compte de pronostics, on s'en tient a
        // ceux qui ont rapporte, comme le fait `regularitySuccess`.
        if (points > 0) pronos += 1;
        gain += points;
        if (exactDe(id, String(matchId))) exacts += 1;
      }

      gains.set(id, gain);
      cumulPoints.set(id, (cumulPoints.get(id) ?? 0) + gain);
      cumulExacts.set(id, (cumulExacts.get(id) ?? 0) + exacts);
      cumulPronos.set(id, (cumulPronos.get(id) ?? 0) + pronos);
    }

    const classement = classer(
      joueurs.map((joueur) => {
        const id = String(joueur.id);
        return {
          id,
          points: cumulPoints.get(id) ?? 0,
          exactScores: cumulExacts.get(id) ?? 0,
          predictionsCount: cumulPronos.get(id) ?? 0,
          regularitySuccess: cumulPronos.get(id) ?? 0,
        };
      }),
    );

    for (const ligne of classement) {
      const etapes = parcours.get(String(ligne.id));
      if (!etapes) continue;
      etapes.push({
        numero: journee.numero,
        rang: Number(ligne.rank),
        points: Number(ligne.points),
        gainJournee: gains.get(String(ligne.id)) ?? 0,
        exactScores: Number(ligne.exactScores),
      });
    }
  }

  return parcours;
}

/** Le mouvement total : rang de depart moins rang actuel. Positif = montee. */
export function progressionTotale(etapes: readonly EtapeParcours[]): number {
  if (etapes.length < 2) return 0;
  return etapes[0].rang - etapes[etapes.length - 1].rang;
}

/**
 * LE MOUVEMENT SUR LA SEULE DERNIERE JOURNEE : rang de la veille moins rang
 * du soir. Positif = montee.
 *
 * A ne pas confondre avec `progressionTotale`. Un Debrief qui raconte la
 * journee 4 doit dire qui a gagne des places SUR LA JOURNEE 4. Presenter
 * comme « il revient de loin » un joueur qui vient de perdre quatre places
 * parce qu'il avait bien demarre la saison n'a aucun sens pour qui lit
 * l'article le lundi matin.
 */
export function progressionJournee(etapes: readonly EtapeParcours[]): number {
  if (etapes.length < 2) return 0;
  return etapes[etapes.length - 2].rang - etapes[etapes.length - 1].rang;
}

/** « 17e → 9e → 6e → 1er », pour l'affichage. */
export function cheminLisible(etapes: readonly EtapeParcours[]): string {
  return etapes.map((e) => (e.rang === 1 ? "1er" : `${e.rang}e`)).join(" → ");
}

/**
 * UNE JOURNEE EST-ELLE ENTIEREMENT TERMINEE ?
 *
 * Tous ses matchs doivent l'etre — ceux de Ligue 1 comme les matchs bonus.
 * C'est ce qui permet au Debrief de ne raconter que des journees closes :
 * un bilan qui bouge pendant que les matchs se jouent n'est pas un bilan.
 *
 * Une journee sans aucun match n'est pas « terminee » : elle n'a simplement
 * pas commence. Sans cette garde, une journee vide au calendrier passerait
 * pour jouee et le Debrief raconterait une journee sans resultat.
 */
export function journeeTerminee(matchsTermines: readonly boolean[]): boolean {
  return matchsTermines.length > 0 && matchsTermines.every(Boolean);
}
