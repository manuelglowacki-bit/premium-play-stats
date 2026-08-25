/**
 * BADGES DU CLASSEMENT
 * ====================
 * Petites distinctions affichées à côté du pseudo. Elles ne rapportent aucun
 * point et n'entrent dans aucun calcul : c'est de la lecture, pas du jeu.
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

  // ---------- Le plus longtemps dans les trois premiers ----------
  // On rejoue le classement CUMULÉ après chaque journée, puis on compte
  // combien de fois chacun s'y trouvait dans les trois premiers. À égalité de
  // points, tout le monde partage le rang : trois joueurs à égalité en tête
  // sont tous « dans le top 3 », personne n'est sorti par un départage
  // arbitraire.
  const cumul: Record<string, number> = {};
  const passagesTop3: Record<string, number> = {};
  ids.forEach((id) => {
    cumul[id] = 0;
    passagesTop3[id] = 0;
  });

  entree.journeesOrdonnees.forEach((jour) => {
    ids.forEach((id) => {
      cumul[id] += entree.pointsParJourneeParJoueur[id]?.[jour] ?? 0;
    });

    // Les trois meilleurs totaux distincts, ex æquo compris.
    const totaux = [...new Set(ids.map((id) => cumul[id]))].sort((a, b) => b - a).slice(0, 3);
    const seuil = totaux[totaux.length - 1];
    if (seuil === undefined || seuil <= 0) return;
    ids.forEach((id) => {
      if (cumul[id] >= seuil && cumul[id] > 0) passagesTop3[id] += 1;
    });
  });

  // Le badge n'a de sens qu'a partir de deux journees : sur une seule, il
  // recompenserait simplement le classement du moment, deja visible.
  if (entree.journeesOrdonnees.length >= 2) {
    const podium = meilleurs(passagesTop3, ids);
    podium.gagnants.forEach((id) =>
      ajouter(id, {
        id: "indeboulonnable",
        icone: "👑",
        libelle: "Indéboulonnable",
        detail: `${podium.valeur} journées dans le top 3`,
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
