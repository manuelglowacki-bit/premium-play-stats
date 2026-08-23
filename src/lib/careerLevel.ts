/**
 * Systeme de carriere Prono Ligue 1 LM
 *
 * REGLE :
 * score de carriere = points cumules sur toutes les saisons
 *                  + (scores exacts cumules x 2)
 *
 * Les seuils des 30 niveaux restent volontairement internes (jamais
 * affiches en clair). Le pourcentage de progression vers le niveau suivant
 * (voir getCareerProgressPercent) peut en revanche être affiché — c'est une
 * valeur relative dérivée des seuils, pas les seuils eux-mêmes.
 */

export type CareerStats = {
  points: number;
  exactScores: number;
  // Optionnel : nombre de pronostics pris en compte dans le calcul
  // (cumulé toutes saisons, même filtre que points/exactScores). Non
  // utilisé par calculateCareerScore, seulement par les pages qui affichent
  // un "% de scores exacts" carrière (ex. Profil).
  predictionsCount?: number;
};

export type CareerResult = CareerStats & {
  careerScore: number;
  level: number;
};

export const CAREER_LEVEL_THRESHOLDS: readonly number[] = [
  0,
  35,
  80,
  135,
  200,
  280,
  375,
  485,
  610,
  750,
  905,
  1075,
  1260,
  1460,
  1675,
  1905,
  2150,
  2410,
  2685,
  2975,
  3280,
  3600,
  3935,
  4285,
  4650,
  5030,
  5425,
  5835,
  6260,
  6700,
];

/**
 * Retourne le niveau courant entre 1 et 30.
 * Les seuils sont volontairement non affiches dans l'UI.
 */
export function getCareerLevel(careerScore: number): number {
  const score = Math.max(0, Number(careerScore) || 0);
  let level = 1;

  for (let i = 0; i < CAREER_LEVEL_THRESHOLDS.length; i += 1) {
    if (score >= CAREER_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  return Math.min(30, Math.max(1, level));
}

export function calculateCareerScore(stats: CareerStats): CareerResult {
  const points = Math.max(0, Number(stats.points) || 0);
  const exactScores = Math.max(0, Number(stats.exactScores) || 0);

  const careerScore = points + exactScores * 2;

  return {
    points,
    exactScores,
    careerScore,
    level: getCareerLevel(careerScore),
  };
}

// Progression vers le niveau suivant, en pourcentage — dérivée des seuils
// ci-dessus mais SANS jamais exposer les seuils eux-mêmes dans l'UI (voir
// note en tête de fichier : "aucun compteur de progression n'est exposé").
// Un pourcentage relatif n'est pas un seuil ; il reste donc conforme à cette
// règle tout en permettant d'afficher une barre de progression. Niveau 30
// (dernier) -> 100 (rien à afficher au-delà, il n'y a pas de "niveau 31").
export function getCareerProgressPercent(careerScore: number): number {
  const score = Math.max(0, Number(careerScore) || 0);
  const level = getCareerLevel(score);

  if (level >= CAREER_LEVEL_THRESHOLDS.length) return 100;

  const currentThreshold = CAREER_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = CAREER_LEVEL_THRESHOLDS[level] ?? currentThreshold;
  const span = nextThreshold - currentThreshold;

  if (span <= 0) return 100;

  return Math.min(100, Math.max(0, Math.round(((score - currentThreshold) / span) * 100)));
}

// 30 titres, un par niveau (index 0 = niveau 1) — seule source de vérité,
// affichée à la fois sur l'Accueil (badge "Niveau") et sur le Profil
// ("Niveau de carrière"). Contenu inchangé, simplement déplacé hors de
// src/routes/index.tsx pour éviter de le dupliquer sur une deuxième page.
export const CAREER_LEVEL_TITLES: readonly string[] = [
  "Débutant",
  "Apprenti",
  "Novice",
  "Amateur",
  "Confirmé",
  "Régulier",
  "Compétiteur",
  "Averti",
  "Spécialiste",
  "Expert",
  "Stratège",
  "Tacticien",
  "Maître",
  "Élite",
  "Grand Maître",
  "Virtuose",
  "Maître Prono",
  "Champion",
  "Champion confirmé",
  "Champion d'élite",
  "Légendaire",
  "Icône",
  "Icône majeure",
  "Référence",
  "Grand Stratège",
  "Maître absolu",
  "Légende",
  "Légende ultime",
  "Immortel",
  "Icône de la Ligue",
] as const;

export function getCareerTitle(level: number): string {
  return CAREER_LEVEL_TITLES[Math.max(0, Math.min(level - 1, CAREER_LEVEL_TITLES.length - 1))];
}

// Agrégation multi-saisons (points cumulés + scores exacts cumulés) par
// joueur — même algorithme que celui utilisé sur l'Accueil (jointure
// prediction -> match -> matchday -> season, jamais réinitialisé d'une
// saison à l'autre), extrait ici pour que Profil réutilise EXACTEMENT le
// même calcul plutôt que d'en dupliquer une seconde version.
export type CareerPredictionRow = {
  user_id: string | null;
  match_id: string | number | null;
  points: number | null;
};

export function aggregateCareerStatsByUser<T extends CareerPredictionRow>(
  predictions: T[],
  isExactPrediction: (prediction: T) => boolean,
  // Conservé pour compatibilité d'appel (Classement/Accueil/Profil passent
  // tous un resolver), mais volontairement NON UTILISÉ pour exclure une
  // prédiction — voir le correctif ci-dessous.
  _seasonKeyByMatchId: (matchId: string) => string | null | undefined,
): Map<string, CareerStats> {
  const byUser = new Map<string, CareerStats>();

  for (const prediction of predictions) {
    const uid = prediction.user_id;
    if (!uid) continue;
    if (prediction.match_id == null) continue;

    // BUG CORRIGÉ (audit du point manquant "Points carrière" ≠ "Points") :
    // cette fonction exigeait auparavant une résolution de saison réussie
    // (matchId -> matchday_id -> season_id) pour compter la moindre
    // prédiction — alors que cette clé de saison n'est JAMAIS utilisée
    // ensuite pour regrouper ou filtrer quoi que ce soit, uniquement comme
    // porte d'entrée. Résultat : dès que la chaîne se cassait pour UN match
    // (matchday_id manquant, historique incomplet, match bonus dont le
    // matchday_id pointe vers une autre compétition...), le point déjà
    // comptabilisé par computeLeagueStats() (Classement/Stats/Accueil, qui
    // ne conditionne JAMAIS un point à cette résolution) disparaissait
    // silencieusement de la carrière. La carrière cumule TOUTES les saisons
    // sans jamais réinitialiser : elle doit donc suivre EXACTEMENT les
    // mêmes points que le reste de l'app, y compris les points de la
    // journée en cours calculés en LIVE (pointsByPredictionKey).
    const current = byUser.get(uid) || { points: 0, exactScores: 0, predictionsCount: 0 };
    current.points += Number(prediction.points || 0);
    if (isExactPrediction(prediction)) current.exactScores += 1;
    current.predictionsCount = (current.predictionsCount || 0) + 1;
    byUser.set(uid, current);
  }

  return byUser;
}
