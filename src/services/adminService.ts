import { supabase } from "@/lib/supabase";

// ============================================================
// Types
// ============================================================
export interface Player {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
  favorite_team: string | null;
  is_admin: boolean;
}

export interface Payment {
  id: string;
  player_id: string;
  amount: number;
  paid: boolean;
  updated_at?: string;
}

export interface Competition {
  id: string;
  name: string;
  country: string | null;
  logo_url: string | null;
}

export interface Season {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface Team {
  id: string;
  competition_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
}

export interface Matchday {
  id: string;
  season_id: string;
  competition_id: string;
  number: number;
  deadline: string | null;
  is_finished: boolean;
}

export interface Match {
  id: string;
  matchday_id: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
}

export interface AppSettings {
  id: number;
  season: string;
  entry_fee: number;
  bonus_exact_score: number;
  closing_delay_minutes: number;
}

// ============================================================
// 1. JOUEURS (table `profiles`)
// ============================================================
export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("pseudo", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function setPlayerAdmin(id: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", id);
  if (error) throw error;
}

export async function updatePlayer(
  id: string,
  patch: Partial<Pick<Player, "pseudo" | "favorite_team" | "avatar_url">>,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ============================================================
// 2. PAIEMENTS (table `payments`)
// ============================================================
export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*");
  if (error) throw error;
  return (data ?? []) as Payment[];
}

export async function setPaymentPaid(id: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ paid, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setPaymentAmount(id: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ amount, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

/** Crée une ligne `payments` pour chaque joueur qui n'en a pas encore. */
export async function generateMissingPayments(
  players: Player[],
  payments: Payment[],
  defaultAmount: number,
): Promise<void> {
  const existingIds = new Set(payments.map((p) => p.player_id));
  const missing = players.filter((pl) => !existingIds.has(pl.id));

  if (missing.length === 0) return;

  const rows = missing.map((pl) => ({
    player_id: pl.id,
    amount: defaultAmount,
    paid: false,
  }));

  const { error } = await supabase.from("payments").insert(rows);
  if (error) throw error;
}

// ============================================================
// 3. MATCHS (table `matches`)
// ============================================================
export async function getMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function createMatch(match: Omit<Match, "id">): Promise<void> {
  const { error } = await supabase.from("matches").insert([match]);
  if (error) throw error;
}

export async function updateMatch(id: string, match: Partial<Match>): Promise<void> {
  const { error } = await supabase.from("matches").update(match).eq("id", id);
  if (error) throw error;
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// 4. JOURNÉES (table `matchdays`)
// ============================================================
export async function getMatchdays(): Promise<Matchday[]> {
  const { data, error } = await supabase
    .from("matchdays")
    .select("*")
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Matchday[];
}

export async function createMatchday(
  seasonId: string,
  competitionId: string,
  number: number,
  deadline?: string | null,
): Promise<void> {
  const { error } = await supabase.from("matchdays").insert([
    {
      season_id: seasonId,
      competition_id: competitionId,
      number,
      is_finished: false,
      deadline: deadline || null,
    },
  ]);
  if (error) throw error;
}

export async function updateMatchday(
  id: string,
  patch: Partial<Pick<Matchday, "number" | "season_id" | "competition_id" | "deadline">>,
): Promise<void> {
  const { error } = await supabase.from("matchdays").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setMatchdayFinished(id: string, isFinished: boolean): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({ is_finished: isFinished })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMatchday(id: string): Promise<void> {
  const { error } = await supabase.from("matchdays").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// 4bis. RÉFÉRENTIELS (tables `teams`, `seasons`, `competitions`)
// Lecture seule — utilisés pour peupler les sélecteurs des formulaires
// ============================================================
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function getSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Season[];
}

export async function getCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Competition[];
}

// ============================================================
// 5. RÉGLAGES (table `app_settings`, singleton id = 1)
// ============================================================
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as AppSettings;
}

export async function updateSettings(
  patch: Partial<Pick<AppSettings, "season" | "entry_fee" | "bonus_exact_score" | "closing_delay_minutes">>,
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}