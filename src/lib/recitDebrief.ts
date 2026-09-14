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
  /** La plus belle trajectoire depuis la 1re journee — une autre histoire. */
  trajectoire?: FicheRecit | null;
  meilleureJournee: FicheRecit | null;
  densite: { joueurs: number; points: number } | null;
  exAequoTete: number;
};

/** La couleur d'une section. La page traduit ces noms en classes ; le texte,
 *  lui, n'a pas a connaitre Tailwind. */
export type TonSection = "or" | "vert" | "rouge" | "bleu" | "violet" | "cyan";

export type SectionRecit = {
  kicker: string;
  titre: string;
  emoji: string;
  ton: TonSection;
  paragraphes: string[];
};

export type Recit = {
  surtitre: string;
  titre: string;
  emoji: string;
  chapeau: string;
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

export function ecrireRecit(e: EntreesRecit): Recit | null {
  if (e.fiches.length === 0) return null;

  const jN = e.journeesJouees;
  const journees = `${nombreEcrit(jN)} journée${jN > 1 ? "s" : ""}`;
  const leader = e.fiches[0];

  // ------------------------------------------------------------------
  // LE CHAPEAU
  // ------------------------------------------------------------------
  const titre =
    e.exAequoTete > 1
      ? `${nombreEcrit(e.exAequoTete)} joueurs à égalité en tête`.replace(/^./, (c) => c.toUpperCase())
      : `${leader.name} prend le pouvoir`;

  const chapeau = e.densite
    ? `Après ${journees}, le classement n'a pas encore livré son verdict. ` +
      `**${nombreEcrit(e.densite.joueurs).replace(/^./, (c) => c.toUpperCase())} joueurs** se tiennent en ` +
      `**${nombreEcrit(e.densite.points)} point${e.densite.points > 1 ? "s" : ""}**, ` +
      `les leaders changent d'une journée à l'autre et ` +
      `certains réalisent des remontées spectaculaires. Autrement dit : une seule ` +
      `bonne journée peut tout renverser.`
    : `Après ${journees}, **${leader.name}** mène la compétition avec **${pts(leader.points)}**. ` +
      `Le classement commence à prendre forme, mais rien n'est encore figé.`;

  const sections: SectionRecit[] = [];

  // ------------------------------------------------------------------
  // LE JOUEUR EN TETE
  // ------------------------------------------------------------------
  const tete: string[] = [];
  const depart = leader.etapes[0]?.rang ?? leader.rang;

  if (leader.progression > 0) {
    tete.push(
      `Le patron du moment s'appelle **${leader.name}**. Parti **${rangEcrit(depart)}** après la ` +
        `première journée, il a gagné **${places(leader.progression)}** pour s'installer en tête ` +
        `avec **${pts(leader.points)}**.`,
    );
  } else if (leader.progression < 0) {
    tete.push(
      `${leader.name} mène toujours avec ${pts(leader.points)}, mais il a reculé de ` +
        `${places(leader.progression)} depuis le début : la tête du classement se mérite ` +
        `chaque semaine.`,
    );
  } else {
    tete.push(
      `${leader.name} tient la corde depuis le début et compte aujourd'hui ${pts(leader.points)}. ` +
        `Une régularité qui commence à peser.`,
    );
  }

  if (leader.etapes.length > 1) {
    tete.push(`Son parcours, journée après journée : **${parcoursEcrit(leader.etapes)}**.`);
  }

  if (leader.derniereJournee > 0) {
    tete.push(
      `Sur la seule journée ${e.numeroDerniereJournee}, il a ajouté ` +
        `**${pts(leader.derniereJournee)}** à son total.`,
    );
  }

  if (leader.exactScores > 0) {
    tete.push(
      `Il compte également ${nombreEcrit(leader.exactScores)} score${leader.exactScores > 1 ? "s" : ""} ` +
        `exact${leader.exactScores > 1 ? "s" : ""} — c'est précisément là que se décident les fins ` +
        `de saison, quand deux joueurs arrivent au même total.`,
    );
  }

  if (e.exAequoTete > 1) {
    const autres = e.fiches.slice(1, e.exAequoTete).map((f) => f.name);
    tete.push(
      `Mais il n'est pas seul là-haut : **${listeFr(autres)}** compte${autres.length > 1 ? "nt" : ""} ` +
        `exactement le même nombre de points. Seuls les départages les séparent, et le moindre ` +
        `point marqué peut redistribuer l'ordre du podium.`,
    );
  } else if (e.fiches[1]) {
    const ecart = leader.points - e.fiches[1].points;
    tete.push(
      `**${e.fiches[1].name}** suit à **${pts(ecart)}**, ce qui ne représente qu'un bon résultat d'écart.`,
    );
  }

  if (e.meilleureJournee && e.meilleureJournee.derniereJournee > 0) {
    tete.push(
      `La meilleure copie de la journée ${e.numeroDerniereJournee} revient à ` +
        `**${e.meilleureJournee.name}**, avec **${pts(e.meilleureJournee.derniereJournee)}** marqués.`,
    );
  }

  sections.push({ kicker: "En tête", titre: "Le patron du moment", emoji: "👑", ton: "or", paragraphes: tete });

  // ------------------------------------------------------------------
  // LES POURSUIVANTS
  // ------------------------------------------------------------------
  // Ceux qui suivent immediatement. Sans eux, l'article parle du premier
  // puis saute aux remontees : la moitie du haut de tableau n'existe pas.
  // On s'arrete a quatre — au-dela, on recite le classement.
  const poursuivants = e.fiches
    .slice(1, 5)
    .filter((f) => f.etapes.length > 0);

  if (poursuivants.length > 0) {
    const p: string[] = [];

    poursuivants.forEach((joueur) => {
      const ecart = leader.points - joueur.points;
      const phrases: string[] = [];

      phrases.push(
        `**${joueur.name}** est **${rangEcrit(joueur.rang)}** avec **${pts(joueur.points)}**` +
          (ecart > 0 ? `, à **${pts(ecart)}** de la tête.` : `, à égalité avec la tête.`),
      );

      if (joueur.etapes.length > 1) {
        phrases.push(`Son parcours : **${parcoursEcrit(joueur.etapes)}**.`);
      }

      // La nuance qui manque toujours : reculer en ayant bien joue.
      if (joueur.progression < 0 && joueur.derniereJournee > 0) {
        phrases.push(
          `Il a pourtant ajouté **${pts(joueur.derniereJournee)}** sur la dernière journée — ` +
            `ceux qui le devancent ont simplement fait mieux.`,
        );
      } else if (joueur.derniereJournee > 0) {
        phrases.push(`Il a marqué **${pts(joueur.derniereJournee)}** sur la dernière journée.`);
      }

      p.push(phrases.join(" "));
    });

    sections.push({
      kicker: "Les poursuivants",
      titre: "Ils sont juste derrière",
      emoji: "💪",
      ton: "bleu",
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // LES REMONTEES
  // ------------------------------------------------------------------
  if (e.remontees.length > 0) {
    const p: string[] = [];
    const premier = e.remontees[0];
    const jour = e.numeroDerniereJournee;

    // LE MOUVEMENT DE LA JOURNEE, pas celui de la saison : c'est un Debrief
    // de journee. Le parcours complet reste cite juste apres, en contexte.
    p.push(
      `Le plus beau coup de cette **${jour}e journée** est signé **${premier.name}** : ` +
        `**${places(premier.mouvement)} gagnées** en une journée, ` +
        `${premier.rangVeille != null ? `de **${rangEcrit(premier.rangVeille)}** à ` : `désormais `}` +
        `**${rangEcrit(premier.rang)}**. Il a marqué **${pts(premier.derniereJournee)}** ce week-end. ` +
        `Son parcours depuis le début : **${parcoursEcrit(premier.etapes)}**.`,
    );

    if (premier.rang <= 3) {
      p.push(
        `Et il ne s'agit pas d'un simple coup d'éclat : il confirme journée après journée, ` +
          `au point de figurer désormais sur le podium.`,
      );
    }

    // Trois formulations, pour ne pas servir trois fois la meme phrase.
    const amorces = [
      (nom: string) => `${nom} n'est pas en reste`,
      (nom: string) => `Impossible également de passer à côté de ${nom}`,
      (nom: string) => `Dans le même registre, ${nom} avance`,
    ];

    e.remontees.slice(1).forEach((joueur, index) => {
      p.push(
        `${amorces[index % amorces.length](`**${joueur.name}**`)} : **${places(joueur.mouvement)} gagnées** ` +
          `sur la journée${joueur.rangVeille != null ? `, de **${rangEcrit(joueur.rangVeille)}** à **${rangEcrit(joueur.rang)}**` : ""} ` +
          `(**${pts(joueur.derniereJournee)}** marqués), pour **${pts(joueur.points)}** au total. ` +
          `${joueur.rang <= 10 ? "Le voilà installé dans le haut du tableau." : "La dynamique est lancée."}`,
      );
    });

    // LA SAISON, en une phrase et a part. Un joueur peut avoir la plus belle
    // trajectoire depuis la J1 sans avoir bouge ce week-end : les deux
    // histoires sont vraies, mais ce ne sont pas les memes.
    const t = e.trajectoire;
    if (t && t.progression > 0 && t.id !== premier.id) {
      p.push(
        `Sur l'ensemble de la saison, la plus belle trajectoire reste celle de **${t.name}** : ` +
          `${rangEcrit(t.etapes[0]?.rang ?? t.rang)} après la première journée, ` +
          `**${rangEcrit(t.rang)}** aujourd'hui, soit **${places(t.progression)} gagnées** ` +
          `(**${parcoursEcrit(t.etapes)}**).`,
      );
    }

    sections.push({ kicker: "Les remontées", titre: "Ils ont grimpé ce week-end", emoji: "🚀", ton: "vert", paragraphes: p });
  }

  // ------------------------------------------------------------------
  // LES CHUTES
  // ------------------------------------------------------------------
  if (e.chutes.length > 0) {
    const p: string[] = [];

    for (const joueur of e.chutes) {
      p.push(
        `**${joueur.name}** recule de **${places(-joueur.mouvement)}** sur cette journée` +
          `${joueur.rangVeille != null ? `, de **${rangEcrit(joueur.rangVeille)}** à **${rangEcrit(joueur.rang)}**` : ""} ` +
          `et totalise **${pts(joueur.points)}**. Son parcours : **${parcoursEcrit(joueur.etapes)}**.`,
      );
    }

    // La precision qui change tout pour celui qui se lit.
    p.push(
      `Attention toutefois : reculer ne veut pas dire avoir mal joué. Tous continuent de ` +
        `marquer — simplement, les joueurs qui les entourent ont marqué davantage. Avec des ` +
        `écarts aussi faibles, une seule bonne journée suffit à tout remettre en place.`,
    );

    sections.push({ kicker: "Les dégringolades", titre: "Ils ont reculé ce week-end", emoji: "📉", ton: "rouge", paragraphes: p });
  }

  // ------------------------------------------------------------------
  // LE BAS DU TABLEAU
  // ------------------------------------------------------------------
  // On ne les oublie pas, et surtout on ne les enterre pas : dans une ligue
  // aussi serree, le retard se rattrape en une journee. Le dire est le
  // minimum quand on publie un classement que vingt-trois personnes lisent.
  const derniers = e.fiches.slice(-3).filter((f) => f.rang > 3);

  if (derniers.length > 0 && e.fiches.length > 6) {
    const p: string[] = [];
    // Le retard se lit sur TOUT le groupe. Le calculer sur le mieux classe
    // des trois donnait un chiffre qui ne correspondait a aucun des noms
    // cites juste avant — le dernier etait bien plus loin que ca.
    const retardMin = leader.points - derniers[0].points;
    const retardMax = leader.points - derniers[derniers.length - 1].points;

    p.push(
      derniers
        .map((f) => `**${f.name}** (${rangEcrit(f.rang)}, **${pts(f.points)}**)`)
        .join(", ") + ` ferment la marche.`,
    );

    p.push(
      `${retardMax > retardMin
        ? `Le retard sur la tête va de **${pts(retardMin)}** à **${pts(retardMax)}**`
        : `Le retard sur la tête est de **${pts(retardMax)}**`}, ` +
        `ce qui paraît beaucoup — mais ` +
        `${derniers.some((f) => f.derniereJournee > 0)
          ? "ils continuent de marquer, et"
          : "avec des écarts qui se comblent vite,"} ` +
        `une grosse journée suffit à recoller au peloton. La saison est longue.`,
    );

    sections.push({
      kicker: "Le bas du tableau",
      titre: "Rien n'est perdu",
      emoji: "🔦",
      ton: "violet",
      paragraphes: p,
    });
  }

  // ------------------------------------------------------------------
  // LA CONCLUSION
  // ------------------------------------------------------------------
  const fin: string[] = [];
  if (e.densite) {
    fin.push(
      `**${nombreEcrit(e.densite.joueurs).replace(/^./, (c) => c.toUpperCase())} joueurs** en ` +
        `**${nombreEcrit(e.densite.points)} point${e.densite.points > 1 ? "s" : ""}** : ` +
        `c'est dire si tout reste ouvert. Le moindre score exact, ` +
        `une bonne journée, et l'ordre du classement change du tout au tout.`,
    );
  } else {
    fin.push(
      `Les écarts peuvent encore se combler vite : un score exact sur le match bonus vaut trois ` +
        `points, de quoi bousculer une hiérarchie en une soirée.`,
    );
  }
  // Les questions de fin nomment de VRAIS joueurs : c'est ce qui donne envie
  // d'aller voir la journee suivante.
  const questions: string[] = [];
  if (e.exAequoTete > 1) {
    questions.push(`Qui prendra seul la tête ?`);
  } else {
    questions.push(`**${leader.name}** tiendra-t-il son rang ?`);
  }
  if (e.remontees[0]) {
    questions.push(`**${e.remontees[0].name}** poursuivra-t-il sa remontée ?`);
  }
  if (e.chutes[0]) {
    questions.push(`**${e.chutes[0].name}** relancera-t-il sa saison ?`);
  }
  if (questions.length > 0) fin.push(questions.join(" "));

  fin.push(
    `Rendez-vous à la **journée ${e.numeroDerniereJournee + 1}** pour la suite — et que le meilleur gagne.`,
  );

  sections.push({ kicker: "Et maintenant", titre: "Tout est encore ouvert", emoji: "⏳", ton: "cyan", paragraphes: fin });

  return {
    surtitre: `Le grand bilan après ${journees}`,
    titre,
    emoji: e.exAequoTete > 1 ? "🤯" : "🏆",
    chapeau,
    sections,
  };
}
