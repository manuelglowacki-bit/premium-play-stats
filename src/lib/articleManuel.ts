/**
 * L'ARTICLE ECRIT A LA MAIN, TRANSFORME EN BLOCS AFFICHABLES.
 *
 * L'organisateur redige son Debrief ailleurs (ChatGPT, un carnet, un mail)
 * et le colle dans Admin. Ce fichier ne fait qu'UNE chose : reconnaitre la
 * forme de ce qu'il a colle, pour que la page puisse lui donner l'allure du
 * reste du site au lieu d'afficher un pave de texte brut.
 *
 * Ce n'est pas un moteur Markdown complet, et ca n'a pas a l'etre. Il
 * reconnait exactement ce qu'on retrouve dans ces articles-la :
 *
 *   ---            une barre de separation
 *   # Titre        un titre (le nombre de # n'a pas d'importance ici)
 *   EN MAJUSCULES  un titre lui aussi — c'est ainsi que ChatGPT les ecrit
 *   > citation     une mise en exergue
 *   - element      une liste (aussi : *, •, 1., 1️⃣, ou une medaille)
 *   | a | b |      une ligne de tableau
 *   le reste       un paragraphe
 *
 * Le gras `**...**` n'est PAS traite ici : la page le rend deja, partout,
 * avec `morceaux()` (src/lib/recitDebrief.ts). Une deuxieme facon de mettre
 * en gras finirait par diverger de la premiere.
 *
 * Rien n'est calcule, rien n'est corrige : le texte de l'organisateur
 * ressort tel qu'il l'a ecrit.
 */

export type BlocArticle =
  | { type: "titre"; texte: string; emoji: string }
  | { type: "paragraphe"; texte: string }
  | { type: "citation"; texte: string }
  | { type: "liste"; elements: string[] }
  | { type: "tableau"; lignes: string[][] }
  | { type: "separateur" };

/** Les emojis qui ouvrent une ligne servent d'icone au titre, pas de texte. */
const EMOJI_EN_TETE =
  /^(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]+\s*)+/u;

/** « - », « * », « • », « 1. », « 1) », « 1️⃣ », « 🥇 »… */
const PUCE = /^\s*(?:[-*•·]|\d{1,2}[.)]|[\u{1F947}-\u{1F949}]|\d\u{FE0F}?\u{20E3})\s+/u;

function sansEmojiInitial(ligne: string): { emoji: string; reste: string } {
  const trouve = ligne.match(EMOJI_EN_TETE);
  if (!trouve) return { emoji: "", reste: ligne.trim() };
  return { emoji: trouve[0].trim(), reste: ligne.slice(trouve[0].length).trim() };
}

/**
 * UN TITRE, SANS BALISE.
 *
 * ChatGPT ecrit ses intertitres en capitales plutot qu'avec des `#`. On les
 * reconnait donc a leur forme : une ligne courte, sans ponctuation de fin de
 * phrase, dont les lettres sont majoritairement des capitales.
 *
 * La verification porte sur les LETTRES seulement : « 🏆 PRONO LIGUE 1 LM »
 * contient des chiffres et un emoji, et reste un titre. Et une ligne sans
 * aucune lettre (« 2026-2027 ») n'en est pas un.
 */
function ressembleAUnTitre(ligne: string): boolean {
  const texte = ligne.trim();
  if (!texte || texte.length > 90) return false;

  const lettres = texte.replace(/[^\p{L}]/gu, "");
  if (lettres.length < 3) return false;

  const capitales = texte.replace(/[^\p{Lu}]/gu, "").length;
  if (capitales / lettres.length < 0.8) return false;

  // Une phrase qui se termine par un point n'est pas un titre, meme criee.
  return !/[.!?]$/.test(texte.replace(/[!]+$/, ""));
}

