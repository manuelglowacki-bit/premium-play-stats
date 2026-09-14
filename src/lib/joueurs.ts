/**
 * CE QUE LES DONNEES NE DISENT PAS SUR LES JOUEURS.
 *
 * Deux choses manquent a la base pour ecrire un article correct, et aucune
 * ne peut etre devinee :
 *
 *   1. LE GENRE. « Il a marque 7 points » est faux pour Lulu. Un prenom ne
 *      dit pas le genre de quelqu'un, et un pseudo encore moins : la seule
 *      facon honnete de le savoir est qu'on nous le dise. Tant qu'un joueur
 *      n'est pas dans cette liste, le texte l'ecrit au NEUTRE — jamais au
 *      masculin par defaut. Se tromper de genre sur une vraie personne est
 *      une faute que « c'est le defaut » n'excuse pas.
 *
 *   2. LES PSEUDOS CHANGES EN COURS DE SAISON. « North London » a la J1 et
 *      « Jo gunners » ensuite sont le meme joueur. Sans cette table, le
 *      parcours serait coupe en deux et l'article raconterait deux
 *      personnes la ou il n'y en a qu'une.
 *
 * Volontairement un fichier de code et pas une colonne en base :
 * l'organisateur a demande de ne pas toucher a Supabase. Pour une ligue de
 * vingt-trois joueurs, une table lue a l'oeil vaut mieux qu'une migration.
 * Il suffit de me demander pour y ajouter quelqu'un.
 */

export type Genre = "feminin" | "masculin" | "neutre";

/**
 * Genre des joueurs, par pseudo. La comparaison ignore la casse, les accents
 * et les espaces : « Lulu », « lulu » et « LULU » sont la meme personne.
 *
 * N'y figurent que les joueurs dont le genre nous a ete indique.
 */
const GENRES: Record<string, Genre> = {
  // Indique explicitement par l'organisateur.
  lulu: "feminin",

  // Joueurs dont il a parle au masculin dans ses consignes de redaction.
  // Aucun n'est devine a partir du pseudo. Ceux qui ne figurent pas ici
  // sont ecrits au neutre : il suffit de me dire lesquels ajouter.
  fcs: "masculin",
  sanji: "masculin",
  quentin: "masculin",
  "jo gunners": "masculin",
  lapetitepute: "masculin",
  "le lensois de lm": "masculin",
  "le lensoiis de lm": "masculin",
};

/**
 * Anciens pseudos, et le pseudo actuel derriere. A gauche l'ancien, a droite
 * celui qu'il faut afficher et sous lequel tout doit etre regroupe.
 */
const ANCIENS_PSEUDOS: Record<string, string> = {
  "north london": "Jo gunners",
};

/** Meme clef pour « Jo gunners », « jo  gunners » et « JO GUNNERS ». */
export function clefPseudo(pseudo: string | null | undefined): string {
  return String(pseudo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * @returns Le pseudo actuel du joueur. Un pseudo inconnu ressort inchange —
 *   on ne renomme jamais quelqu'un qu'on ne connait pas.
 */
export function pseudoActuel(pseudo: string | null | undefined): string {
  const brut = String(pseudo ?? "").trim();
  return ANCIENS_PSEUDOS[clefPseudo(brut)] ?? brut;
}

/** @returns « neutre » tant que le genre n'a pas ete indique. */
export function genreDe(pseudo: string | null | undefined): Genre {
  return GENRES[clefPseudo(pseudoActuel(pseudo))] ?? "neutre";
}

/**
 * LES MOTS QUI S'ACCORDENT.
 *
 * Le texte ne conjugue pas a la main : il demande ici le mot juste. Au
 * neutre, on evite le pronom plutot que d'en inventer un — « Le joueur a
 * marque » passe partout et ne trahit personne.
 */
export type Accords = {
  /** « il », « elle », ou « » au neutre (a remplacer par le nom). */
  il: string;
  /** Le pronom tonique : « lui », « elle ». « derriere il » n'existe pas. */
  lui: string;
  /** « le joueur » / « la joueuse ». */
  leJoueur: string;
  /** « son parcours » — identique dans les trois cas, mais explicite. */
  son: string;
  /** « installe » / « installee ». */
  e: string;
  /** Vrai quand on peut ecrire « il/elle » sans risque de se tromper. */
  aUnPronom: boolean;
};

export function accordsDe(pseudo: string | null | undefined): Accords {
  const genre = genreDe(pseudo);
  if (genre === "feminin") {
    return { il: "elle", lui: "elle", leJoueur: "la joueuse", son: "son", e: "e", aUnPronom: true };
  }
  if (genre === "masculin") {
    return { il: "il", lui: "lui", leJoueur: "le joueur", son: "son", e: "", aUnPronom: true };
  }
  return { il: "", lui: "", leJoueur: "le joueur", son: "son", e: "", aUnPronom: false };
}
