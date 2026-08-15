/**
 * Moteur de calcul des points de pronostic — barème officiel, centralisé et
 * testable indépendamment de Supabase/React. Toute règle de points vit ICI
 * et nulle part ailleurs — src/routes/classement.tsx ne fait qu'appeler ces
 * fonctions pures pour chaque pronostic d'un joueur.
 *
 * Barème (inchangé) :
 *   Ligue 1 classique   : résultat correct = 1, sinon 0.
 *   Équipe favorite     : score exact = 2, bon résultat = 1, sinon 0.
 *   Bonus               : score exact = 3, bon résultat = 2, sinon 0.
 * Un match favori ne reçoit JAMAIS +1 classique ET +2 favori à la fois —
 * scoreLigue1Prediction retourne une seule valeur, exclusive.
 *
 * Voir scripts/test-prediction-scoring.ts pour la suite de vérifications
 * (cas J1 réel + cas limites), exécutable via `npx tsx scripts/test-prediction-scoring.ts`.
 */

export type MatchResult = "1" | "N" | "2" | null;

export function matchResultFromScore(home: number | null, away: number | null): MatchResult {
  if (home == null || away == null) return null;
  if (home > away) return "1";
  if (home < away) return "2";
  return "N";
}

export type Ligue1ScoreCategory = "classique" | "classique_rate" | "favori_exact" | "favori_resultat" | "favori_rate";

export function scoreLigue1Prediction(input: {
  homeScore: number;
  awayScore: number;
  homePrediction: number;
  awayPrediction: number;
  isFavoriteMatch: boolean;
}): { points: number; category: Ligue1ScoreCategory } {
  const { homeScore, awayScore, homePrediction, awayPrediction, isFavoriteMatch } = input;
  const exact = homeScore === homePrediction && awayScore === awayPrediction;
  const result = matchResultFromScore(homeScore, awayScore);
  const pick = matchResultFromScore(homePrediction, awayPrediction);
  const correct = !!result && pick === result;

  if (isFavoriteMatch) {
    if (exact) return { points: 2, category: "favori_exact" };
    if (correct) return { points: 1, category: "favori_resultat" };
    return { points: 0, category: "favori_rate" };
  }

  if (correct) return { points: 1, category: "classique" };
  return { points: 0, category: "classique_rate" };
}

export type BonusScoreCategory = "bonus_exact" | "bonus_resultat" | "bonus_rate";

export function scoreBonusPrediction(input: {
  homeScore: number;
  awayScore: number;
  homePrediction: number;
  awayPrediction: number;
}): { points: number; category: BonusScoreCategory } {
  const { homeScore, awayScore, homePrediction, awayPrediction } = input;
  const exact = homeScore === homePrediction && awayScore === awayPrediction;
  const result = matchResultFromScore(homeScore, awayScore);
  const pick = matchResultFromScore(homePrediction, awayPrediction);
  const correct = !!result && pick === result;

  if (exact) return { points: 3, category: "bonus_exact" };
  if (correct) return { points: 2, category: "bonus_resultat" };
  return { points: 0, category: "bonus_rate" };
}

/**
 * Normalise un nom de club Ligue 1 pour une comparaison de secours robuste
 * (accents, casse, préfixes français usuels — RC, AS, AJ, OGC, ESTAC, LOSC,
 * Olympique, Stade...). Utilisé UNIQUEMENT en repli quand la correspondance
 * par team_id échoue (voir isFavoriteMatch) — jamais en remplacement.
 */
export function normalizeL1ClubName(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(as|aj|rc|fc|ogc|estac|losc|sco|olympique|stade|les|le)\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Détermine si un match implique l'équipe favorite d'un joueur.
 *
 * Priorité stricte :
 *   1) correspondance par team_id (fiable, toujours essayée en premier) ;
 *   2) UNIQUEMENT si aucun id ne matche, repli sur une comparaison de noms
 *      normalisés — couvre un home_team_id/away_team_id manquant ou
 *      incohérent suite à une synchronisation partielle. Le nom ne prime
 *      jamais sur un id qui matche déjà.
 */
export function isFavoriteMatch(input: {
  homeTeamId: string | null | undefined;
  awayTeamId: string | null | undefined;
  homeTeamName: string | null | undefined;
  awayTeamName: string | null | undefined;
  favoriteTeamId: string | null | undefined;
  /** Nom(s) candidats de l'équipe favorite, utilisés uniquement en repli —
   * ex. profiles.favorite_team (ancienne colonne texte) et/ou teams.name
   * résolu depuis favoriteTeamId, quand disponibles. */
  favoriteTeamNames: Array<string | null | undefined>;
}): boolean {
  const { homeTeamId, awayTeamId, homeTeamName, awayTeamName, favoriteTeamId, favoriteTeamNames } = input;

  if (favoriteTeamId) {
    if (String(homeTeamId) === String(favoriteTeamId) || String(awayTeamId) === String(favoriteTeamId)) {
      return true;
    }
  }

  const normalizedCandidates = favoriteTeamNames
    .map((name) => normalizeL1ClubName(name))
    .filter((name) => name.length > 0);
  if (normalizedCandidates.length === 0) return false;

  const normalizedHome = normalizeL1ClubName(homeTeamName);
  const normalizedAway = normalizeL1ClubName(awayTeamName);
  if (!normalizedHome && !normalizedAway) return false;

  return normalizedCandidates.some((candidate) => candidate === normalizedHome || candidate === normalizedAway);
}
