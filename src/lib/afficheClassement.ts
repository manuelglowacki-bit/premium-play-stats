/**
 * AFFICHE DU CLASSEMENT
 * =====================
 * Dessine l'image que l'organisateur partage dans le Vestiaire après chaque
 * journée. Elle était jusqu'ici fabriquée à la main dans un outil externe, à
 * chaque journée — or le site possède déjà toutes les données.
 *
 * Rendu au format 1080 × 1620 (2:3) : c'est la proportion des messageries et
 * des stories, celle qui s'affiche sans être recadrée.
 *
 * Tout est dessiné sur un canvas, sans police externe : une police qui met
 * une seconde à charger produit une image au mauvais rendu, et l'image est
 * générée une fois pour toutes. On s'en tient donc aux familles présentes
 * partout, avec des replis explicites.
 */

export type LigneAffiche = {
  rang: number;
  pseudo: string;
  points: number;
  ecart: number;
};

export type DonneesAffiche = {
  saison: string;
  journee: number | null;
  lignes: LigneAffiche[];
};

const LARGEUR = 1080;
const HAUTEUR = 1620;

const OR = "#E7B542";
const ARGENT = "#D7DEE8";
const BRONZE = "#C8813F";
const VERT = "#34D399";
const ROUGE = "#F87171";

const POLICE_TITRE = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const POLICE_TEXTE = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

function fond(ctx: CanvasRenderingContext2D) {
  // Nuit de stade : dégradé du bleu profond vers le noir, plus un halo doré
  // derrière le podium. Aucune image externe — l'affiche doit se générer
  // hors ligne comme en ligne.
  const ciel = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  ciel.addColorStop(0, "#0A1A2B");
  ciel.addColorStop(0.45, "#071320");
  ciel.addColorStop(1, "#040C14");
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  const halo = ctx.createRadialGradient(LARGEUR / 2, 430, 40, LARGEUR / 2, 430, 620);
  halo.addColorStop(0, "rgba(231,181,66,.20)");
  halo.addColorStop(1, "rgba(231,181,66,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LARGEUR, 1000);
}

function texte(
  ctx: CanvasRenderingContext2D,
  contenu: string,
  x: number,
  y: number,
  options: { taille: number; couleur: string; police?: string; align?: CanvasTextAlign; espacement?: number },
) {
  ctx.font = `${options.taille}px ${options.police ?? POLICE_TEXTE}`;
  ctx.fillStyle = options.couleur;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";

  if (!options.espacement) {
    ctx.fillText(contenu, x, y);
    return;
  }

  // Le suivi de caractères n'existe pas sur canvas : on place les lettres une
  // à une. Réservé aux libellés courts en majuscules, où il fait tout l'effet.
  const lettres = [...contenu];
  const largeur =
    lettres.reduce((total, lettre) => total + ctx.measureText(lettre).width, 0) +
    options.espacement * (lettres.length - 1);
  let curseur = options.align === "center" ? x - largeur / 2 : options.align === "right" ? x - largeur : x;
  ctx.textAlign = "left";
  lettres.forEach((lettre) => {
    ctx.fillText(lettre, curseur, y);
    curseur += ctx.measureText(lettre).width + options.espacement!;
  });
}

/** Un nom trop long est réduit plutôt que tronqué : personne ne veut lire son pseudo coupé. */
function nomAjuste(ctx: CanvasRenderingContext2D, nom: string, tailleBase: number, largeurMax: number): number {
  let taille = tailleBase;
  for (;;) {
    ctx.font = `700 ${taille}px ${POLICE_TEXTE}`;
    if (ctx.measureText(nom).width <= largeurMax || taille <= tailleBase * 0.6) return taille;
    taille -= 1;
  }
}

function marche(
  ctx: CanvasRenderingContext2D,
  x: number,
  largeur: number,
  hauteur: number,
  couleur: string,
  rang: number,
  ligne: LigneAffiche,
) {
  const bas = 780;
  const haut = bas - hauteur;

  const socle = ctx.createLinearGradient(0, haut, 0, bas);
  socle.addColorStop(0, `${couleur}CC`);
  socle.addColorStop(1, `${couleur}22`);
  ctx.fillStyle = socle;
  ctx.fillRect(x, haut, largeur, hauteur);

  ctx.strokeStyle = `${couleur}88`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, haut, largeur, hauteur);

  const centre = x + largeur / 2;

  texte(ctx, String(rang), centre, haut + hauteur / 2 + 26, {
    taille: 76,
    couleur,
    police: POLICE_TITRE,
    align: "center",
  });

  const taille = nomAjuste(ctx, ligne.pseudo, 34, largeur - 20);
  ctx.font = `700 ${taille}px ${POLICE_TEXTE}`;
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(ligne.pseudo, centre, haut - 58);

  texte(ctx, String(ligne.points), centre, haut - 12, {
    taille: 52,
    couleur,
    police: POLICE_TITRE,
    align: "center",
  });
}

/**
 * Dessine l'affiche et renvoie le canvas. L'appelant décide ensuite quoi en
 * faire — le télécharger, ou l'envoyer directement dans le Vestiaire.
 */
