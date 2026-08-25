import { isFavoriteMatch, scoreBonusPrediction, scoreLigue1Prediction } from "./predictionScoring";

/**
 * Agrégation officielle des points/scores exacts/régularité par joueur —
 * extrait de src/routes/classement.tsx (comportement strictement inchangé,
 * juste déplacé) pour que index.tsx et profil.tsx puissent l'appeler au lieu
 * de lire `predictions.points`.
 *
 * POURQUOI CETTE EXTRACTION (bug réel trouvé lors de l'audit du 15/08/2026) :
 * `predictions.points` a `column_default = 0` et n'est mis à jour par AUCUN
 * code de l'application (ni client, ni Edge Function, ni trigger SQL —
 * vérifié directement en base). Cette colonne reste donc éternellement à 0.
 * classement.tsx ne l'a jamais utilisée : il recalcule toujours les points
 * depuis les résultats réels. index.tsx et profil.tsx, eux, lisaient
 * directement `predictions.points` — donc afficheraient 0 point pour tout
 * le monde dès les premiers résultats réels, alors que le Classement
 * afficherait les bons scores. Cette fonction est maintenant LA seule
 * source de vérité pour ce calcul, partagée par les trois pages.
 *
 * Entrée : données déjà filtrées/chargées par l'appelant (chaque page garde
 * sa propre stratégie de fetch Supabase) — cette fonction ne fait aucun
 * appel réseau, uniquement du calcul pur et testable.
 */

export type LeagueMatch = {
  id: string;
  matchday_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  /**
   * `finished: true` signifie "résultat actuel scorable" pour les appels live
   * comme pour les matchs réellement terminés. Les pages live construisent
   * cette vue en mémoire sans modifier Supabase.
   */
  finished?: boolean | null;
  status?: string | null;
  kickoff?: string | null;
  is_bonus?: boolean | null;
};

export type LeaguePrediction = {
  // Nullable côté type pour matcher fidèlement le schéma Supabase — en
  // pratique toujours renseignés (contrainte applicative + RLS), mais on ne
  // ment pas au typage. safePredictions (plus bas) filtre les valeurs
  // absentes avant tout calcul.
  user_id: string | null;
  match_id: string | null;
  home_prediction: number | null;
  away_prediction: number | null;
  created_at?: string | null;
};

export type LeagueBonusOption = {
  matchday_id: string;
  match_id: string;
};

export type LeagueProfile = {
  id: string;
  favorite_team_id?: string | null;
  favorite_team?: string | null;
  // Optionnels, ignorés par computeLeagueStats — présents seulement pour
  // que les appelants puissent réutiliser le même objet profil pour
  // l'affichage (pseudo/avatar) sans avoir à retyper deux fois.
  pseudo?: string | null;
  avatar_url?: string | null;
};

export type LeagueStats = {
  pointsByUser: Record<string, number>;
  predictionsCountByUser: Record<string, number>;
  exactScoresByUser: Record<string, number>;
  regularitySuccessByUser: Record<string, number>;
  /** PARTICIPATION — combien de rencontres jouables le joueur a effectivement
   * pronostiquées depuis le début de la saison. C'est le sens attendu de
   * "régularité" : dépose-t-il ses pronostics à chaque journée, ou en
   * saute-t-il ?
   * À ne pas confondre avec regularitySuccessByUser, qui compte les
   * pronostics AYANT RAPPORTÉ des points, et qui sert au départage du
   * classement (voir rankPlayers). */
  participationByUser: Record<string, number>;
  /** Dénominateur, PROPRE À CHAQUE JOUEUR : les matchs Ligue 1 déjà joués,
   * plus le match bonus de chaque journée — mais uniquement à partir du
   * moment où il a réellement été joué POUR CE JOUEUR.
   *
   * Les joueurs ne choisissent pas tous la même option bonus : dimanche,
   * celui dont le bonus est déjà passé est à 8/8 quand celui dont le bonus
   * joue lundi est à 7/7. Un dénominateur commun mettrait le second en
   * echec pour une rencontre qu'il n'a pas encore pu voir. */
  participationTotalByUser: Record<string, number>;
  /** Points cumulés par journée (matchday_id), tous joueurs confondus —
   * sert à la stat "Meilleure journée" du Classement. */
  pointsByMatchday: Record<string, number>;
  /** Points par journée (matchday_id) POUR CHAQUE joueur — sert à la
   * "meilleure journée personnelle" (widget Accueil), sans recalcul
   * séparé : clé externe = user_id, clé interne = matchday_id. */
  pointsByUserAndMatchday: Record<string, Record<string, number>>;
  /** Points réels d'UN pronostic donné, clé `${user_id}:${match_id}` — sert
   * au niveau de carrière (aggregateCareerStatsByUser, src/lib/careerLevel.ts,
   * qui lit un champ `points` par pronostic) sans dupliquer le calcul :
   * on injecte cette valeur réelle à la place de `predictions.points`
   * (colonne jamais mise à jour par l'application, voir plus haut). Absente
   * de cette map = pronostic pas encore scoré (match pas fini), équivaut à 0. */
  pointsByPredictionKey: Record<string, number>;
};

