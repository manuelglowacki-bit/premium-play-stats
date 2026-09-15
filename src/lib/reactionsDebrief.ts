import { EMOJIS_FAVORIS, emojiValide } from "./catalogueEmojis";

/**
 * LES REACTIONS DES JOUEURS SUR LE DEBRIEF.
 *
 * Le Debrief se lisait sans qu'on puisse rien en dire. Chaque article porte
 * desormais une barre de six emojis : un joueur en choisit un, le compteur
 * monte, et tout le monde voit la reaction des autres.
 *
 * Ce fichier ne parle ni a la base ni a l'ecran. Il repond a trois questions,
 * et c'est tout :
 *   - combien de reactions par emoji sur un article ;
 *   - laquelle est la mienne ;
 *   - ce que doit faire un clic (ajouter, changer, retirer).
 *
 * La regle du jeu : UNE reaction par joueur et par article. Cliquer sur celle
 * qu'on a deja choisie la retire ; cliquer sur une autre remplace la
 * precedente. C'est ce que fait n'importe quelle messagerie, et c'est ce que
 * la base impose de son cote (index unique) — les deux doivent dire la meme
 * chose, sinon l'ecran promet ce que la base refuse.
 */

/**
 * LES EMOJIS PROPOSES EN PREMIER, sous l'article.
 *
 * Le choix complet se fait dans le selecteur (src/lib/catalogueEmojis.ts) ;
 * ces douze-la restent a portee de pouce pour ne pas avoir a l'ouvrir a
 * chaque fois. Les six emojis de la toute premiere version y figurent
 * toujours : les retirer ferait disparaitre du choix des reactions deja
 * posees.
 */
export const EMOJIS_DEBRIEF = EMOJIS_FAVORIS;

/** Un emoji, au sens de `emojiValide` : un symbole court, jamais du texte. */
export type EmojiDebrief = string;

/**
 * CE QUI PEUT ETRE ENREGISTRE.
 *
 * Plus une liste fermee mais une regle de forme — « un symbole court, pas du
 * texte » — parce que le selecteur propose desormais des centaines d'emojis
 * et que le catalogue s'enrichira. Une reaction posee aujourd'hui doit rester
 * valable demain.
 *
 * Ce qui compte : sans cette regle, le champ deviendrait du texte libre sur
 * une page lue par vingt-trois personnes. La meme regle est appliquee par la
 * base (contrainte `debrief_reactions_emoji_valide`), qui a le dernier mot :
 * ici c'est du confort, la-bas c'est la garantie.
 */
export function emojiAutorise(emoji: string): emoji is EmojiDebrief {
  return emojiValide(emoji);
}

export type LigneReaction = {
  user_id: string;
  journee: number;
  article: string;
  emoji: string;
};

export type ReactionsArticle = {
  /** Nombre de reactions par emoji, les emojis inconnus exclus. */
  comptes: Record<string, number>;
  /** L'emoji choisi par le joueur qui lit, ou null. */
  lemien: string | null;
  /** Total, pour savoir s'il faut afficher la barre au repos. */
  total: number;
};

/**
 * @param lignes Toutes les reactions chargees, journees confondues.
 * @param journee La journee racontee par le Debrief affiche.
 * @param moi L'identifiant du joueur qui lit (null s'il n'est pas connecte).
 * @returns Pour chaque clef d'article, ses compteurs.
 */
export function reactionsParArticle(
  lignes: readonly LigneReaction[],
  journee: number,
  moi: string | null | undefined,
): Map<string, ReactionsArticle> {
  const parArticle = new Map<string, ReactionsArticle>();

  lignes.forEach((ligne) => {
    if (Number(ligne?.journee) !== Number(journee)) return;
    const article = String(ligne?.article ?? "");
    if (!article) return;
    // Un emoji hors liste ne s'affiche pas. La base le refuse deja, mais une
    // ligne plus ancienne pourrait en porter un : mieux vaut l'ignorer que
    // dessiner un bouton que personne ne peut plus choisir.
    if (!emojiAutorise(String(ligne?.emoji ?? ""))) return;

    const emoji = String(ligne.emoji);
    const actuel = parArticle.get(article) ?? { comptes: {}, lemien: null, total: 0 };
    actuel.comptes[emoji] = (actuel.comptes[emoji] ?? 0) + 1;
    actuel.total += 1;
    if (moi && String(ligne.user_id) === String(moi)) actuel.lemien = emoji;
    parArticle.set(article, actuel);
  });

  return parArticle;
}

/** Ce qu'un clic doit provoquer, decide ici et applique ailleurs. */
export type GesteReaction =
  | { action: "ajouter"; emoji: EmojiDebrief }
  | { action: "remplacer"; emoji: EmojiDebrief }
  | { action: "retirer" }
  | { action: "rien" };

/**
 * @param dejaChoisi L'emoji actuellement choisi par le joueur, ou null.
 * @param clique L'emoji sur lequel il vient de cliquer.
 */
export function gesteAuClic(
  dejaChoisi: string | null | undefined,
  clique: string,
): GesteReaction {
  if (!emojiAutorise(clique)) return { action: "rien" };
  if (!dejaChoisi) return { action: "ajouter", emoji: clique };
  if (String(dejaChoisi) === clique) return { action: "retirer" };
  return { action: "remplacer", emoji: clique };
}

/**
 * L'ETAT AFFICHE IMMEDIATEMENT, sans attendre la reponse du serveur.
 *
 * Un compteur qui met une seconde a bouger donne l'impression que le clic n'a
 * pas marche, et le joueur reclique. On applique donc le geste sur place, et
 * le rechargement confirmera. Fonction pure : elle ne modifie pas l'objet
 * recu, pour que l'etat precedent reste utilisable si l'enregistrement echoue.
 */
export function apresLeGeste(
  actuel: ReactionsArticle | undefined,
  geste: GesteReaction,
): ReactionsArticle {
  const base: ReactionsArticle = {
    comptes: { ...(actuel?.comptes ?? {}) },
    lemien: actuel?.lemien ?? null,
    total: actuel?.total ?? 0,
  };

  const retirerLemien = () => {
    if (!base.lemien) return;
    const reste = (base.comptes[base.lemien] ?? 0) - 1;
    if (reste > 0) base.comptes[base.lemien] = reste;
    else delete base.comptes[base.lemien];
    base.total = Math.max(0, base.total - 1);
    base.lemien = null;
  };

  if (geste.action === "rien") return base;
  if (geste.action === "retirer") {
    retirerLemien();
    return base;
  }

  retirerLemien();
  base.comptes[geste.emoji] = (base.comptes[geste.emoji] ?? 0) + 1;
  base.total += 1;
  base.lemien = geste.emoji;
  return base;
}
