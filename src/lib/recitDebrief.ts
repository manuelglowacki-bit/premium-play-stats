/**
 * LE TEXTE DU DEBRIEF.
 *
 * La page affichait des blocs de donnees avec des etiquettes : « +17 places »,
 * « 25 pts », « 20e → 7e → 3e ». Exact, mais ce n'est pas un article. Ici on
 * ecrit des PHRASES : « Parti de la vingtieme place, Sanji est aujourd'hui
 * sur le podium, a egalite avec le leader. »
 *
 * Cette fonction ne calcule RIEN. Elle recoit des chiffres deja etablis
 * (rangs, points, parcours) et ne fait que les mettre en francais — accords
 * compris, ce qui est precisement ce qu'un gabarit ne sait pas faire seul.
 */

import { accordsDe } from "./joueurs";

export type EtapeRecit = {
  numero: number;
  rang: number;
  points: number;
  gainJournee: number;
  exactScores?: number;
};

export type FicheRecit = {
  id: string;
  name: string;
  rang: number;
  points: number;
  exactScores: number;
  /** Places gagnees DEPUIS LE DEBUT. Positif = montee. */
  progression: number;
  /** Places gagnees SUR LA SEULE journee racontee. Positif = montee. */
  mouvement: number;
  /** Rang au soir de la journee precedente, `null` s'il n'y en a pas. */
  rangVeille?: number | null;
  derniereJournee: number;
  etapes: EtapeRecit[];
};

export type EntreesRecit = {
  journeesJouees: number;
  numeroDerniereJournee: number;
  fiches: FicheRecit[];
  /** Ceux qui ont gagne des places SUR la journee racontee. */
  remontees: FicheRecit[];
  /** Ceux qui en ont perdu SUR la journee racontee. */
  chutes: FicheRecit[];
  meilleureJournee: FicheRecit | null;
  densite: { joueurs: number; points: number } | null;
  exAequoTete: number;
};

/**
 * LE PARCOURS D'UN JOUEUR, MONTRE ET PAS SEULEMENT RACONTE.
 *
 * « J1 : 17e — 5 pts / J2 : 9e — 9 pts / J3 : 6e — 16 pts / J4 : 1er — 25 pts »
 * se lit d'un coup d'oeil, la ou la meme chose en prose demande un effort.
 * Le texte garde la phrase ; la page dessine l'echelle a cote. Aucun chiffre
 * n'est calcule ici : ce sont les etapes deja reconstruites par
 * parcoursSaison.
 */
export type EchelleParcours = {
  nom: string;
  etapes: EtapeRecit[];
};

/**
 * UN ENCADRE STATISTIQUE, celui d'un magazine : peu de chiffres, choisis.
 * « 25 POINTS — FCS, Lulu, Sanji » en dit plus qu'un tableau de vingt-trois
 * lignes, parce qu'on le lit d'un coup d'oeil.
 */
export type EncadreRecit = {
  titre: string;
  groupes: { valeur: string; noms: string[] }[];
  note?: string;
};

/**
 * UN ARTICLE DE LA PAGE. La structure est celle d'une copie de journal :
 * un intertitre, des paragraphes, parfois une phrase forte detachee et un
 * encadre. Le texte ne connait ni Tailwind ni couleurs — la page s'en
 * charge, et peut changer d'habillage sans qu'une ligne de redaction bouge.
 */
export type SectionRecit = {
  /**
   * L'IDENTITE DE L'ARTICLE, stable dans le temps.
   *
   * L'intertitre contient un pseudo et change donc d'une journee a l'autre
   * (« FCS, de l'ombre a la lumiere » devient « Lulu, … »). Les reactions des
   * joueurs doivent se rattacher a quelque chose qui ne bouge pas : c'est
   * cette clef, et non le titre affiche.
   */
  cle: string;
  intertitre: string;
  paragraphes: string[];
  /** La phrase detachee en gros caracteres, s'il y en a une. */
  phraseForte?: string;
  /** L'encadre chiffre, s'il apporte quelque chose. */
  encadre?: EncadreRecit;
  /** Les parcours a dessiner, s'il y en a. */
  echelles?: EchelleParcours[];
};