/**
 * @param ligue1Matches Matchs Ligue 1 classiques, déjà filtrés `finished` +
 *   score renseigné + `is_bonus = false` (ou absent).
 * @param bonusMatches Les matchs bonus effectivement pronostiqués (peuvent
 *   appartenir à une autre compétition — PL/PD/SA/BL1), déjà filtrés
 *   `finished` + score renseigné.
 * @param bonusOptions Toutes les lignes bonus_options (actives ET
 *   historiques — un pronostic reste valable même si l'admin a changé la
 *   sélection depuis, voir classement.tsx pour le détail du bug corrigé).
 * @param teamNameById Nom d'équipe par id (pour le repli de détection du
 *   favori par nom quand le team_id est absent/incohérent).
 * @param history Historisation de l'équipe favorite par saison (Lot 4) —
 *   entièrement OPTIONNELLE, rétrocompatible : un appelant qui ne la passe
 *   pas obtient EXACTEMENT le comportement d'avant (favori = toujours
 *   `profiles.favorite_team_id` courant, quelle que soit la saison du
 *   match). Voir `user_season_favorite_teams` (migration Lot 4) : sans
 *   ligne historique pour `${user_id}:${season_id}`, repli automatique
 *   sur le favori courant — jamais d'invention de valeur.
 */
