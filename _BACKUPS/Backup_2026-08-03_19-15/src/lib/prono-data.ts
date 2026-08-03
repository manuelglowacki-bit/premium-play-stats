export type Club = {
  id: string;
  name: string;
  short: string;
  from: string;
  to: string;
};

export const clubs: Record<string, Club> = {
  tfc: { id: "tfc", name: "Toulouse FC", short: "TFC", from: "#6d3ea8", to: "#e0305f" },
  psg: { id: "psg", name: "Paris SG", short: "PSG", from: "#0b2a63", to: "#d4123a" },
  om: { id: "om", name: "Olympique de Marseille", short: "OM", from: "#0f7fc2", to: "#7ddcff" },
  ol: { id: "ol", name: "Olympique Lyonnais", short: "OL", from: "#0a2f6d", to: "#c8102e" },
  losc: { id: "losc", name: "LOSC Lille", short: "LOSC", from: "#8b1220", to: "#e23a4a" },
  asm: { id: "asm", name: "AS Monaco", short: "ASM", from: "#b2103a", to: "#f0f2f5" },
  sre: { id: "sre", name: "Stade Rennais", short: "SRFC", from: "#9e1220", to: "#1a1a1a" },
};

export type Player = {
  rank: number;
  name: string;
  initial: string;
  score: number;
  exact: number;
  club: string;
  tone: string;
  movement: number;
  current?: boolean;
};

export const ranking: Player[] = [
  { rank: 1, name: "Samuel", initial: "S", score: 150, exact: 6, club: "psg", tone: "#b07608", movement: 0 },
  { rank: 2, name: "Eric", initial: "E", score: 150, exact: 6, club: "om", tone: "#167cb0", movement: 0 },
  { rank: 3, name: "Jo B", initial: "J", score: 145, exact: 5, club: "losc", tone: "#bc5628", movement: 2 },
  { rank: 4, name: "Hugo", initial: "H", score: 136, exact: 3, club: "ol", tone: "#634ba0", movement: 1 },
  { rank: 5, name: "Red evils", initial: "R", score: 112, exact: 2, club: "tfc", tone: "#aa2c37", movement: 3, current: true },
];

export const seasonStats = [
  { label: "Bons pronos", value: "68%", sub: "34 / 50", accent: "var(--mint)" },
  { label: "Scores exacts", value: "2", sub: "4% des pronos", accent: "var(--sky)" },
  { label: "Points moyens", value: "22.4", sub: "Par journée", accent: "var(--gold)" },
  { label: "Meilleure journée", value: "41", sub: "Points · J3", accent: "var(--primary)" },
  { label: "Journées jouées", value: "5 / 34", sub: "15%", accent: "var(--sky)" },
];

export const fallbackClub: Club = clubs["tfc"]!;

export const clubOf = (id: string): Club => clubs[id] ?? fallbackClub;

export type Match = {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  odds: [string, string, string];
};

export const matchday = { number: 1, label: "J1 · Vendredi 21 août 2026" };

export const matches: Match[] = [
  { id: "m1", home: "psg", away: "tfc", date: "Ven 21 août", time: "20:45", odds: ["1.35", "4.60", "7.20"] },
  { id: "m2", home: "om", away: "losc", date: "Sam 22 août", time: "17:00", odds: ["1.90", "3.40", "3.80"] },
  { id: "m3", home: "ol", away: "asm", date: "Sam 22 août", time: "21:05", odds: ["2.35", "3.30", "2.85"] },
  { id: "m4", home: "sre", away: "psg", date: "Dim 23 août", time: "15:00", odds: ["4.10", "3.70", "1.75"] },
  { id: "m5", home: "losc", away: "ol", date: "Dim 23 août", time: "17:15", odds: ["2.55", "3.25", "2.60"] },
  { id: "m6", home: "asm", away: "om", date: "Dim 23 août", time: "20:45", odds: ["2.20", "3.35", "3.05"] },
];

export type Article = {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  tone: string;
};

export const articles: Article[] = [
  {
    id: "a1",
    tag: "ÉDITO",
    title: "Samuel prend la tête, la course est lancée",
    excerpt:
      "Six scores exacts en cinq journées : le leader impose un rythme que personne n'avait vu venir. Retour sur une entame de saison parfaite.",
    author: "La Rédac",
    date: "5 min · J5",
    tone: "var(--gold)",
  },
  {
    id: "a2",
    tag: "ANALYSE",
    title: "Pourquoi tout le monde se trompe sur Toulouse",
    excerpt:
      "Le TFC est l'équipe la plus mal pronostiquée de la ligue. Les chiffres montrent une régularité que les parieurs refusent de voir.",
    author: "Red evils",
    date: "3 min · J5",
    tone: "var(--primary)",
  },
  {
    id: "a3",
    tag: "DUEL",
    title: "Eric vs Samuel : 150 points partout",
    excerpt:
      "Deux styles opposés, un score identique. Le premier joue la sécurité, le second tente les scores exacts. Qui craquera le premier ?",
    author: "La Rédac",
    date: "4 min · J5",
    tone: "var(--sky)",
  },
  {
    id: "a4",
    tag: "STATS",
    title: "Le match le plus difficile de la J1",
    excerpt:
      "Seuls 18% des pronostiqueurs ont trouvé le bon vainqueur. Décryptage de la rencontre qui a fait basculer le classement.",
    author: "La Rédac",
    date: "6 min · J4",
    tone: "var(--mint)",
  },
];

export type Trophy = {
  id: string;
  name: string;
  desc: string;
  progress: number;
  goal: number;
  unlocked: boolean;
  tone: string;
};

export const trophies: Trophy[] = [
  { id: "t1", name: "Premier prono", desc: "Valider ton premier pronostic", progress: 1, goal: 1, unlocked: true, tone: "var(--mint)" },
  { id: "t2", name: "Œil de lynx", desc: "Trouver 5 scores exacts", progress: 2, goal: 5, unlocked: false, tone: "var(--sky)" },
  { id: "t3", name: "Série parfaite", desc: "3 journées consécutives au-dessus de 30 pts", progress: 1, goal: 3, unlocked: false, tone: "var(--gold)" },
  { id: "t4", name: "Fidèle", desc: "Pronostiquer 10 journées d'affilée", progress: 5, goal: 10, unlocked: false, tone: "var(--primary)" },
  { id: "t5", name: "Supporter", desc: "Choisir ton club de cœur", progress: 1, goal: 1, unlocked: true, tone: "var(--mint)" },
  { id: "t6", name: "Roi de la journée", desc: "Finir 1er d'une journée", progress: 0, goal: 1, unlocked: false, tone: "var(--gold)" },
];

export const journeyPoints = [
  { journey: "J1", points: 18 },
  { journey: "J2", points: 24 },
  { journey: "J3", points: 41 },
  { journey: "J4", points: 12 },
  { journey: "J5", points: 17 },
];
