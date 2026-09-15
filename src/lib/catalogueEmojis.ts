/**
 * LE CATALOGUE D'EMOJIS DU DEBRIEF.
 *
 * L'organisateur veut « la totalite des emojis » : le choix ne se fait plus
 * dans une barre de douze mais dans un vrai selecteur, par categories, comme
 * dans une messagerie.
 *
 * POURQUOI UNE LISTE ECRITE ICI plutot qu'un paquet installe ou la totalite
 * d'Unicode : un selecteur qui affiche tout Unicode montre surtout des cases
 * vides. Une bonne moitie des points de code « emoji » n'a pas de dessin sur
 * un telephone donne, et l'utilisateur voit un carre. Cette liste ne contient
 * que des emojis dessines partout depuis des annees — mieux vaut trois cents
 * emojis qui s'affichent que trois mille dont un tiers sont des carres.
 *
 * Aucune dependance ajoutee au projet pour cela : c'est un tableau de chaines.
 */

export type CategorieEmojis = {
  /** Identifiant stable, utilise par l'interface. */
  cle: string;
  /** Le nom montre au joueur. */
  nom: string;
  /** L'emoji qui sert d'onglet. */
  onglet: string;
  emojis: readonly string[];
};

export const CATEGORIES_EMOJIS: readonly CategorieEmojis[] = [
  {
    cle: "football",
    nom: "Football",
    onglet: "⚽",
    emojis: [
      "⚽", "🥅", "🏟️", "🏆", "🥇", "🥈", "🥉", "🎯", "📈", "📉",
      "🐐", "🦵", "🧤", "🟨", "🟥", "🚩", "⏱️", "⌛", "📊", "🎽",
      "👟", "🏅", "🎖️", "🔔", "📣", "🎺", "🥁", "🎉", "🎊", "✨",
    ],
  },
  {
    cle: "reactions",
    nom: "Réactions",
    onglet: "👏",
    emojis: [
      "👏", "🔥", "💪", "👀", "🤯", "😮", "😂", "🤣", "😭", "😢",
      "😅", "😬", "😱", "🙃", "😏", "🙄", "😳", "🥶", "💀", "🫡",
      "🤝", "🙌", "👊", "✊", "🤞", "🤙", "👌", "🤌", "👍", "👎",
      "🙏", "💯", "❤️", "💔", "⭐", "💥", "⚡", "🎈", "🍾", "🥂",
    ],
  },
  {
    cle: "sourires",
    nom: "Sourires",
    onglet: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😊", "🙂", "😉", "😍", "🥰",
      "😘", "😗", "😚", "🤗", "🤩", "🥳", "😎", "🤓", "🧐", "🤔",
      "🤨", "😐", "😑", "😶", "😒", "😔", "😟", "🙁", "☹️", "😕",
      "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😠", "😡",
      "🤬", "😈", "👿", "🤡", "💩", "👻", "💀", "☠️", "👽", "🤖",
      "🥺", "🥹", "😴", "😪", "🤤", "🤫", "🤭", "🫢", "🫣", "😷",
    ],
  },
  {
    cle: "gestes",
    nom: "Gestes",
    onglet: "🙋",
    emojis: [
      "🙋", "🤷", "🤦", "💁", "🙅", "🙆", "🙇", "🧏", "💆", "💇",
      "🕺", "💃", "🕴️", "👯", "🧘", "🏃", "🚶", "🧎", "🤺", "🏇",
      "⛷️", "🏂", "🏌️", "🏄", "🚣", "🏊", "⛹️", "🏋️", "🚴", "🤸",
      "🤼", "🤽", "🤾", "🤹", "🧗", "🛌", "👋", "🤚", "🖐️", "✋",
    ],
  },
  {
    cle: "animaux",
    nom: "Animaux",
    onglet: "🦊",
    emojis: [
      "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷",
      "🐸", "🐵", "🙈", "🙉", "🙊", "🐔", "🐧", "🐦", "🦅", "🦉",
      "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞",
      "🐢", "🐍", "🦖", "🐙", "🦀", "🐬", "🐳", "🦈", "🐊", "🐅",
      "🐆", "🦓", "🦍", "🐘", "🦏", "🐪", "🦒", "🐃", "🐂", "🐏",
    ],
  },
  {
    cle: "nourriture",
    nom: "Nourriture",
    onglet: "🍕",
    emojis: [
      "🍕", "🍔", "🍟", "🌭", "🥪", "🌮", "🌯", "🥙", "🧆", "🥗",
      "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍗", "🍖",
      "🥩", "🥓", "🍳", "🥐", "🥖", "🧀", "🥞", "🧇", "🍞", "🥯",
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒",
      "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🌶️", "🌽", "🥕",
      "🍰", "🎂", "🧁", "🍪", "🍫", "🍬", "🍭", "🍩", "🍦", "🍺",
      "🍻", "🥤", "☕", "🧃", "🍷", "🥃", "🍸", "🧊", "🍿", "🥨",
    ],
  },
  {
    cle: "objets",
    nom: "Objets",
    onglet: "📱",
    emojis: [
      "📱", "💻", "⌨️", "🖥️", "🖨️", "📷", "📹", "🎥", "📺", "📻",
      "🎙️", "🎧", "🎸", "🎹", "🎺", "🎻", "🥁", "🎬", "📚", "📖",
      "📝", "✏️", "🖊️", "📎", "📌", "📍", "✂️", "🔑", "🔒", "🔓",
      "💡", "🔦", "🕯️", "🧯", "🛒", "💰", "💵", "💳", "💎", "⚖️",
      "🔧", "🔨", "🪓", "⚙️", "🧲", "🔬", "🔭", "📡", "💊", "🩹",
      "🚗", "🚕", "🚌", "🚑", "🚒", "✈️", "🚀", "🛸", "🚁", "⛵",
    ],
  },
  {
    cle: "nature",
    nom: "Nature",
    onglet: "🌍",
    emojis: [
      "🌍", "🌞", "🌝", "🌚", "🌜", "⭐", "🌟", "💫", "☄️", "🌈",
      "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "❄️",
      "☃️", "⛄", "🌬️", "💨", "🌪️", "🌫️", "🌊", "💧", "🔥", "🌋",
      "🏔️", "⛰️", "🌲", "🌳", "🌴", "🌵", "🌾", "🌻", "🌹", "🌷",
      "🌸", "🌼", "🍀", "🍁", "🍂", "🍃", "🌱", "🪴", "🎄", "🪐",
    ],
  },
  {
    cle: "symboles",
    nom: "Symboles",
    onglet: "💯",
    emojis: [
      "💯", "✅", "❌", "⭕", "❗", "❓", "‼️", "⁉️", "💤", "💬",
      "💭", "🗯️", "♠️", "♥️", "♦️", "♣️", "🎲", "🎰", "🃏", "🎴",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔶",
      "🔷", "🔺", "🔻", "▶️", "⏸️", "⏹️", "🔁", "🔂", "🔄", "🔝",
      "⬆️", "⬇️", "⬅️", "➡️", "↗️", "↘️", "♾️", "©️", "®️", "™️",
    ],
  },
] as const;