export function computeLeagueStats(
  ligue1Matches: LeagueMatch[],
  bonusMatches: LeagueMatch[],
  bonusOptions: LeagueBonusOption[],
  predictions: LeaguePrediction[],
  profiles: LeagueProfile[],
  teamNameById: Record<string, string | undefined>,
  history?: {
    /** matchday_id -> season_id (ou clé de saison de repli). */
    seasonByMatchdayId?: Record<string, string | undefined>;
    /** clé `${user_id}:${season_id}` -> favorite_team_id historisé. */
    favoriteTeamBySeason?: Record<string, string | undefined>;
  },
): LeagueStats {
  const seasonByMatchdayId = history?.seasonByMatchdayId ?? {};
  const favoriteTeamBySeason = history?.favoriteTeamBySeason ?? {};

  const matchById = new Map<string, LeagueMatch>();
  [...ligue1Matches, ...bonusMatches].forEach((m) => matchById.set(String(m.id), m));

  // JOURNEE D'UN MATCH BONUS : celle du MATCH, jamais celle de sa ligne
  // d'option.
  //
  // bonus_options ne sert qu'a repondre a une question : « ce match est-il un
  // candidat bonus ? ». Son matchday_id, lui, n'est pas fiable — constate en
  // production : Atletico-Villarreal, un match de la journee 2, portait une
  // ligne d'option rattachee a la journee 1, et la base contient 189 lignes
  // d'options la ou il en faudrait douze, empilees par les tirages
  // successifs.
  //
  // Consequence, avant ce correctif : un joueur ayant joue deux bonus dont
  // les options pointaient toutes deux sur la journee 1 n'en voyait compter
  // qu'UN SEUL — la regle « un bonus par joueur et par journee » ne garde que
  // le plus recent. En validant son bonus de la journee 2, il evinçait donc
  // celui de la journee 1, deja joue et deja compte. Ses points disparaissaient
  // du jour au lendemain, sans qu'aucune donnee n'ait ete effacee. Quatorze
  // joueurs etaient dans ce cas sur le seul Atletico-Villarreal.
  //
  // Le match, lui, sait a quelle journee il appartient. C'est la seule source
  // que ni un tirage rejoue ni une journee creee en double ne peuvent fausser.
  //
  // Le bareme ne change pas : 3 points pour un score exact, 2 pour le bon
  // resultat. Seule change la journee a laquelle le bonus est rattache.
  const bonusMatchdayByMatchId = new Map<string, string>();
  bonusOptions.forEach((option) => {
    const matchId = String(option.match_id);
    const match = matchById.get(matchId);
    const journeeDuMatch = match?.matchday_id != null ? String(match.matchday_id) : "";

    // Repli sur la ligne d'option si le match n'a pas ete charge ou n'a pas de
    // journee : mieux vaut une attribution imparfaite qu'un bonus ignore.
    bonusMatchdayByMatchId.set(matchId, journeeDuMatch || String(option.matchday_id));
  });

  // Une prédiction bonus correspond à un seul match bonus sélectionné par
  // journée. S'il reste plusieurs anciennes lignes bonus pour une même
  // journée, on ne garde que la plus récente (même règle que classement.tsx).
  const latestBonusPredictionByUserDay = new Map<string, { createdAt: number; matchId: string }>();

  const safePredictions = predictions.filter(
    (pred) =>
      pred?.user_id &&
      pred?.match_id &&
      pred?.home_prediction != null &&
      pred?.away_prediction != null &&
      matchById.has(String(pred.match_id)),
  );

  safePredictions.forEach((pred) => {
    const bonusDayId = bonusMatchdayByMatchId.get(String(pred.match_id));
    if (!bonusDayId) return;

    const key = `${pred.user_id}:${bonusDayId}`;
    const createdAt = pred.created_at ? new Date(pred.created_at).getTime() : 0;
    const previous = latestBonusPredictionByUserDay.get(key);

    if (!previous || createdAt >= previous.createdAt) {
      latestBonusPredictionByUserDay.set(key, { createdAt, matchId: String(pred.match_id) });
    }
  });

  const points: Record<string, number> = {};
  const predictionsCount: Record<string, number> = {};
  const exactScores: Record<string, number> = {};
  const regularitySuccess: Record<string, number> = {};
  const participation: Record<string, number> = {};
  const pointsByMatchday: Record<string, number> = {};
  const pointsByUserAndMatchday: Record<string, Record<string, number>> = {};
  const pointsByPredictionKey: Record<string, number> = {};

  function addDayPoints(userId: string, dayId: string, pts: number) {
    pointsByMatchday[dayId] = (pointsByMatchday[dayId] ?? 0) + pts;
    const userDays = pointsByUserAndMatchday[userId] ?? {};
    userDays[dayId] = (userDays[dayId] ?? 0) + pts;
    pointsByUserAndMatchday[userId] = userDays;
  }

  profiles.forEach((profile) => {
    points[profile.id] = 0;
    predictionsCount[profile.id] = 0;
    exactScores[profile.id] = 0;
    regularitySuccess[profile.id] = 0;
    participation[profile.id] = 0;
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  safePredictions.forEach((pred) => {
    const userId = String(pred.user_id);
    const matchId = String(pred.match_id);
    const match = matchById.get(matchId);

    // IMPORTANT :
    // - un vrai match terminé => finished=true
    // - un match LIVE transformé en snapshot de calcul par les pages => finished=true
    // - un simple score 0-0 présent en base pour un match futur => finished=false
    // Ainsi, l'exact LIVE est bien calculé sans jamais scorer un match qui n'a pas commencé.
    if (
      !match ||
      match.home_score == null ||
      match.away_score == null ||
      match.finished !== true
    ) {
      return;
    }

    const homePrediction = Number(pred.home_prediction);
    const awayPrediction = Number(pred.away_prediction);
    if (!Number.isFinite(homePrediction) || !Number.isFinite(awayPrediction)) return;

    const profile = profileById.get(userId);
    if (!profile) return;

    const isBonus = bonusMatchdayByMatchId.has(matchId);

    if (isBonus) {
      const dayId = bonusMatchdayByMatchId.get(matchId)!;
      const selected = latestBonusPredictionByUserDay.get(`${userId}:${dayId}`);
      if (!selected || selected.matchId !== matchId) return;

      const { points: pts } = scoreBonusPrediction({
        homeScore: match.home_score,
        awayScore: match.away_score,
        homePrediction,
        awayPrediction,
      });

      predictionsCount[userId] = (predictionsCount[userId] ?? 0) + 1;
      // Participation : le bonus de la journée a bien été joué. Il compte
      // une seule fois par journée — `selected` garantit qu'on est sur LE
      // pronostic bonus retenu pour ce joueur et cette journée.
      participation[userId] = (participation[userId] ?? 0) + 1;
      pointsByPredictionKey[`${userId}:${matchId}`] = pts;

      if (pts > 0) {
        points[userId] = (points[userId] ?? 0) + pts;
        regularitySuccess[userId] = (regularitySuccess[userId] ?? 0) + 1;
        addDayPoints(userId, dayId, pts);
      }
      // Le score exact BONUS est compté aussi sur le score LIVE courant :
      // le caller aura marqué le match `finished: true` dans sa vue de calcul.
      if (pts === 3) {
        exactScores[userId] = (exactScores[userId] ?? 0) + 1;
      }
      return;
    }

    // Favori HISTORIQUE de la saison DU MATCH — jamais celui d'une autre
    // saison. Repli sur le favori courant du profil uniquement si aucune
    // ligne user_season_favorite_teams n'existe pour cette saison (saison
    // en cours avant toute écriture, données antérieures à cette table).
    // Ne recalcule JAMAIS une saison passée avec le favori actuel dès
    // qu'un historique existe pour elle.
    const matchSeasonId = match.matchday_id ? seasonByMatchdayId[String(match.matchday_id)] : undefined;
    const historicalFavoriteTeamId = matchSeasonId
      ? favoriteTeamBySeason[`${userId}:${matchSeasonId}`]
      : undefined;
    const effectiveFavoriteTeamId = historicalFavoriteTeamId ?? profile.favorite_team_id;

    const isFavorite = isFavoriteMatch({
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      homeTeamName: match.home_team,
      awayTeamName: match.away_team,
      favoriteTeamId: effectiveFavoriteTeamId,
      favoriteTeamNames: [profile.favorite_team, teamNameById[String(effectiveFavoriteTeamId ?? "")]],
    });

    const { points: pts } = scoreLigue1Prediction({
      homeScore: match.home_score,
      awayScore: match.away_score,
      homePrediction,
      awayPrediction,
      isFavoriteMatch: isFavorite,
    });

    predictionsCount[userId] = (predictionsCount[userId] ?? 0) + 1;
    // Participation : ce pronostic Ligue 1 a bien été déposé, qu'il rapporte
    // des points ou non. C'est toute la différence avec regularitySuccess.
    participation[userId] = (participation[userId] ?? 0) + 1;
    pointsByPredictionKey[`${userId}:${matchId}`] = pts;
    const matchDayId = String(match.matchday_id);

    if (pts > 0) {
      points[userId] = (points[userId] ?? 0) + pts;
      regularitySuccess[userId] = (regularitySuccess[userId] ?? 0) + 1;
      addDayPoints(userId, matchDayId, pts);
    }
    // Le score exact du club de cœur évolue aussi en LIVE :
    // exemple prono 2-1, score live 2-1 => 2 pts + 1 exact en direct.
    if (isFavorite && pts === 2) {
      exactScores[userId] = (exactScores[userId] ?? 0) + 1;
    }
  });

  // ------------------------------------------------------------------
  // DÉNOMINATEUR DE LA PARTICIPATION — match par match, joueur par joueur.
  //
  // Base commune : les matchs de Ligue 1 déjà joués.
  // S'y ajoute le bonus de chaque journée, mais seulement quand il a
  // réellement été joué POUR CE JOUEUR — c'est-à-dire l'option qu'il a
  // lui-même choisie. Deux joueurs d'une même journée peuvent donc être à
  // 8/8 et 7/7 le même dimanche, si le bonus de l'un a joué et pas l'autre.
  //
  // Cas du joueur qui n'a choisi AUCUN bonus : on attend que TOUTES les
  // options de la journée soient jouées avant de la lui compter. Tant qu'une
  // option reste à venir, on ne peut pas affirmer qu'il a laissé passer sa
  // chance — mieux vaut ne pas le pénaliser trop tôt.
  // ------------------------------------------------------------------
  const isPlayable = (m: LeagueMatch) =>
    m.home_score != null && m.away_score != null && m.finished === true;

  const ligue1Playable = ligue1Matches.filter(isPlayable).length;

  const playableBonusMatchIds = new Set(
    bonusMatches.filter(isPlayable).map((m) => String(m.id)),
  );

  // Meme regle que plus haut : la journee vient du match. Sans cela, le
  // denominateur de l'assiduite compterait une journee et le numerateur une
  // autre.
  const bonusOptionsByDay = new Map<string, string[]>();
  bonusOptions.forEach((option) => {
    const matchId = String(option.match_id);
    const dayId = bonusMatchdayByMatchId.get(matchId);
    if (!dayId) return;
    const list = bonusOptionsByDay.get(dayId) ?? [];
    list.push(matchId);
    bonusOptionsByDay.set(dayId, list);
  });

  const participationTotalByUser: Record<string, number> = {};
  profiles.forEach((profile) => {
    let total = ligue1Playable;

    bonusOptionsByDay.forEach((optionIds, dayId) => {
      const chosen = latestBonusPredictionByUserDay.get(`${profile.id}:${dayId}`);

      if (chosen) {
        // Le bonus de ce joueur compte des qu'il a ete joue.
        if (playableBonusMatchIds.has(chosen.matchId)) total += 1;
        return;
      }

      // Aucun bonus choisi : on ne compte la journee que lorsque plus aucune
      // option ne peut encore etre jouee.
      if (optionIds.length > 0 && optionIds.every((id) => playableBonusMatchIds.has(id))) {
        total += 1;
      }
    });

    participationTotalByUser[profile.id] = total;
  });

  return {
    pointsByUser: points,
    predictionsCountByUser: predictionsCount,
    exactScoresByUser: exactScores,
    regularitySuccessByUser: regularitySuccess,
    participationByUser: participation,
    participationTotalByUser,
    pointsByMatchday,
    pointsByUserAndMatchday,
    pointsByPredictionKey,
  };
}