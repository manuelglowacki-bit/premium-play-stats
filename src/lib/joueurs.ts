/**
 * CE QUE LES DONNEES NE DISENT PAS SUR LES JOUEURS.
 *
 * Deux choses manquent a la base pour ecrire un article correct, et aucune
 * ne peut etre devinee :
 *
 *   1. LE GENRE. « Il a marque 7 points » est faux pour Lulu. Un prenom ne
 *      dit pas le genre de quelqu'un, et un pseudo encore moins : la seule
 *      facon honnete de le savoir est qu'on nous le dise. C'est fait :
 *      l'organisateur a indique que Lulu et Mel11 sont des joueuses et que
 *      le reste de la ligue est masculin. Ce ne sont donc pas des
 *      suppositions, mais ce qu'il a declare sur SES vingt-trois joueurs.
 *
 *      ATTENTION pour la suite : cette declaration couvre la ligue telle
 *      qu'elle est aujourd'hui. Un joueur qui arriverait plus tard serait
 *      ecrit au masculin sans que personne l'ait dit — il faut donc
 *      l'ajouter ici a son inscription. Le neutre existe toujours
 *      (`genreDe` sait le rendre) : il suffit de mettre "neutre".
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
  // LES JOUEUSES, nommees par l'organisateur.
  lulu: "feminin",
  mel11: "feminin",
  mel: "feminin",
};

/**
 * Le genre de ceux qui ne sont pas nommes ci-dessus.
 *
 * « Lulu et Mel se sont des filles, le reste des garcons » : le masculin
 * n'est donc pas un defaut technique commode, c'est ce que l'organisateur a
 * dit de sa ligue. Une valeur ecrite ici, en clair, plutot que cachee dans
 * le code — pour qu'on sache d'ou elle vient et qu'on puisse la remettre a
 * "neutre" le jour ou la ligue s'ouvre a des joueurs qu'on ne connait pas.
 */
const GENRE_PAR_DEFAUT: Genre = "masculin";

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

/** @returns Le genre declare, ou celui de la ligue a defaut. */
export function genreDe(pseudo: string | null | undefined): Genre {
  return GENRES[clefPseudo(pseudoActuel(pseudo))] ?? GENRE_PAR_DEFAUT;
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