/**
 * LES FAVORIS, montres en premier.
 *
 * Ce sont les douze de la version precedente : ceux avec lesquels des
 * reactions ont deja ete posees, et ceux qui parlent le mieux d'un match.
 * Ils restent a portee de pouce, sans avoir a ouvrir le selecteur.
 */
export const EMOJIS_FAVORIS = [
  "👏", "🔥", "💪", "🎯", "🏆", "🐐",
  "⚽", "🤯", "😮", "😂", "😢", "👀",
] as const;

/** Tous les emojis du catalogue, sans doublon, dans l'ordre des categories. */
export function tousLesEmojis(): string[] {
  const vus = new Set<string>();
  const tout: string[] = [];
  CATEGORIES_EMOJIS.forEach((categorie) => {
    categorie.emojis.forEach((emoji) => {
      if (vus.has(emoji)) return;
      vus.add(emoji);
      tout.push(emoji);
    });
  });
  return tout;
}

/**
 * CE QUI PEUT ETRE ENREGISTRE COMME REACTION.
 *
 * Volontairement une regle de FORME, et non la liste ci-dessus : le
 * catalogue s'enrichira, et une reaction posee aujourd'hui doit rester
 * valable demain. La regle dit seulement « un symbole court, pas du texte ».
 *
 * C'est le point qui compte pour une page lue par vingt-trois personnes :
 * sans elle, le champ « emoji » deviendrait un champ de texte libre, et le
 * Debrief un endroit ou ecrire n'importe quoi sans moderation possible.
 * La meme regle est appliquee par la base (contrainte
 * `debrief_reactions_emoji_valide`), qui a le dernier mot.
 */
export function emojiValide(valeur: string): boolean {
  const emoji = String(valeur ?? "");
  // Assez long pour un emoji compose (drapeau, famille, teinte de peau),
  // assez court pour qu'une phrase ne passe pas.
  if ([...emoji].length < 1 || [...emoji].length > 8) return false;
  // Ni lettre, ni chiffre, ni espace : c'est ce qui separe un emoji d'un mot.
  if (/[\p{L}\p{N}\s]/u.test(emoji)) return false;
  // Au moins un caractere symbole : « ... » ou « !!! » ne sont pas des emojis.
  // Les drapeaux (🇫🇷) sont faits de deux « indicateurs regionaux », qui ne
  // sont PAS des pictogrammes au sens d'Unicode : sans cette seconde plage,
  // aucun drapeau ne passerait.
  return /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u.test(emoji);
}
