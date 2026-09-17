/**
 * « TA JOURNEE » — LE RESUME PERSONNEL D'UN JOUEUR.
 *
 * Le Debrief raconte la ligue. Cette bulle-ci ne raconte qu'UNE personne :
 * ce qu'elle a marque ce week-end, ou elle en est, et qui elle a double ou
 * s'est fait doubler. C'est la question que chacun se pose en ouvrant le
 * site, et la reponse se trouvait jusqu'ici en comparant deux pages.
 *
 * Ce fichier NE CALCULE AUCUN POINT. Il recoit les parcours deja reconstruits
 * par parcoursSaison — eux-memes bases sur les points du moteur — et se
 * contente de les comparer entre eux.
 *
 * Ce qu'il produit sont des FAITS, pas des phrases : la page decide ensuite
 * comment les dire. Un fait absent (personne double, aucun point marque) est
 * `null` et non une phrase vide : c'est a l'affichage de ne rien montrer.
 */

export type EtapeJoueur = {
  numero: number;
  rang: number;
  points: number;
  gainJournee: number;
};

export type ParcoursJoueur = {
  id: string;
  nom: string;
  etapes: readonly EtapeJoueur[];
};

export type ResumePerso = {
  /** La journee racontee. */
  journee: number;
  nom: string;
  /** Points marques SUR cette journee. */
  gain: number;
  /** Rang au soir de cette journee. */
  rang: number;
  /** Total cumule. */
  points: number;
  /** Rang la veille, `null` s'il n'y a pas de journee precedente. */
  rangVeille: number | null;
  /** Places gagnees sur la journee. Positif = montee, 0 = surplace. */
  mouvement: number;
  /** Ceux qu'il a doubles sur cette journee. */
  doubles: string[];
  /** Ceux qui l'ont double. */
  doublePar: string[];
  /** Points de retard sur la tete, 0 s'il est en tete. */
  retard: number;
  /** Combien de joueurs au classement. */
  participants: number;
  /** A-t-il fait la meilleure journee de tous ? */
  meilleureJournee: boolean;
};

/**
 * @param moi L'identifiant du joueur connecte.
 * @param parcours Le parcours de TOUS les joueurs, journees dans l'ordre.
 * @param journee La journee racontee.
 * @returns `null` si ce joueur n'a pas de parcours pour cette journee — il
 *   vaut mieux ne rien montrer qu'une bulle a moitie vide.
 */
export function resumeDuJoueur(
  moi: string,
  parcours: readonly ParcoursJoueur[],
  journee: number,
): ResumePerso | null {
  const etapeDe = (p: ParcoursJoueur, numero: number) =>
    p.etapes.find((e) => e.numero === numero) ?? null;

  const lui = parcours.find((p) => String(p.id) === String(moi));
  if (!lui) return null;

  const etape = etapeDe(lui, journee);
  if (!etape) return null;

  // La journee precedente est celle qui precede dans SON parcours, et non
  // `journee - 1` : une journee sans match (report, trêve) n'y figure pas,
  // et « il etait 5e la journee d'avant » doit parler de la derniere fois
  // ou un classement a existe.
  const index = lui.etapes.findIndex((e) => e.numero === journee);
  const veille = index > 0 ? lui.etapes[index - 1] : null;

  const doubles: string[] = [];
  const doublePar: string[] = [];

  if (veille) {
    parcours.forEach((autre) => {
      if (String(autre.id) === String(moi)) return;
      const sonAvant = etapeDe(autre, veille.numero);
      const sonApres = etapeDe(autre, journee);
      if (!sonAvant || !sonApres) return;

      // Double : il etait devant moi, il est derriere. Et l'inverse.
      const etaitDevant = sonAvant.rang < veille.rang;
      const estDevant = sonApres.rang < etape.rang;
      if (etaitDevant && !estDevant) doubles.push(autre.nom);
      if (!etaitDevant && estDevant) doublePar.push(autre.nom);
    });
  }

  const meilleurGain = Math.max(
    ...parcours.map((p) => etapeDe(p, journee)?.gainJournee ?? 0),
  );
  const tete = Math.max(...parcours.map((p) => etapeDe(p, journee)?.points ?? 0));

  return {
    journee,
    nom: lui.nom,
    gain: etape.gainJournee,
    rang: etape.rang,
    points: etape.points,
    rangVeille: veille ? veille.rang : null,
    mouvement: veille ? veille.rang - etape.rang : 0,
    doubles,
    doublePar,
    retard: Math.max(0, tete - etape.points),
    participants: parcours.filter((p) => etapeDe(p, journee)).length,
    meilleureJournee: etape.gainJournee > 0 && etape.gainJournee === meilleurGain,
  };
}

/**
 * LE TITRE DE LA BULLE, choisi selon ce qui s'est passe.
 *
 * Un titre unique pour toutes les situations sonnerait faux la moitie du
 * temps : « Belle journee ! » a quelqu'un qui vient de perdre six places est
 * une maladresse, et il s'en souvient.
 */
