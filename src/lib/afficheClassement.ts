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
 * POLICES — la première version s'en tenait aux polices système, par crainte
 * qu'une police lente à charger donne une image au mauvais rendu. Le résultat
 * était fade : Arial Narrow ne fait pas une affiche de sport. Les deux fontes
 * sont donc désormais SERVIES PAR LE SITE (public/fonts, 51 Ko au total) et
 * l'image n'est dessinée qu'une fois leur chargement terminé — pas de CDN, pas
 * d'attente réseau, et l'affiche se génère hors ligne comme en ligne. Si le
 * navigateur ne sait pas les charger, on retombe sur les polices système : une
 * affiche moins belle vaut mieux qu'un bouton qui ne répond pas.
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

const OR = "#F2C14E";
const OR_SOMBRE = "#B8862B";
const ARGENT = "#CBD5E1";
const BRONZE = "#CD7F32";
const VERT = "#4ADE80";
const ROUGE = "#F87171";
const TEXTE = "#E8EEF7";
const TEXTE_DOUX = "#8FA3BC";

// Noms internes : on n'écrase surtout pas les familles du site, qui sont
// déclarées dans styles.css et servent à toutes les pages.
const TITRE = "AfficheTitre";
const CORPS = "AfficheCorps";

const POLICE_TITRE = `"${TITRE}", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
const POLICE_TEXTE = `"${CORPS}", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;

let policesDemandees: Promise<void> | null = null;

/**
 * Charge les deux fontes de l'affiche. Appelé avant chaque dessin, mais le
 * travail n'est fait qu'une fois : la promesse est mémorisée.
 */
function chargerPolices(): Promise<void> {
  if (policesDemandees) return policesDemandees;

  policesDemandees = (async () => {
    if (typeof FontFace === "undefined" || !document.fonts) return;
    try {
      const fontes = [
        new FontFace(TITRE, "url(/fonts/anton-latin.woff2) format('woff2')", { weight: "400" }),
        new FontFace(CORPS, "url(/fonts/outfit-latin.woff2) format('woff2')", { weight: "400 800" }),
      ];
      const chargees = await Promise.all(fontes.map((f) => f.load()));
      chargees.forEach((f) => document.fonts.add(f));
    } catch {
      // Polices système : voir l'en-tête du fichier.
    }
  })();

  return policesDemandees;
}

// ---------------------------------------------------------------------------
// Briques de dessin
// ---------------------------------------------------------------------------