export function dessinerAffiche(donnees: DonneesAffiche): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur n'a pas pu créer l'image.");

  fond(ctx);

  // ---------- Titre ----------
  texte(ctx, "PRONO LIGUE 1 LM", LARGEUR / 2, 96, {
    taille: 26,
    couleur: OR,
    align: "center",
    espacement: 8,
  });

  texte(ctx, "CLASSEMENT", LARGEUR / 2, 190, {
    taille: 96,
    couleur: "#FFFFFF",
    police: POLICE_TITRE,
    align: "center",
    espacement: 4,
  });

  const sousTitre = donnees.journee ? `SAISON ${donnees.saison}  ·  JOURNÉE ${donnees.journee}` : `SAISON ${donnees.saison}`;
  texte(ctx, sousTitre, LARGEUR / 2, 238, {
    taille: 26,
    couleur: "#9FB3C8",
    align: "center",
    espacement: 4,
  });

  // ---------- Podium ----------
  const podium = donnees.lignes.slice(0, 3);
  if (podium.length >= 3) {
    // 2 – 1 – 3, la disposition d'un vrai podium : le premier au centre et
    // plus haut, sans avoir besoin de lire les chiffres.
    marche(ctx, 150, 230, 210, ARGENT, 2, podium[1]);
    marche(ctx, 425, 230, 300, OR, 1, podium[0]);
    marche(ctx, 700, 230, 160, BRONZE, 3, podium[2]);
  }

  // ---------- Tableau ----------
  const reste = donnees.lignes.slice(3);
  const debut = 880;

  // La hauteur de ligne DECOULE du nombre de joueurs, elle n'est pas choisie
  // puis rognee : avec une valeur fixe, les derniers du classement sortaient
  // de l'image — precisement ceux qu'on cherche a chambrer. On garde de quoi
  // rester lisible (24px minimum) et on n'agrandit pas au-dela de 46px sur
  // une petite ligue.
  const espaceDisponible = HAUTEUR - debut - 110;
  const hauteurLigne = Math.max(
    24,
    Math.min(46, Math.floor(espaceDisponible / Math.max(reste.length, 1))),
  );

  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.fillRect(90, debut - 46, LARGEUR - 180, 40);
  texte(ctx, "RANG", 130, debut - 18, { taille: 20, couleur: "#7D93A8", espacement: 3 });
  texte(ctx, "JOUEUR", 250, debut - 18, { taille: 20, couleur: "#7D93A8", espacement: 3 });
  texte(ctx, "PTS", 830, debut - 18, { taille: 20, couleur: "#7D93A8", align: "right", espacement: 3 });
  texte(ctx, "ÉCART", 980, debut - 18, { taille: 20, couleur: "#7D93A8", align: "right", espacement: 3 });

  const total = donnees.lignes.length;

  reste.forEach((ligne, index) => {
    const y = debut + index * hauteurLigne;
    // Filet de securite : avec la hauteur de ligne calculee ci-dessus, aucune
    // ligne ne devrait plus sortir. S'il sert, c'est que le calcul est faux —
    // mieux vaut une affiche incomplete qu'un texte imprime sur le pied de
    // page.
    if (y > HAUTEUR - 90) return;

    // Zone rouge : les trois derniers, teinte de plus en plus marquée.
    const rangDepuisLaFin = total - ligne.rang;
    const danger = total > 6 && rangDepuisLaFin < 3 ? 3 - rangDepuisLaFin : 0;

    if (index % 2 === 0 || danger) {
      ctx.fillStyle = danger
        ? `rgba(248,113,113,${0.05 + danger * 0.05})`
        : "rgba(255,255,255,.028)";
      ctx.fillRect(90, y - hauteurLigne + 14, LARGEUR - 180, hauteurLigne - 6);
    }

    const tailleTexte = Math.min(30, hauteurLigne - 16);
    const couleurRang = danger ? ROUGE : OR;

    ctx.font = `700 ${tailleTexte}px ${POLICE_TEXTE}`;
    ctx.textAlign = "left";
    ctx.fillStyle = couleurRang;
    ctx.fillText(String(ligne.rang).padStart(2, "0"), 130, y);

    const taillePseudo = nomAjuste(ctx, ligne.pseudo, tailleTexte, 520);
    ctx.font = `600 ${taillePseudo}px ${POLICE_TEXTE}`;
    ctx.fillStyle = danger ? "#FECACA" : "#E7EFEA";
    ctx.fillText(ligne.pseudo, 250, y);

    ctx.font = `700 ${tailleTexte}px ${POLICE_TEXTE}`;
    ctx.textAlign = "right";
    ctx.fillStyle = danger ? ROUGE : VERT;
    ctx.fillText(String(ligne.points), 830, y);

    ctx.fillStyle = danger ? "#FCA5A5" : "#94A9BD";
    ctx.font = `600 ${tailleTexte}px ${POLICE_TEXTE}`;
    ctx.fillText(ligne.ecart === 0 ? "—" : `-${ligne.ecart}`, 980, y);
  });

  // ---------- Pied ----------
  texte(ctx, "LA COMPÉTITION DES VRAIS PASSIONNÉS", LARGEUR / 2, HAUTEUR - 54, {
    taille: 22,
    couleur: "#6B8299",
    align: "center",
    espacement: 6,
  });

  return canvas;
}

/** Le canvas en fichier PNG, prêt à être partagé. */
export function afficheEnFichier(canvas: HTMLCanvasElement, nom: string): Promise<File> {
  return new Promise((resoudre, rejeter) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        rejeter(new Error("L'image n'a pas pu être produite."));
        return;
      }
      resoudre(new File([blob], nom, { type: "image/png" }));
    }, "image/png");
  });
}
