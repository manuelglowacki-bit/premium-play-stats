/**
 * A QUELLE JOURNEE DE LIGUE 1 UN MATCH BONUS SE RATTACHE.
 *
 * Un meme match porte plusieurs lignes `bonus_options` — une par tirage
 * rejoue, parfois sur des journees differentes. La regle, identique a celle
 * de computeLeagueStats (voir `meilleureOptionParMatch` dans
 * leaderboardStats.ts) :
 *
 *   1. la ligne ACTIVE tranche — c'est le tirage en vigueur ;
 *   2. a defaut d'active, la plus RECENTE ;
 *   3. en dernier recours, la premiere rencontree — pour ne jamais perdre
 *      un bonus, meme sur des donnees abimees.
 *
 * Cette fonction existe pour que les pages qui ont besoin du detail par
 * journee n'aient pas a re-ecrire cette regle chacune dans leur coin : deux
 * implementations de la meme regle finissent toujours par diverger, et c'est
 * exactement ce qui est arrive a la page Stats.
 *
 * Elle ne calcule AUCUN point : elle ne fait que rattacher un match a une
 * journee.
 */
export type OptionBonus = {
  matchday_id: string;
  match_id: string;
  is_active?: boolean | null;
  created_at?: string | null;
};

export function journeeParMatchBonus(
  options: readonly OptionBonus[],
): Map<string, string> {
  const meilleure = new Map<string, OptionBonus>();

  options.forEach((option) => {
    const matchId = String(option.match_id);
    const actuelle = meilleure.get(matchId);
    if (!actuelle) {
      meilleure.set(matchId, option);
      return;
    }

    const activeAvant = actuelle.is_active === true;
    const activeApres = option.is_active === true;
    if (activeAvant !== activeApres) {
      if (activeApres) meilleure.set(matchId, option);
      return;
    }

    const dateAvant = actuelle.created_at ? new Date(actuelle.created_at).getTime() : 0;
    const dateApres = option.created_at ? new Date(option.created_at).getTime() : 0;
    if (dateApres > dateAvant) meilleure.set(matchId, option);
  });

  const parMatch = new Map<string, string>();
  meilleure.forEach((option, matchId) => {
    parMatch.set(matchId, String(option.matchday_id));
  });
  return parMatch;
}