export type Recit = {
  surtitre: string;
  titre: string;
  sousTitre: string;
  /** Le chapo, en plusieurs paragraphes — c'est lui qui donne envie. */
  chapeau: string[];
  sections: SectionRecit[];
};

/**
 * Les chiffres qui comptent sont encadres de `**` dans le texte, comme dans
 * un message. La page les met en couleur ; ailleurs (un test, un copier-
 * coller) ils restent lisibles tels quels. `sansAccents` les retire.
 */
export function sansAccents(texte: string): string {
  return texte.replace(/\*\*/g, "");
}

/** Decoupe un paragraphe en morceaux, en signalant ceux a mettre en avant. */
export function morceaux(texte: string): { texte: string; accent: boolean }[] {
  return texte
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((bout) => bout !== "")
    .map((bout) =>
      bout.startsWith("**") && bout.endsWith("**")
        ? { texte: bout.slice(2, -2), accent: true }
        : { texte: bout, accent: false },
    );
}

/** « 1er », « 2e », « 23e ». */
export function rangEcrit(rang: number): string {
  return rang === 1 ? "1er" : `${rang}e`;
}

/** « une place » / « trois places » — jusqu'a dix, puis en chiffres. */
export function nombreEcrit(n: number): string {
  const mots = [
    "zéro", "une", "deux", "trois", "quatre", "cinq",
    "six", "sept", "huit", "neuf", "dix",
  ];
  const v = Math.abs(Math.round(n));
  return v <= 10 ? mots[v] : String(v);
}

function places(n: number): string {
  const v = Math.abs(n);
  return `${nombreEcrit(v)} place${v > 1 ? "s" : ""}`;
}

/**
 * « une place gagnee », « deux places gagnees ». Le participe s'accorde avec
 * « place » : le coller a la main donnait « une place gagnees ».
 */
function placesGagnees(n: number): string {
  return `${places(n)} gagnée${Math.abs(n) > 1 ? "s" : ""}`;
}

