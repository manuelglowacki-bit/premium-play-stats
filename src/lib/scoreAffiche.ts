/**
 * QUEL SCORE AFFICHER SOUS UN MATCH
 *
 * La page Pronos ne lisait que Supabase dès qu'un match passait « terminé » :
 * le score de l'API n'était alors plus jamais consulté. Un match joué mais pas
 * encore synchronisé n'affichait donc ni score ni points — alors que l'API les
 * donnait, et que le Classement, lui, les utilisait déjà
 * (reconcileMatchWithLive, src/lib/liveMatches.ts). Les deux pages se
 * contredisaient sur le même match.
 *
 * Ces deux fonctions sont sorties ici pour être vérifiables : c'est la règle
 * qui décide ce que voient les joueurs sous chaque rencontre.
 */

export type ScoreLu = { home: number; away: number };

export type MatchLisible = {
  home_score?: number | null;
  away_score?: number | null;
};

/**
 * Le score renvoyé par l'API, quel que soit le nom du champ.
 *
 * MÊMES ALIAS que reconcileMatchWithLive : les deux doivent lire la même
 * chose, sinon la page Pronos et le Classement finissent par afficher deux
 * scores différents pour le même match.
 */
export function scoreApi(live: unknown, cote: "home" | "away"): number | null {
  if (live == null || typeof live !== "object") return null;
  const source = live as Record<string, unknown>;

  const brut =
    cote === "home"
      ? (source.scoreDomicile ?? source.scoreHome ?? source.homeScore ?? source.home_score ?? null)
      : (source.scoreExterieur ??
        source.scoreAway ??
        source.awayScore ??
        source.away_score ??
        null);

  if (brut == null || brut === "") return null;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : null;
}

/**
 * Score d'un match TERMINÉ : la base d'abord, l'API en secours.
 *
 * L'ordre compte. Un score saisi ou corrigé à la main par l'admin doit
 * l'emporter sur l'API : c'est lui qui fait foi au classement, et une
 * correction manuelle ne doit pas être écrasée à l'écran par une valeur
 * périmée.
 *
 * `null` ne veut pas dire zéro : il veut dire « aucune source ne connaît ce
 * score ». L'appelant affiche alors « Résultat en attente » plutôt qu'un
 * 0 — 0 qui serait un mensonge.
 */
export function scoreTermine(match: MatchLisible, live: unknown): ScoreLu | null {
  const home = match.home_score ?? scoreApi(live, "home");
  const away = match.away_score ?? scoreApi(live, "away");

  if (home == null || away == null) return null;

  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;

  return { home: h, away: a };
}
