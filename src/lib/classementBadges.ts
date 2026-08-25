/**
 * BADGES DU CLASSEMENT
 * ====================
 * Petites distinctions affichées à côté du pseudo. Elles ne rapportent aucun
 * point et n'entrent dans aucun calcul : c'est de la lecture, pas du jeu.
 *
 * Les cinq distinctions :
 *   🎯 le plus de bons résultats en 1N2
 *   💎 le plus de scores exacts
 *   📈 le meilleur total sur une seule journée, depuis le début
 *   🏅 le vainqueur de la dernière journée terminée — il change de mains à
 *      chaque journée, c'est tout son intérêt
 *   🔥 les journées consécutives avec des points
 *
 * Tout évolue au fil des matchs : 🎯 💎 📈 🔥 sont recalculés à chaque
 * affichage sur les scores en direct, et bougent donc pendant les matchs.
 * 🏅 est le seul à attendre la fin complète d'une journée — sinon il
 * changerait de propriétaire à chaque but marqué.
 *
 * Règles communes à tous :
 *   * un badge n'est attribué que s'il a un SENS — un « meilleur au 1N2 »
 *     avec zéro bon résultat ne distingue personne ;
 *   * les ex æquo l'obtiennent tous. Départager au hasard serait pire que de
 *     partager ;
 *   * aucun badge ne dépend de l'ordre dans lequel les données arrivent.
 */

export type Badge = {
  id: string;
  icone: string;
  /** Titre court, affiché au survol. */
  libelle: string;
  /** Le chiffre qui justifie le badge, pour que personne n'ait à le croire sur parole. */
  detail: string;
};

export type EntreeBadges = {
  joueurs: { id: string }[];
  /** user_id -> matchday_id -> points de cette journée. */
  pointsParJourneeParJoueur: Record<string, Record<string, number>>;
  /** Les journées TERMINÉES, dans l'ordre chronologique. */
  journeesOrdonnees: string[];
  /** Nombre de pronostics ayant rapporté au moins un point. */
  bonsResultatsParJoueur: Record<string, number>;
  /** Nombre de scores exacts (club de cœur et bonus). */
  scoresExactsParJoueur: Record<string, number>;
};

/** Les identifiants qui atteignent la valeur maximale, si elle est > 0. */
function meilleurs(valeurs: Record<string, number>, ids: string[]): { gagnants: string[]; valeur: number } {
  let valeur = 0;
  ids.forEach((id) => {
    const v = valeurs[id] ?? 0;
    if (v > valeur) valeur = v;
  });
  if (valeur <= 0) return { gagnants: [], valeur: 0 };
  return { gagnants: ids.filter((id) => (valeurs[id] ?? 0) === valeur), valeur };
}

export function calculerBadges(entree: EntreeBadges): Record<string, Badge[]> {
  const ids = entree.joueurs.map((j) => j.id);
  const badges: Record<string, Badge[]> = {};
  const ajouter = (id: string, badge: Badge) => {
    badges[id] = [...(badges[id] ?? []), badge];
  };

  // ---------- Le plus de bons résultats ----------
  const sniper = meilleurs(entree.bonsResultatsParJoueur, ids);
  sniper.gagnants.forEach((id) =>
    ajouter(id, {
      id: "sniper",
      icone: "🎯",
      libelle: "Meilleur au 1N2",
      detail: `${sniper.valeur} bons résultats`,
    }),
  );

  // ---------- Le plus de scores exacts ----------
  const exact = meilleurs(entree.scoresExactsParJoueur, ids);
  exact.gagnants.forEach((id) =>
    ajouter(id, {
      id: "score_exact",
      icone: "💎",
      libelle: "Roi du score exact",
      detail: `${exact.valeur} score${exact.valeur > 1 ? "s" : ""} exact${exact.valeur > 1 ? "s" : ""}`,
    }),
  );

  // ---------- Le meilleur total sur une seule journée ----------
  const recordParJoueur: Record<string, number> = {};
  ids.forEach((id) => {
    const parJournee = entree.pointsParJourneeParJoueur[id] ?? {};
    let record = 0;
    entree.journeesOrdonnees.forEach((jour) => {
      const pts = parJournee[jour] ?? 0;
      if (pts > record) record = pts;
    });
    recordParJoueur[id] = record;
  });
  const record = meilleurs(recordParJoueur, ids);
  record.gagnants.forEach((id) =>
    ajouter(id, {
      id: "record_journee",
      icone: "📈",
      libelle: "Meilleure journée",
      detail: `${record.valeur} points sur une journée`,
    }),
  );

  // ---------- Vainqueur de la journée précédente ----------
  // Le meilleur total sur la DERNIÈRE journée terminée. Ce badge change de
  // propriétaire à chaque journée : c'est tout son intérêt, il récompense la
  // forme du moment et non le cumul de la saison, déjà lisible dans le
  // classement lui-même.
  //
  // Tant que la journée en cours n'est pas finie, il reste sur le vainqueur
  // de la précédente — sans quoi il changerait de main à chaque but marqué.
  const derniereJournee = entree.journeesOrdonnees[entree.journeesOrdonnees.length - 1];
  if (derniereJournee) {
    const pointsDeLaJournee: Record<string, number> = {};
    ids.forEach((id) => {
      pointsDeLaJournee[id] = entree.pointsParJourneeParJoueur[id]?.[derniereJournee] ?? 0;
    });
    const vainqueur = meilleurs(pointsDeLaJournee, ids);
    vainqueur.gagnants.forEach((id) =>
      ajouter(id, {
        id: "vainqueur_journee",
        icone: "🏅",
        libelle: "Vainqueur de la dernière journée",
        detail: `${vainqueur.valeur} points sur la dernière journée`,
      }),
    );
  }

  // ---------- Série en cours ----------
  // Journées consécutives, en partant de la plus récente, avec au moins un
  // point. Affichée à partir de deux : une seule journée n'est pas une série.
  ids.forEach((id) => {
    const parJournee = entree.pointsParJourneeParJoueur[id] ?? {};
    let serie = 0;
    for (let i = entree.journeesOrdonnees.length - 1; i >= 0; i -= 1) {
      if ((parJournee[entree.journeesOrdonnees[i]] ?? 0) > 0) serie += 1;
      else break;
    }
    if (serie >= 2) {
      ajouter(id, {
        id: "serie",
        icone: "🔥",
        libelle: "Série en cours",
        detail: `${serie} journées de suite avec des points`,
      });
    }
  });

  return badges;
}