/** « Lulu et Sanji », « Lulu, Sanji et Max » — jamais « Lulu, Sanji ». */
export function listeFr(noms: readonly string[]): string {
  if (noms.length === 0) return "";
  if (noms.length === 1) return noms[0];
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

function pts(n: number): string {
  return `${n} point${Math.abs(n) > 1 ? "s" : ""}`;
}

/** « 17e, puis 9e, puis 6e, et enfin 1er ». */
export function parcoursEcrit(etapes: readonly EtapeRecit[]): string {
  const rangs = etapes.map((e) => rangEcrit(e.rang));
  if (rangs.length === 0) return "";
  if (rangs.length === 1) return rangs[0];
  if (rangs.length === 2) return `${rangs[0]}, puis ${rangs[1]}`;
  const debut = rangs.slice(0, -1).join(", puis ");
  // « et enfin 3e » apres « puis 3e » sonne faux : il n'a pas bouge.
  const dernier = rangs[rangs.length - 1];
  const liaison = dernier === rangs[rangs.length - 2] ? "et toujours" : "et enfin";
  return `${debut}, ${liaison} ${dernier}`;
}


// ------------------------------------------------------------------
// LES ACCORDS
// ------------------------------------------------------------------
// Un gabarit qui ecrit « il » pour tout le monde se trompe sur une vraie
// personne. Quand le genre n'est pas connu, on n'invente pas : on repete le
// nom. C'est un peu plus lourd, et c'est toujours juste.

/** « Il » / « Elle » en debut de phrase, ou le nom au neutre. */
function Il(f: FicheRecit): string {
  const a = accordsDe(f.name);
  return a.aUnPronom ? a.il.replace(/^./, (c) => c.toUpperCase()) : `**${f.name}**`;
}

/** « il » / « elle » en milieu de phrase, ou le nom au neutre. */
function il(f: FicheRecit): string {
  const a = accordsDe(f.name);
  return a.aUnPronom ? a.il : `**${f.name}**`;
}

/** « lui » / « elle » apres une preposition, ou le nom au neutre. */
function lui(f: FicheRecit): string {
  const a = accordsDe(f.name);
  return a.aUnPronom ? a.lui : `**${f.name}**`;
}

/** « le joueur » / « la joueuse ». */
function leJoueur(f: FicheRecit): string {
  return accordsDe(f.name).leJoueur;
}

/** Le « e » d'un participe : « installé » / « installée ». */
function e(f: FicheRecit): string {
  return accordsDe(f.name).e;
}

const maj = (texte: string) => texte.replace(/^./, (c) => c.toUpperCase());

/** Les joueurs regroupes par total de points, du meilleur au moins bon. */
function groupesDePoints(fiches: readonly FicheRecit[], combien: number) {
  const parPoints = new Map<number, string[]>();
  fiches.slice(0, combien).forEach((f) => {
    parPoints.set(f.points, [...(parPoints.get(f.points) ?? []), f.name]);
  });
  return [...parPoints.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([valeur, noms]) => ({ valeur: `${valeur} pts`, noms }));
}

export function ecrireRecit(e_: EntreesRecit): Recit | null {
  if (e_.fiches.length === 0) return null;

  const jN = e_.journeesJouees;
  const journee = e_.numeroDerniereJournee;
  const journees = `${nombreEcrit(jN)} journée${jN > 1 ? "s" : ""}`;
  const fiches = e_.fiches;
  const leader = fiches[0];
  const sections: SectionRecit[] = [];

  // UN JOUEUR, UN ARTICLE. Sans ce garde-fou, le meme nom revenait dans « en
  // embuscade » ET dans « ils ont gagne du terrain » : le lecteur a
  // l'impression que l'article se repete, et il a raison.
  const dejaCites = new Set<string>();

  // Ceux qui comptent exactement le meme total que la tete.
  const exAequo = fiches.filter((f) => f.points === leader.points);
  // Le peloton de tete : tout le monde a un point ou moins du leader.
  const groupeTete = fiches.filter((f) => leader.points - f.points <= 1);

  // ------------------------------------------------------------------
  // LA UNE
  // ------------------------------------------------------------------
  const titre =
    e_.densite && e_.densite.joueurs >= 3
      ? `Après ${jN} journée${jN > 1 ? "s" : ""}, la course est plus ouverte que jamais`
      : exAequo.length > 1
        ? `${maj(nombreEcrit(exAequo.length))} joueurs à égalité en tête`
        : `${leader.name} prend les commandes`;

  const sousTitre =
    exAequo.length > 1
      ? `${leader.name} a pris les commandes, mais rien n'est joué. ` +
        `${maj(nombreEcrit(exAequo.length))} joueurs comptent **${pts(leader.points)}**` +
        (groupeTete.length > exAequo.length
          ? ` et les ${nombreEcrit(groupeTete.length)} premiers ne sont séparés que par une seule longueur.`
          : ".")
      : `${leader.name} mène avec **${pts(leader.points)}**` +
        (fiches[1]
          ? `, mais ${fiches[1].name} n'est qu'à **${pts(leader.points - fiches[1].points)}**.`
          : ".");

  // ------------------------------------------------------------------
  // LE CHAPO — plusieurs paragraphes courts, comme dans un journal.
  // ------------------------------------------------------------------
  const chapeau: string[] = [];

  chapeau.push(
    `Après ${journees}, le Prono Ligue 1 LM est déjà en train de livrer un ` +
      `scénario digne des plus grands championnats.`,
  );

  chapeau.push(
    `Alors que la journée ${journee} vient de redistribuer les cartes, ` +
      `**${leader.name}** s'est ${
        accordsDe(leader.name).aUnPronom ? `installé${e(leader)}` : "hissé"
      } en tête du classement avec **${pts(leader.points)}**.` +
      (exAequo.length > 1
        ? ` Mais derrière ${accordsDe(leader.name).aUnPronom ? lui(leader) : "le leader"}, la menace est immédiate : ` +
          `**${listeFr(exAequo.slice(1).map((f) => f.name))}** ` +
          `compte${exAequo.length > 2 ? "nt" : ""} exactement le même total.`
        : fiches[1]
          ? ` Mais **${fiches[1].name}** ne lâche rien, à **${pts(leader.points - fiches[1].points)}** seulement.`
          : ""),
  );

  const juste = groupeTete.filter((f) => !exAequo.includes(f));
  if (juste.length > 0) {
    chapeau.push(
      `Et comme si cela ne suffisait pas, **${listeFr(juste.map((f) => f.name))}** ` +
        `${juste.length > 1 ? "ne sont" : "n'est"} qu'à une longueur.`,
    );
  }

  if (groupeTete.length >= 3) {
    chapeau.push(`${maj(nombreEcrit(groupeTete.length))} joueurs dans un seul point. La bataille est lancée.`);
  }

  // ------------------------------------------------------------------
  // LE LEADER
  // ------------------------------------------------------------------
  {
    const p: string[] = [];
    const depart = leader.etapes[0]?.rang ?? leader.rang;
    const intertitre =
      leader.progression >= 5
        ? `${leader.name}, de l'ombre à la lumière`
        : leader.progression > 0
          ? `${leader.name}, la montée en puissance`
          : `${leader.name} tient la barre`;

    if (leader.etapes.length > 1 && leader.progression > 0) {
      const etapes = leader.etapes;
      p.push(
        `**${leader.name}** avait commencé la compétition à la **${rangEcrit(depart)} place**` +
          (etapes[0].points ? ` avec **${pts(etapes[0].points)}**` : "") + `.`,
      );
      if (etapes.length >= 3) {
        p.push(
          `${Il(leader)} est ensuite ${accordsDe(leader.name).aUnPronom ? "remonté" + e(leader) : "remonté"} à la ` +
            `**${rangEcrit(etapes[1].rang)} place** après la journée ${etapes[1].numero}, avant de ` +
            `${etapes[2].rang <= etapes[1].rang ? "s'installer" : "reculer"} à la ` +
            `**${rangEcrit(etapes[etapes.length - 2].rang)} place** à l'issue de la journée ` +
            `${etapes[etapes.length - 2].numero}.`,
        );
      }
      p.push(
        `Et lors de la journée ${journee}, tout s'est accéléré.` +
          (leader.derniereJournee > 0
            ? ` Avec **${pts(leader.derniereJournee)}** supplémentaires, ` +
              `${accordsDe(leader.name).aUnPronom ? il(leader) : `**${leader.name}**`} s'est ` +
              `${accordsDe(leader.name).aUnPronom ? `emparé${e(leader)}` : "emparé"} de la première place ` +
              `avec **${pts(leader.points)}**.`
            : ""),
      );
      p.push(
        `De la **${rangEcrit(depart)}** à la **première place** en ${journees}. ` +
          `Une remontée de **${places(leader.progression)}**.`,
      );
    } else {
      p.push(
        `**${leader.name}** mène le classement avec **${pts(leader.points)}**` +
          (leader.etapes.length > 1
            ? `, au terme d'un parcours d'une régularité rare : **${parcoursEcrit(leader.etapes)}**.`
            : "."),
      );
      if (leader.derniereJournee > 0) {
        p.push(
          `Sur la seule journée ${journee}, ${accordsDe(leader.name).aUnPronom ? il(leader) : `**${leader.name}**`} ` +
            `a ajouté **${pts(leader.derniereJournee)}** à son total.`,
        );
      }
    }

    if (leader.exactScores > 0) {
      p.push(
        `${Il(leader)} compte également **${nombreEcrit(leader.exactScores)} score` +
          `${leader.exactScores > 1 ? "s" : ""} exact${leader.exactScores > 1 ? "s" : ""}** — ` +
          `c'est précisément là que se décident les fins de saison, quand deux joueurs ` +
          `arrivent au même total.`,
      );
    }

    dejaCites.add(leader.id);
    sections.push({
      cle: "leader",
      intertitre,
      paragraphes: p,
      phraseForte:
        leader.progression >= 5
          ? `${leader.name} était parti dans l'ombre. ${maj(il(leader))} est désormais sous les projecteurs.`
          : undefined,
      echelles: leader.etapes.length >= 2 ? [{ nom: leader.name, etapes: leader.etapes }] : undefined,
    });
  }

  // ------------------------------------------------------------------
  // LE HAUT DU CLASSEMENT
  // ------------------------------------------------------------------
  if (groupeTete.length >= 2) {
    const p: string[] = [];

    if (exAequo.length > 1) {
      p.push(
        `**${listeFr(exAequo.map((f) => f.name))}** sont tous ` +
          `${exAequo.length === 2 ? "les deux" : `les ${nombreEcrit(exAequo.length)}`} ` +
          `à **${pts(leader.points)}**.`,
      );
    }
    if (juste.length > 0) {
      p.push(
        `**${listeFr(juste.map((f) => f.name))}** ${juste.length > 1 ? "suivent" : "suit"} ` +
          `avec **${pts(juste[0].points)}**.`,
      );
    }
    p.push(
      `Autrement dit : les **${nombreEcrit(groupeTete.length)} premiers** sont séparés par ` +
        `**un seul point**. À ce niveau de densité, la moindre erreur lors de la journée ` +
        `${journee + 1} peut redessiner tout le podium — et un score exact suffit à ` +
        `faire basculer une place.`,
    );

    sections.push({
      cle: "tete",
      intertitre:
        exAequo.length > 1
          ? `${maj(nombreEcrit(exAequo.length))} joueurs, un même objectif`
          : `Le haut du classement se tient en un point`,
      paragraphes: p,
      encadre: {
        titre: "En tête",
        groupes: groupesDePoints(groupeTete, groupeTete.length),
      },
    });
  }

  // ------------------------------------------------------------------
  // LA PLUS BELLE REMONTEE DE LA SAISON
  // ------------------------------------------------------------------
  const grimpeur =
    [...fiches]
      .filter((f) => f.id !== leader.id && f.progression > 0 && f.etapes.length >= 3)
      .sort((a, b) => b.progression - a.progression || a.rang - b.rang)[0] ?? null;

  if (grimpeur && grimpeur.progression >= 3) {
    const depart = grimpeur.etapes[0]?.rang ?? grimpeur.rang;
    const p: string[] = [
      `**${grimpeur.name}** était **${rangEcrit(depart)}** après la première journée. ` +
        `${maj(il(grimpeur))} est aujourd'hui **${rangEcrit(grimpeur.rang)}**, avec ` +
        `**${pts(grimpeur.points)}**.`,
      `Son parcours, journée après journée : **${parcoursEcrit(grimpeur.etapes)}**. ` +
        `Soit **${placesGagnees(grimpeur.progression)}** depuis le début de la compétition.`,
    ];
    if (grimpeur.rang <= 3) {
      p.push(
        `Et il ne s'agit pas d'un simple coup d'éclat : ${il(grimpeur)} confirme journée ` +
          `après journée, au point de figurer désormais sur le podium.`,
      );
    }

    dejaCites.add(grimpeur.id);
    sections.push({
      cle: "grimpeur",
      intertitre: `${grimpeur.name}, la remontée qui impressionne`,
      paragraphes: p,
      phraseForte:
        grimpeur.rang <= 3
          ? `Il y a ${journees}, ${grimpeur.name} regardait le podium de loin. Aujourd'hui, ${il(grimpeur) || grimpeur.name} y est.`
          : undefined,
      echelles: [{ nom: grimpeur.name, etapes: grimpeur.etapes }],
    });
  }

  // ------------------------------------------------------------------
  // LA REGULARITE
  // ------------------------------------------------------------------
  // Celui dont le classement ne bouge presque jamais, et jamais vers le bas.
  // Une qualite invisible dans un tableau, et decisive sur une saison.
  const regulier =
    [...fiches]
      .filter(
        (f) =>
          f.id !== leader.id &&
          f.id !== grimpeur?.id &&
          f.rang <= 6 &&
          f.etapes.length >= 3 &&
          f.etapes.every((etape, i, tout) => i === 0 || etape.rang <= tout[i - 1].rang + 1),
      )
      .sort((a, b) => a.rang - b.rang)[0] ?? null;

  if (regulier) {
    const p: string[] = [
      `**${regulier.name}** n'a jamais vraiment quitté le groupe de tête : ` +
        `**${parcoursEcrit(regulier.etapes)}**.`,
      `Les totaux disent la même chose — ` +
        `**${regulier.etapes.map((etape) => `${etape.points}`).join(" → ")} points** — ` +
        `une progression sans accroc, sans la moindre journée blanche.`,
      `${maj(il(regulier))} est aujourd'hui **${rangEcrit(regulier.rang)}**` +
        (regulier.points === leader.points
          ? `, à égalité parfaite de points avec **${leader.name}**.`
          : `, à **${pts(leader.points - regulier.points)}** de la tête.`),
    ];

    dejaCites.add(regulier.id);
    sections.push({
      cle: "regulier",
      intertitre: `${regulier.name}, la régularité qui paie`,
      paragraphes: p,
      phraseForte: `${regulier.name} ne fait pas de bruit. ${maj(accordsDe(regulier.name).aUnPronom ? il(regulier) : regulier.name)} avance. Et ${accordsDe(regulier.name).aUnPronom ? il(regulier) : regulier.name} est désormais à ${pts(regulier.points)}.`,
    });
  }

  // ------------------------------------------------------------------
  // L'ANCIEN LEADER
  // ------------------------------------------------------------------
  const ancienLeader = fiches.find((f) => f.rangVeille === 1 && f.rang !== 1) ?? null;

  if (ancienLeader) {
    const ecart = leader.points - ancienLeader.points;
    const p: string[] = [
      `**${ancienLeader.name}** a mené le classement à l'issue de la journée ` +
        `${journee - 1}. La journée ${journee} lui a coûté ` +
        `**${places(ancienLeader.mouvement)}** : ${il(ancienLeader) || ancienLeader.name} pointe ` +
        `désormais **${rangEcrit(ancienLeader.rang)}**.`,
    ];
    if (ancienLeader.derniereJournee > 0) {
      p.push(
        `Mais attention : ${il(ancienLeader) || `**${ancienLeader.name}**`} n'a absolument pas raté ` +
          `sa journée. ${maj(il(ancienLeader))} a ajouté **${pts(ancienLeader.derniereJournee)}** à son total. ` +
          `Le problème est simplement que ceux qui ${il(ancienLeader) ? "le" : "le"} devancent ont fait mieux.`,
      );
    }
    p.push(
      ecart <= 3
        ? `À **${pts(ecart)}** de la tête, ${il(ancienLeader) || `**${ancienLeader.name}**`} reste ` +
          `pleinement dans la course. Une bonne journée ${journee + 1} et tout est à refaire.`
        : `L'écart est de **${pts(ecart)}**. Rien d'irrattrapable dans un classement aussi dense.`,
    );

    dejaCites.add(ancienLeader.id);
    sections.push({
      cle: "ancien-leader",
      intertitre: `${ancienLeader.name}, le leader qui a perdu sa place… mais pas le contact`,
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // LES EMBUSQUES
  // ------------------------------------------------------------------
  // Ceux qu'on nomme dans le titre sont EXACTEMENT ceux dont on parle : la
  // liste et l'intertitre sortent du meme tableau, sinon l'un annonce deux
  // joueurs et l'autre en raconte trois.
  const embusques = fiches
    .filter(
      (f) =>
        !dejaCites.has(f.id) &&
        f.rang <= 8 &&
        leader.points - f.points <= 3,
    )
    .slice(0, 2);

  if (embusques.length >= 2) {
    const p: string[] = embusques.map(
      (f) =>
        `**${f.name}** : **${parcoursEcrit(f.etapes)}**, pour **${pts(f.points)}**. ` +
          `${maj(il(f))} ${f.mouvement >= 0 ? "se maintient" : "a reculé"} ` +
          `et reste à **${pts(leader.points - f.points)}** du sommet.`,
    );
    p.push(
      `${maj(nombreEcrit(embusques.length))} candidats parfaitement capables de reprendre la ` +
        `première place dès la journée ${journee + 1}. Dans ce classement, une place se ` +
        `reprend en un week-end.`,
    );

    embusques.forEach((f) => dejaCites.add(f.id));
    sections.push({
      cle: "embusques",
      intertitre: `${listeFr(embusques.map((f) => f.name))}, toujours en embuscade`,
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // LES REMONTEES DE LA JOURNEE
  // ------------------------------------------------------------------
  const autresRemontees = e_.remontees.filter((f) => !dejaCites.has(f.id));

  if (autresRemontees.length > 0) {
    const p: string[] = autresRemontees.slice(0, 3).map((f) => {
      const creux = Math.max(...f.etapes.map((etape) => etape.rang));
      const reaction =
        creux > (f.rangVeille ?? f.rang) ? "" : ` Après une journée ${journee - 1} difficile, la réaction est nette.`;
      return (
        `**${f.name}** : **${parcoursEcrit(f.etapes)}**. ` +
        `${maj(il(f))} reprend **${places(f.mouvement)}** sur la seule journée ${journee}` +
        (f.derniereJournee > 0 ? ` grâce à **${pts(f.derniereJournee)}**` : "") +
        `, pour **${pts(f.points)}** au total.${reaction}`
      );
    });

    autresRemontees.slice(0, 3).forEach((f) => dejaCites.add(f.id));
    sections.push({
      cle: "remontees",
      intertitre:
        autresRemontees.length > 1
          ? `Ils ont gagné du terrain ce week-end`
          : `${autresRemontees[0].name}, une remontée qui se confirme`,
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // CEUX QUI ONT PERDU DU TERRAIN
  // ------------------------------------------------------------------
  if (e_.chutes.length > 0) {
    const p: string[] = e_.chutes
      .slice(0, 4)
      .map(
        (f) =>
          `**${f.name}** : **${parcoursEcrit(f.etapes)}**. ` +
          `**${maj(places(f.mouvement))}** perdues sur la journée ${journee}, pour ` +
          `**${pts(f.points)}**.`,
      );

    p.push(
      `Il faut se garder d'y lire des journées ratées. Tous ont continué de marquer — ` +
        (e_.chutes.some((f) => f.derniereJournee > 0)
          ? `${listeFr(e_.chutes.filter((f) => f.derniereJournee > 0).slice(0, 3).map((f) => `**${f.name}** en a pris **${f.derniereJournee}**`))}. `
          : "") +
        `Le classement est simplement si serré qu'une journée un peu moins réussie que ` +
        `celle du voisin coûte immédiatement plusieurs places. Le mouvement inverse est ` +
        `tout aussi rapide.`,
    );

    sections.push({
      cle: "chutes",
      intertitre: `À l'inverse, certains ont perdu du terrain`,
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // LE CHIFFRE A RETENIR
  // ------------------------------------------------------------------
  if (e_.densite && e_.densite.joueurs >= 3) {
    // LE GROUPE SERRE, et lui seul. L'encadre listait les dix premiers pendant
    // que la phrase parlait de ceux tenant en trois points : on lisait
    // « regroupes entre 23 et 25 points » au-dessus d'une ligne a 18. Les deux
    // sortent desormais du meme tableau.
    const paquet = fiches.filter((f) => leader.points - f.points <= e_.densite!.points);
    const dernier = paquet[paquet.length - 1]?.points ?? leader.points;
    const amplitude = leader.points - dernier;

    sections.push({
      cle: "chiffre",
      intertitre: `Le chiffre à retenir`,
      paragraphes: [
        `**${maj(nombreEcrit(paquet.length))} joueurs** sont actuellement regroupés entre ` +
          `**${pts(dernier)}** et **${pts(leader.points)}**` +
          (amplitude > 0
            ? ` — **${nombreEcrit(amplitude)} point${amplitude > 1 ? "s" : ""}** d'amplitude, ` +
              `pas davantage.`
            : `, tous au même total.`) +
          ` C'est dire si tout reste ouvert : un score exact, une bonne journée, et ` +
          `l'ordre du classement change du tout au tout.`,
      ],
      encadre: {
        titre: `Le peloton de tête`,
        groupes: groupesDePoints(paquet, paquet.length),
        note:
          amplitude > 0
            ? `${maj(nombreEcrit(paquet.length))} joueurs en ${pts(amplitude)}.`
            : undefined,
      },
    });
  }

  // ------------------------------------------------------------------
  // LA CONCLUSION
  // ------------------------------------------------------------------
  {
    const p: string[] = [];
    const suivante = journee + 1;

    p.push(
      `La journée ${suivante} arrive, et elle compte double en termes d'enjeu : dans un ` +
        `classement aussi resserré, elle peut aussi bien confirmer un patron qu'en ` +
        `désigner un autre.`,
    );

    // Un nom, une fois. Le grimpeur est souvent aussi un ex aequo de la tete :
    // sans cette garde, la phrase le citait deux fois a six mots d'intervalle.
    const nommes = new Set<string>([leader.id]);
    const enjeux: string[] = [`**${leader.name}** voudra conserver son fauteuil`];

    const auContact = exAequo.filter((f) => !nommes.has(f.id));
    if (auContact.length > 0) {
      auContact.forEach((f) => nommes.add(f.id));
      enjeux.push(
        `**${listeFr(auContact.map((f) => f.name))}** ` +
          `${auContact.length > 1 ? "voudront" : "voudra"} rester au contact`,
      );
    }
    if (ancienLeader && !nommes.has(ancienLeader.id)) {
      nommes.add(ancienLeader.id);
      enjeux.push(`**${ancienLeader.name}** cherchera à reprendre son trône`);
    }
    if (grimpeur && !nommes.has(grimpeur.id)) {
      nommes.add(grimpeur.id);
      enjeux.push(`**${grimpeur.name}** voudra poursuivre sa remontée`);
    }
    if (enjeux.length > 1) p.push(`${listeFr(enjeux)}.`);

    if (e_.chutes.length > 0) {
      p.push(
        `Quant à ceux qui ont reculé, ils savent mieux que personne qu'une seule bonne ` +
          `journée suffit à tout remettre en place.`,
      );
    }

    sections.push({
      cle: "conclusion",
      intertitre: `Cap sur la journée ${suivante}`,
      paragraphes: p,
      phraseForte: e_.densite
        ? `${maj(nombreEcrit(exAequo.length))} joueur${exAequo.length > 1 ? "s" : ""} à ${pts(leader.points)}, ` +
          `${nombreEcrit(groupeTete.length)} dans un seul point et ${nombreEcrit(e_.densite.joueurs)} dans ` +
          `${nombreEcrit(e_.densite.points)} longueur${e_.densite.points > 1 ? "s" : ""} : ` +
          `le Prono Ligue 1 LM n'a jamais semblé aussi indécis.`
        : undefined,
    });
  }

  return {
    surtitre: "Prono Ligue 1 LM — Le grand débrief",
    titre,
    sousTitre,
    chapeau,
    sections,
  };
}