function rectArrondi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  rayon: number,
) {
  const r = Math.min(rayon, largeur / 2, hauteur / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + largeur - r, y);
  ctx.quadraticCurveTo(x + largeur, y, x + largeur, y + r);
  ctx.lineTo(x + largeur, y + hauteur - r);
  ctx.quadraticCurveTo(x + largeur, y + hauteur, x + largeur - r, y + hauteur);
  ctx.lineTo(x + r, y + hauteur);
  ctx.quadraticCurveTo(x, y + hauteur, x, y + hauteur - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Le grain. C'est lui qui fait la différence entre un aplat de dégradé — plat,
 * numérique — et une image imprimée. On fabrique une petite tuile de bruit
 * qu'on répète : générer 1,7 million de pixels un par un serait cent fois plus
 * lent pour le même rendu.
 */
function grain(ctx: CanvasRenderingContext2D) {
  const tuile = document.createElement("canvas");
  tuile.width = 160;
  tuile.height = 160;
  const c = tuile.getContext("2d");
  if (!c) return;

  const image = c.createImageData(160, 160);
  for (let i = 0; i < image.data.length; i += 4) {
    const valeur = 120 + Math.random() * 135;
    image.data[i] = valeur;
    image.data[i + 1] = valeur;
    image.data[i + 2] = valeur;
    image.data[i + 3] = 255;
  }
  c.putImageData(image, 0, 0);

  const motif = ctx.createPattern(tuile, "repeat");
  if (!motif) return;

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = motif;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.restore();
}

/** Faisceaux de projecteurs, comme au-dessus d'une pelouse la nuit. */
function projecteurs(ctx: CanvasRenderingContext2D) {
  const faisceaux: Array<{ x: number; angle: number; largeur: number; teinte: string }> = [
    { x: 150, angle: 0.34, largeur: 210, teinte: "rgba(150,190,255," },
    { x: 540, angle: -0.05, largeur: 320, teinte: "rgba(242,193,78," },
    { x: 930, angle: -0.34, largeur: 210, teinte: "rgba(150,190,255," },
  ];

  faisceaux.forEach(({ x, angle, largeur, teinte }) => {
    ctx.save();
    ctx.translate(x, -60);
    ctx.rotate(angle);

    const degrade = ctx.createLinearGradient(0, 0, 0, 1150);
    degrade.addColorStop(0, `${teinte}.13)`);
    degrade.addColorStop(0.55, `${teinte}.045)`);
    degrade.addColorStop(1, `${teinte}0)`);
    ctx.fillStyle = degrade;

    // Un faisceau s'élargit en descendant : trapèze, pas rectangle.
    ctx.beginPath();
    ctx.moveTo(-largeur * 0.16, 0);
    ctx.lineTo(largeur * 0.16, 0);
    ctx.lineTo(largeur, 1150);
    ctx.lineTo(-largeur, 1150);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function fond(ctx: CanvasRenderingContext2D) {
  // Nuit de stade. Aucune image externe : l'affiche doit se générer hors ligne.
  const ciel = ctx.createLinearGradient(0, 0, LARGEUR * 0.35, HAUTEUR);
  ciel.addColorStop(0, "#0E1D33");
  ciel.addColorStop(0.35, "#091425");
  ciel.addColorStop(0.72, "#060C17");
  ciel.addColorStop(1, "#03060C");
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  projecteurs(ctx);

  // Halo doré derrière le podium : le regard doit tomber là en premier.
  const halo = ctx.createRadialGradient(LARGEUR / 2, 640, 30, LARGEUR / 2, 640, 560);
  halo.addColorStop(0, "rgba(242,193,78,.22)");
  halo.addColorStop(0.5, "rgba(242,193,78,.07)");
  halo.addColorStop(1, "rgba(242,193,78,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 120, LARGEUR, 1120);

  // Lignes de touche, très effacées : la texture d'une pelouse vue de loin.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#7FD4A8";
  ctx.lineWidth = 1;
  for (let y = 900; y < HAUTEUR; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LARGEUR, y);
    ctx.stroke();
  }
  ctx.restore();

  grain(ctx);

  // Vignette : on referme les bords pour concentrer l'image.
  const vignette = ctx.createRadialGradient(LARGEUR / 2, HAUTEUR / 2, 380, LARGEUR / 2, HAUTEUR / 2, 1080);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Filet doré en retrait des bords : ce qui distingue une affiche d'une
  // capture d'écran.
  ctx.strokeStyle = "rgba(242,193,78,.28)";
  ctx.lineWidth = 2;
  rectArrondi(ctx, 34, 34, LARGEUR - 68, HAUTEUR - 68, 26);
  ctx.stroke();
}

function texte(
  ctx: CanvasRenderingContext2D,
  contenu: string,
  x: number,
  y: number,
  options: {
    taille: number;
    couleur: string | CanvasGradient;
    police?: string;
    graisse?: string;
    align?: CanvasTextAlign;
    espacement?: number;
  },
) {
  ctx.font = `${options.graisse ? `${options.graisse} ` : ""}${options.taille}px ${options.police ?? POLICE_TEXTE}`;
  ctx.fillStyle = options.couleur;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";

  if (!options.espacement) {
    ctx.fillText(contenu, x, y);
    return;
  }

  // Le suivi de caractères n'existe pas partout sur canvas : on place les
  // lettres une à une. Réservé aux libellés courts en majuscules, où il fait
  // tout l'effet.
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
function nomAjuste(
  ctx: CanvasRenderingContext2D,
  nom: string,
  tailleBase: number,
  largeurMax: number,
  graisse = "700",
): number {
  let taille = tailleBase;
  for (;;) {
    ctx.font = `${graisse} ${taille}px ${POLICE_TEXTE}`;
    if (ctx.measureText(nom).width <= largeurMax || taille <= tailleBase * 0.55) return taille;
    taille -= 1;
  }
}

// ---------------------------------------------------------------------------
// Podium
// ---------------------------------------------------------------------------

const PODIUM_BAS = 790;

function marche(
  ctx: CanvasRenderingContext2D,
  x: number,
  largeur: number,
  hauteur: number,
  couleur: string,
  rang: number,
  ligne: LigneAffiche,
) {
  const haut = PODIUM_BAS - hauteur;
  const centre = x + largeur / 2;

  // Socle en verre teinté, coins arrondis en haut seulement — il « pose » sur
  // le bas de l'affiche.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  const socle = ctx.createLinearGradient(0, haut, 0, PODIUM_BAS);
  socle.addColorStop(0, `${couleur}3A`);
  socle.addColorStop(0.55, "rgba(255,255,255,.055)");
  socle.addColorStop(1, "rgba(255,255,255,.02)");
  ctx.fillStyle = socle;
  rectArrondi(ctx, x, haut, largeur, hauteur, 22);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `${couleur}55`;
  ctx.lineWidth = 1.5;
  rectArrondi(ctx, x, haut, largeur, hauteur, 22);
  ctx.stroke();

  // Arête lumineuse sur le dessus : la marche prend du relief.
  const arete = ctx.createLinearGradient(x, 0, x + largeur, 0);
  arete.addColorStop(0, `${couleur}00`);
  arete.addColorStop(0.5, couleur);
  arete.addColorStop(1, `${couleur}00`);
  ctx.fillStyle = arete;
  ctx.fillRect(x + 12, haut, largeur - 24, 3);

  // Médaille à cheval sur l'arête.
  const rayon = rang === 1 ? 50 : 42;
  ctx.save();
  ctx.shadowColor = `${couleur}88`;
  ctx.shadowBlur = 30;
  const disque = ctx.createLinearGradient(centre - rayon, haut - rayon, centre + rayon, haut + rayon);
  disque.addColorStop(0, couleur);
  disque.addColorStop(1, rang === 1 ? OR_SOMBRE : `${couleur}99`);
  ctx.fillStyle = disque;
  ctx.beginPath();
  ctx.arc(centre, haut, rayon, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centre, haut, rayon - 6, 0, Math.PI * 2);
  ctx.stroke();

  texte(ctx, String(rang), centre, haut + rayon * 0.4, {
    taille: rang === 1 ? 62 : 52,
    couleur: "#0A1220",
    police: POLICE_TITRE,
    align: "center",
  });

  // Nom et points alignés d'une marche à l'autre : la hauteur des socles suffit
  // à dire qui est devant, le texte n'a pas à faire l'escalier avec eux.
  const taille = nomAjuste(ctx, ligne.pseudo, rang === 1 ? 40 : 34, largeur - 26);
  ctx.font = `700 ${taille}px ${POLICE_TEXTE}`;
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(ligne.pseudo, centre, 686);

  texte(ctx, String(ligne.points), centre, 758, {
    taille: rang === 1 ? 64 : 54,
    couleur,
    police: POLICE_TITRE,
    align: "center",
  });

  texte(ctx, "PTS", centre, PODIUM_BAS - 14, {
    taille: 16,
    couleur: TEXTE_DOUX,
    graisse: "600",
    align: "center",
    espacement: 3,
  });
}

// ---------------------------------------------------------------------------
// Affiche
// ---------------------------------------------------------------------------

/**
 * Dessine l'affiche et renvoie le canvas. L'appelant décide ensuite quoi en
 * faire — le télécharger, ou l'envoyer directement dans le Vestiaire.
 */
export async function dessinerAffiche(donnees: DonneesAffiche): Promise<HTMLCanvasElement> {
  await chargerPolices();

  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur n'a pas pu créer l'image.");

  fond(ctx);

  // ---------- Titre ----------
  texte(ctx, "PRONO LIGUE 1 LM", LARGEUR / 2, 122, {
    taille: 24,
    couleur: OR,
    graisse: "700",
    align: "center",
    espacement: 10,
  });

  // Petit trait doré sous la signature.
  ctx.fillStyle = "rgba(242,193,78,.45)";
  ctx.fillRect(LARGEUR / 2 - 60, 142, 120, 2);

  const encreTitre = ctx.createLinearGradient(0, 190, 0, 268);
  encreTitre.addColorStop(0, "#FFFFFF");
  encreTitre.addColorStop(1, "#B9C9DE");
  ctx.save();
  ctx.shadowColor = "rgba(242,193,78,.30)";
  ctx.shadowBlur = 40;
  texte(ctx, "CLASSEMENT", LARGEUR / 2, 266, {
    taille: 116,
    couleur: encreTitre,
    police: POLICE_TITRE,
    align: "center",
    espacement: 3,
  });
  ctx.restore();

  // Sous-titre dans une pastille : plus net qu'une ligne de texte perdue.
  const sousTitre = donnees.journee
    ? `SAISON ${donnees.saison}   ·   JOURNÉE ${donnees.journee}`
    : `SAISON ${donnees.saison}`;
  ctx.font = `600 24px ${POLICE_TEXTE}`;
  const largeurPastille = ctx.measureText(sousTitre).width + 4 * sousTitre.length + 64;
  ctx.fillStyle = "rgba(255,255,255,.06)";
  rectArrondi(ctx, LARGEUR / 2 - largeurPastille / 2, 296, largeurPastille, 54, 27);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,193,78,.28)";
  ctx.lineWidth = 1.5;
  rectArrondi(ctx, LARGEUR / 2 - largeurPastille / 2, 296, largeurPastille, 54, 27);
  ctx.stroke();
  texte(ctx, sousTitre, LARGEUR / 2, 331, {
    taille: 24,
    couleur: "#CBD9E8",
    graisse: "600",
    align: "center",
    espacement: 4,
  });

  // ---------- Podium ----------
  const podium = donnees.lignes.slice(0, 3);
  if (podium.length >= 3) {
    // 2 – 1 – 3, la disposition d'un vrai podium : le premier au centre et
    // plus haut, sans avoir besoin de lire les chiffres.
    marche(ctx, 110, 252, 248, ARGENT, 2, podium[1]);
    marche(ctx, 396, 288, 330, OR, 1, podium[0]);
    marche(ctx, 718, 252, 200, BRONZE, 3, podium[2]);
  }

  // ---------- Tableau ----------
  const reste = donnees.lignes.slice(3);
  const debut = 902;

  // La hauteur de ligne DECOULE du nombre de joueurs, elle n'est pas choisie
  // puis rognee : avec une valeur fixe, les derniers du classement sortaient
  // de l'image — precisement ceux qu'on cherche a chambrer. On garde de quoi
  // rester lisible (24px minimum) et on n'agrandit pas au-dela de 46px sur
  // une petite ligue.
  const espaceDisponible = HAUTEUR - debut - 96;
  const hauteurLigne = Math.max(24, Math.min(56, Math.floor(espaceDisponible / Math.max(reste.length, 1))));

  // A 23 joueurs le tableau remplit la page. Sur une ligue plus courte il ne
  // la remplit pas, et l'affiche se terminait par un grand vide : on recentre
  // alors le bloc dans l'espace restant plutot que de le coller en haut.
  const creux = Math.max(0, espaceDisponible - reste.length * hauteurLigne);
  const debutTableau = debut + Math.floor(creux / 2);

  const X_RANG = 132;
  const X_NOM = 208;
  const X_PTS = 858;
  const X_ECART = 972;

  texte(ctx, "RANG", X_RANG - 6, debutTableau - 46, { taille: 18, couleur: TEXTE_DOUX, graisse: "700", espacement: 3 });
  texte(ctx, "JOUEUR", X_NOM, debutTableau - 46, { taille: 18, couleur: TEXTE_DOUX, graisse: "700", espacement: 3 });
  texte(ctx, "PTS", X_PTS, debutTableau - 46, {
    taille: 18,
    couleur: TEXTE_DOUX,
    graisse: "700",
    align: "right",
    espacement: 3,
  });
  texte(ctx, "ÉCART", X_ECART, debutTableau - 46, {
    taille: 18,
    couleur: TEXTE_DOUX,
    graisse: "700",
    align: "right",
    espacement: 3,
  });

  ctx.fillStyle = "rgba(242,193,78,.22)";
  ctx.fillRect(96, debutTableau - 30, LARGEUR - 192, 1);

  const total = donnees.lignes.length;

  reste.forEach((ligne, index) => {
    const y = debutTableau + index * hauteurLigne;
    // Filet de securite : avec la hauteur de ligne calculee ci-dessus, aucune
    // ligne ne devrait plus sortir. S'il sert, c'est que le calcul est faux —
    // mieux vaut une affiche incomplete qu'un texte imprime sur le pied de
    // page.
    if (y > HAUTEUR - 84) return;

    // Zone rouge : les trois derniers, teinte de plus en plus marquée.
    const rangDepuisLaFin = total - ligne.rang;
    const danger = total > 6 && rangDepuisLaFin < 3 ? 3 - rangDepuisLaFin : 0;

    const hautLigne = y - hauteurLigne + 8;
    const hauteurCarte = hauteurLigne - 4;

    if (danger || index % 2 === 0) {
      ctx.fillStyle = danger ? `rgba(248,113,113,${0.06 + danger * 0.05})` : "rgba(255,255,255,.05)";
      rectArrondi(ctx, 96, hautLigne, LARGEUR - 192, hauteurCarte, 10);
      ctx.fill();
    }

    // Trait d'accent à gauche : il donne un rythme à la liste et signale d'un
    // coup d'œil le bas de tableau.
    ctx.fillStyle = danger ? ROUGE : "rgba(242,193,78,.55)";
    rectArrondi(ctx, 96, hautLigne, 4, hauteurCarte, 2);
    ctx.fill();

    const tailleTexte = Math.min(28, hauteurLigne - 7);

    texte(ctx, String(ligne.rang).padStart(2, "0"), X_RANG, y, {
      taille: tailleTexte + 4,
      couleur: danger ? ROUGE : OR,
      police: POLICE_TITRE,
    });

    const taillePseudo = nomAjuste(ctx, ligne.pseudo, tailleTexte, 600, "600");
    ctx.font = `600 ${taillePseudo}px ${POLICE_TEXTE}`;
    ctx.textAlign = "left";
    ctx.fillStyle = danger ? "#FECACA" : TEXTE;
    ctx.fillText(ligne.pseudo, X_NOM, y);

    texte(ctx, String(ligne.points), X_PTS, y, {
      taille: tailleTexte + 4,
      couleur: danger ? ROUGE : VERT,
      police: POLICE_TITRE,
      align: "right",
    });

    ctx.font = `600 ${Math.max(16, tailleTexte - 4)}px ${POLICE_TEXTE}`;
    ctx.textAlign = "right";
    ctx.fillStyle = danger ? "#FCA5A5" : TEXTE_DOUX;
    ctx.fillText(ligne.ecart === 0 ? "—" : `-${ligne.ecart}`, X_ECART, y);
  });

  // ---------- Pied ----------
  ctx.fillStyle = "rgba(242,193,78,.30)";
  ctx.fillRect(LARGEUR / 2 - 130, HAUTEUR - 78, 260, 1);

  texte(ctx, "LA COMPÉTITION DES VRAIS PASSIONNÉS", LARGEUR / 2, HAUTEUR - 48, {
    taille: 20,
    couleur: TEXTE_DOUX,
    graisse: "600",
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