function nettoyerTitre(texte: string): string {
  return texte.replace(/^#+\s*/, "").replace(/\s*#+$/, "").trim();
}

function cellulesDeLigne(ligne: string): string[] {
  // Deux ecritures possibles pour un tableau : les barres verticales du
  // Markdown, et les tabulations d'un copier-coller depuis un tableur ou une
  // reponse mise en forme. Les deux arrivent dans le presse-papier.
  const separateur = ligne.includes("|") ? "|" : "\t";
  return ligne
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(separateur)
    .map((c) => c.trim())
    .filter((c, i, tout) => c !== "" || (i > 0 && i < tout.length - 1));
}

/** Une ligne de tableau : des barres verticales, ou des tabulations. */
function estLigneDeTableau(ligne: string): boolean {
  if (ligne.includes("|")) return cellulesDeLigne(ligne).length > 1;
  return ligne.includes("\t") && cellulesDeLigne(ligne).length > 1;
}

/** Une ligne de separation de tableau Markdown : « |---|---| ». */
function estSeparateurDeTableau(ligne: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(ligne) && ligne.includes("-") && ligne.includes("|");
}

/**
 * @param texte L'article colle par l'organisateur.
 * @returns Les blocs a afficher, dans l'ordre. Un texte vide donne [].
 */
export function lireArticle(texte: string | null | undefined): BlocArticle[] {
  if (!texte || !texte.trim()) return [];

  const lignes = texte.replace(/\r\n?/g, "\n").split("\n");
  const blocs: BlocArticle[] = [];

  let paragraphe: string[] = [];
  let liste: string[] = [];
  let tableau: string[][] = [];

  const viderParagraphe = () => {
    if (paragraphe.length === 0) return;
    // Les retours a la ligne sont CONSERVES. Celui qui ecrit son article
    // aligne souvent un parcours ligne par ligne — « J1 : 17e — 5 pts »,
    // « J2 : 9e — 9 pts »… Les recoller en une phrase rendait ces quatre
    // lignes illisibles. On transcrit ce qui a ete ecrit, sans le reformater.
    blocs.push({ type: "paragraphe", texte: paragraphe.join("\n").trim() });
    paragraphe = [];
  };
  const viderListe = () => {
    if (liste.length === 0) return;
    blocs.push({ type: "liste", elements: liste });
    liste = [];
  };
  const viderTableau = () => {
    if (tableau.length === 0) return;
    blocs.push({ type: "tableau", lignes: tableau });
    tableau = [];
  };
  const viderTout = () => {
    viderParagraphe();
    viderListe();
    viderTableau();
  };

  for (const brute of lignes) {
    const ligne = brute.trim();

    if (!ligne) {
      // Une ligne vide ferme un paragraphe et une liste, mais PAS un
      // tableau : l'en-tete « Rang / Joueur / Points » est souvent separe de
      // ses lignes par un blanc, et couper la en deux tableaux donnait deux
      // grilles au lieu d'une. Le tableau se ferme au premier texte qui
      // n'est pas une de ses lignes.
      viderParagraphe();
      viderListe();
      continue;
    }

    // Une barre de separation : « --- », « ___ », « *** ».
    if (/^([-_*])\1{2,}$/.test(ligne.replace(/\s/g, ""))) {
      viderTout();
      // Deux barres qui se suivent ne font qu'une : l'article en contient
      // souvent autour de chaque intertitre.
      if (blocs[blocs.length - 1]?.type !== "separateur") {
        blocs.push({ type: "separateur" });
      }
      continue;
    }

    if (estLigneDeTableau(ligne)) {
      if (estSeparateurDeTableau(ligne)) continue;
      viderParagraphe();
      viderListe();
      tableau.push(cellulesDeLigne(ligne));
      continue;
    }
    viderTableau();

    if (ligne.startsWith(">")) {
      viderTout();
      blocs.push({ type: "citation", texte: ligne.replace(/^>\s*/, "").trim() });
      continue;
    }

    if (PUCE.test(ligne) && !ligne.includes("\t")) {
      viderParagraphe();
      liste.push(ligne.replace(PUCE, "").trim());
      continue;
    }
    viderListe();

    const { emoji, reste } = sansEmojiInitial(ligne);
    if (ligne.startsWith("#") || ressembleAUnTitre(reste)) {
      viderTout();
      blocs.push({ type: "titre", texte: nettoyerTitre(reste), emoji });
      continue;
    }

    paragraphe.push(ligne);
  }

  viderTout();

  // Une barre en fin d'article ne separe plus rien.
  while (blocs[blocs.length - 1]?.type === "separateur") blocs.pop();
  while (blocs[0]?.type === "separateur") blocs.shift();

  return blocs;
}

/**
 * LE TITRE DE UNE.
 *
 * Le premier titre de l'article sert d'en-tete a la page. S'il n'y en a pas,
 * la page garde le sien : mieux vaut un titre generique qu'une page sans
 * titre.
 */
export function titreDeUne(blocs: readonly BlocArticle[]): { texte: string; emoji: string } | null {
  const premier = blocs.find((b) => b.type === "titre");
  if (!premier || premier.type !== "titre") return null;
  return { texte: premier.texte, emoji: premier.emoji };
}
