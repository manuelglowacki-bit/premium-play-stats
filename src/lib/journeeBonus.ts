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

/**
 * LE MATCH BONUS EN VIGUEUR POUR CHAQUE JOURNEE.
 *
 * L'inverse du precedent : journee -> match, et un seul. Une journee peut
 * porter plusieurs lignes `bonus_options` (un retirage qui n'a pas desactive
 * l'ancienne ligne). Pour les POINTS, toutes comptent — un joueur qui a
 * pronostique sur l'ancien tirage garde ses points, c'est le moteur qui
 * tranche. Mais pour savoir si une journee est FINIE, une seule compte :
 * celle du tirage en vigueur. Sans cela, un match d'un tirage abandonne, qui
 * ne sera peut-etre jamais joue, bloque la journee pour toujours.
 *
 * Meme ordre de priorite que `journeeParMatchBonus` :
 *   1. une ligne ACTIVE bat une ligne desactivee ;
 *   2. a egalite, la plus RECENTE ;
 *   3. a egalite parfaite, l'identifiant de match le plus petit — un
 *      depart arbitraire mais STABLE, pour que deux affichages de la meme
 *      journee ne se contredisent jamais.
 *
 * Ne calcule aucun point.
 */
export function bonusEnVigueurParJournee(
  options: readonly OptionBonus[],
): Map<string, string> {
  const meilleure = new Map<string, OptionBonus>();

  options.forEach((option) => {
    const journeeId = String(option.matchday_id);
    const actuelle = meilleure.get(journeeId);
    if (!actuelle) {
      meilleure.set(journeeId, option);
      return;
    }

    const activeAvant = actuelle.is_active === true;
    const activeApres = option.is_active === true;
    if (activeAvant !== activeApres) {
      if (activeApres) meilleure.set(journeeId, option);
      return;
    }

    const dateAvant = actuelle.created_at ? new Date(actuelle.created_at).getTime() : 0;
    const dateApres = option.created_at ? new Date(option.created_at).getTime() : 0;
    if (dateApres !== dateAvant) {
      if (dateApres > dateAvant) meilleure.set(journeeId, option);
      return;
    }

    if (String(option.match_id) < String(actuelle.match_id)) {
      meilleure.set(journeeId, option);
    }
  });

  const parJournee = new Map<string, string>();
  meilleure.forEach((option, journeeId) => {
    parJournee.set(journeeId, String(option.match_id));
  });
  return parJournee;
}
