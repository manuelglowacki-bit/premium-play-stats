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