export function titreResume(r: ResumePerso): string {
  if (r.meilleureJournee) return "La meilleure journée du groupe";
  if (r.rang === 1) return "Tu es en tête";
  if (r.mouvement >= 3) return "Belle remontée";
  if (r.mouvement > 0) return "Tu grimpes";
  if (r.mouvement <= -3) return "Journée compliquée";
  if (r.mouvement < 0) return "Tu recules un peu";
  if (r.gain === 0) return "Journée blanche";
  return "Tu tiens ta place";
}

/**
 * LE PODIUM — l'accueil change d'habit pour les trois premiers.
 *
 * Etre premier ne devrait pas se lire dans un tableau : ca doit se voir en
 * ouvrant le site. Or ni le rang seul ni les points ne racontent une place
 * de leader — ce qui compte, c'est depuis quand on y est et qui souffle
 * dans le cou.
 *
 * LA PLACE EST CELLE DU SOIR DE LA DERNIERE JOURNEE TERMINEE, jamais celle
 * de l'instant. Pendant que les matchs se jouent, les rangs s'echangent
 * plusieurs fois : une couronne qui apparait et disparait le samedi
 * apres-midi ne veut plus rien dire. Elle se fixe a la fin de la journee et
 * tient jusqu'a la suivante — c'est ce qui en fait un titre.
 */
export type PodiumJoueur = {
  /** 1, 2 ou 3. */
  rang: number;
  points: number;
  journee: number;
  /** Journees consecutives a CETTE place exacte, celle-ci comprise. */
  depuis: number;
  /** Journees consecutives sur le podium, celle-ci comprise. */
  surLePodiumDepuis: number;
  /** Le joueur immediatement devant, et l'ecart. `null` pour le premier. */
  devant: { nom: string; ecart: number } | null;
  /** Le joueur immediatement derriere, et l'ecart. */
  derriere: { nom: string; ecart: number } | null;
  /** Vient-il de prendre cette place lors de cette journee ? */
  nouveau: boolean;
};

/**
 * @returns `null` si le joueur n'est pas dans les trois premiers — l'accueil
 *   reste alors celui de tout le monde.
 */
export function podiumDuJoueur(
  moi: string,
  parcours: readonly ParcoursJoueur[],
  journee: number,
): PodiumJoueur | null {
  const etapeDe = (p: ParcoursJoueur, numero: number) =>
    p.etapes.find((e) => e.numero === numero) ?? null;

  const lui = parcours.find((p) => String(p.id) === String(moi));
  if (!lui) return null;

  const etape = etapeDe(lui, journee);
  if (!etape || etape.rang > 3 || etape.rang < 1) return null;

  // Depuis combien de journees d'affilee ? On remonte SON parcours tant que
  // la condition tient. Les journees absentes (report, treve) ne cassent pas
  // la serie : c'est la suite de ses classements qui compte, pas le
  // calendrier.
  const index = lui.etapes.findIndex((e) => e.numero === journee);
  let depuis = 0;
  let surLePodiumDepuis = 0;
  for (let i = index; i >= 0; i -= 1) {
    if (lui.etapes[i].rang === etape.rang) depuis += 1;
    else break;
  }
  for (let i = index; i >= 0; i -= 1) {
    if (lui.etapes[i].rang <= 3) surLePodiumDepuis += 1;
    else break;
  }

  const classement = parcours
    .map((p) => ({ nom: p.nom, etape: etapeDe(p, journee) }))
    .filter((x): x is { nom: string; etape: EtapeJoueur } => x.etape !== null)
    .sort((a, b) => a.etape.rang - b.etape.rang);

  const place = classement.findIndex((x) => x.etape.rang === etape.rang && x.nom === lui.nom);
  const devantLui = place > 0 ? classement[place - 1] : null;
  const derriereLui = place >= 0 && place < classement.length - 1 ? classement[place + 1] : null;

  return {
    rang: etape.rang,
    points: etape.points,
    journee,
    depuis,
    surLePodiumDepuis,
    devant: devantLui
      ? { nom: devantLui.nom, ecart: Math.max(0, devantLui.etape.points - etape.points) }
      : null,
    derriere: derriereLui
      ? { nom: derriereLui.nom, ecart: Math.max(0, etape.points - derriereLui.etape.points) }
      : null,
    nouveau: depuis === 1 && index > 0,
  };
}

/** Le mot qui va avec la place. Le premier n'est pas « 1er », il est patron. */
export function titrePodium(p: PodiumJoueur): string {
  if (p.rang === 1) return p.nouveau ? "Tu prends la tête" : "Tu es le patron";
  if (p.rang === 2) return p.nouveau ? "Tu montes sur le podium" : "Dauphin";
  return p.nouveau ? "Tu entres sur le podium" : "Sur le podium";
}
