import { supabase } from "@/lib/supabase";
import { getOfficialClubId } from "@/lib/team-identity";

// ============================================================
// TYPES ADMIN — structure actuelle Supabase
// ============================================================
export interface Player {
  id: string;
  pseudo: string | null;
  username?: string | null;
  avatar_url: string | null;
  favorite_team: string | null;
  favorite_team_override?: boolean;
  is_admin: boolean;
}

export interface Payment {
  id: string;
  // La table `payments` en base utilise la colonne `user_id` (FK vers
  // `profiles.id`), pas `player_id` — voir diagnostic du bug "Could not
  // find the 'player_id' column of 'payments' in the schema cache" :
  // la colonne `player_id` n'a jamais existé côté Supabase, seul le code
  // s'attendait à ce nom.
  user_id: string;
  amount: number;
  paid: boolean;
  payment_date: string | null;
  notes?: string | null;
}

export interface Team {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
}

export interface Season {
  id: string;
  name: string;
  code?: string | null;
  created_at?: string;
}

export interface Competition {
  id: string;
  name: string;
  code?: string | null;
  /** Code football-data.org (ex: "PL", "FL1") — clé de rapprochement pour
   * la synchronisation, distincte de `code` (champ libre plus ancien). */
  external_code?: string | null;
  /** Piloté depuis l'onglet Bonus : le championnat est-il proposé à la
   * synchronisation ? Ligue 1 est active par défaut (comportement Matchs
   * inchangé) ; les autres championnats sont opt-in. */
  is_active?: boolean;
  created_at?: string;
}

/** Championnat tel que renvoyé par l'API football-data.org (source de
 * vérité pour la liste des championnats disponibles — voir /api/competitions),
 * pas encore forcément lié à une ligne `competitions` en base. */
export interface DiscoveredCompetition {
  code: string;
  name: string;
  area?: string | null;
  emblem?: string | null;
}

export interface Matchday {
  id: string;
  code: string | null;
  label: string | null;
  number: number;
  season: string | null;
  season_id: string | null;
  competition_id: string | null;
  is_open: boolean;
  is_finished: boolean;
  deadline: string | null;
  deadline_mode: "manual" | "auto_minus_1" | null;
}

export interface Match {
  id: string;
  matchday_id: string | null;
  matchday_code: string | null;
  matchday: string | null;
  match_day: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team?: string | null;
  away_team?: string | null;
  api_fixture_id: number | null;
  kickoff: string | null;
  kickoff_time?: string | null;
  status: string;
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
  match_type?: string | null;
  is_bonus?: boolean;
}

export interface AppSettings {
  id: number;
  season: string;
  entry_fee: number;

  // Barème de points. Note importante : aucun moteur de calcul de points
  // n'existe aujourd'hui côté code ni côté base (vérifié : aucune
  // fonction/trigger Supabase ne les consomme, `user_journey_points` est
  // une simple table alimentée à part) — ces valeurs sont éditables et
  // persistées, prêtes pour le jour où ce moteur sera écrit.
  bonus_exact_score: number; // points pour un score exact
  points_correct_result: number; // points pour un bon résultat (1N2) sans le score exact
  points_goal_diff_bonus: number; // bonus si le nombre de buts d'une équipe est deviné juste

  // Blocage des pronostics.
  closing_delay_minutes: number;

  // Équipe de cœur (favorite_team par joueur, voir onglet Joueurs).
  favorite_team_deadline: string | null;
  favorite_team_auto_lock: boolean;
  favorite_team_bonus_points: number;

  // Bonus (sélection premium, voir onglet Bonus).
  bonus_draws_per_period: number;
  bonus_match_points: number | null; // null = barème standard (bonus_exact_score / points_correct_result)
  // Fenêtre temporelle d'éligibilité des matchs au tirage bonus. NULL = pas
  // de filtre (comportement historique, tous les matchs sont éligibles).
  bonus_period_start: string | null;
  bonus_period_end: string | null;

  // Autres réglages.
  registration_deadline: string | null;
  timezone: string;
  maintenance_mode: boolean;
  maintenance_message: string | null;
}

// ============================================================
// HELPERS
// ============================================================
function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bfc\b/g, "")
    .replace(/\bfootball club\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

// NOTE : on avait initialement un rapprochement par sous-chaîne bidirectionnel
// (a.includes(b) || b.includes(a)) sur le nom brut. C'était fragile dans les
// deux sens :
//  - faux négatif : un nom API long ("Paris Saint-Germain FC" -> normalisé
//    "parissaintgermain") ne contient pas un nom court en base ("Paris SG" ->
//    "parissg") -> le match était silencieusement ignoré ("Équipe introuvable"),
//    ce qui explique des journées incomplètes (ex. J1 à 6 matchs au lieu de 9).
//  - faux positif : un nom API court ("Paris FC" -> "paris") peut se
//    retrouver être une sous-chaîne d'un nom en base sans rapport.
// On matche désormais par id canonique via getOfficialClubId (même résolveur
// que celui utilisé pour l'affichage des blasons/couleurs), ce qui élimine
// l'ambiguïté : les deux noms doivent désigner le même club Ligue 1 connu.
function teamMatches(team: Team, apiName: string): boolean {
  const apiId = getOfficialClubId(apiName);
  if (!apiId) return false;
  return [team.name, team.short_name].some((v) => getOfficialClubId(v) === apiId);
}

// ============================================================
// 1. JOUEURS
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
  const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", id);
  if (error) throw error;
}

export async function updatePlayer(
  id: string,
  patch: Partial<Pick<Player, "pseudo" | "favorite_team" | "avatar_url" | "favorite_team_override">>,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ============================================================
// 2. PAIEMENTS
// ============================================================
export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*");
  if (error) throw error;
  return (data ?? []) as Payment[];
}

export async function setPaymentPaid(id: string, paid: boolean): Promise<void> {
  // `payments` n'a pas de colonne `updated_at` — `payment_date` fait office
  // de trace temporelle : posée au moment où le paiement est marqué payé,
  // effacée si on revient en arrière.
  const { error } = await supabase
    .from("payments")
    .update({ paid, payment_date: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function setPaymentAmount(id: string, amount: number): Promise<void> {
  const { error } = await supabase.from("payments").update({ amount }).eq("id", id);
  if (error) throw error;
}

export async function generateMissingPayments(players: Player[], payments: Payment[], defaultAmount: number): Promise<void> {
  const existingIds = new Set(payments.map((p) => p.user_id));
  const missing = players.filter((p) => !existingIds.has(p.id));
  if (!missing.length) return;
  const { error } = await supabase.from("payments").insert(
    missing.map((p) => ({ user_id: p.id, amount: defaultAmount, paid: false })),
  );
  if (error) throw error;
}

// ============================================================
// 3. RÉFÉRENTIELS
// ============================================================
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function getSeasons(): Promise<Season[]> {
  const { data, error } = await supabase.from("seasons").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Season[];
}

export async function getCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase.from("competitions").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Competition[];
}

/**
 * Liste des championnats réellement disponibles pour ce compte
 * football-data.org (endpoint `/api/competitions`, clé API côté serveur).
 * Remplace toute liste codée en dur : ce qu'on peut activer dans l'onglet
 * Bonus dépend du plan football-data.org, pas d'une constante front.
 */
export async function getAvailableCompetitions(): Promise<DiscoveredCompetition[]> {
  const response = await fetch("/api/competitions", { headers: { Accept: "application/json" } });
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`L'API des championnats a renvoyé une réponse invalide (${response.status}).`);
  }
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || `Erreur API championnats (${response.status}).`);
  }
  return Array.isArray(payload.competitions) ? payload.competitions : [];
}

/**
 * Active/désactive un championnat depuis l'onglet Bonus. Si `competitionId`
 * est absent (championnat découvert via football-data.org mais jamais
 * synchronisé chez nous), crée la ligne `competitions` correspondante.
 */
export async function setCompetitionActive(
  discovered: DiscoveredCompetition,
  competitionId: string | null,
  isActive: boolean,
): Promise<Competition> {
  if (competitionId) {
    const { data, error } = await supabase
      .from("competitions")
      .update({ is_active: isActive, external_code: discovered.code })
      .eq("id", competitionId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Competition;
  }

  const { data, error } = await supabase
    .from("competitions")
    .insert([{ name: discovered.name, external_code: discovered.code, is_active: isActive }])
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

// ============================================================
// 4. MATCHS
// ============================================================
export async function getMatches(): Promise<Match[]> {
  const { data, error } = await supabase.from("matches").select("*").order("kickoff", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function createMatch(match: Partial<Match>): Promise<void> {
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
// 5. JOURNÉES
// ============================================================
export async function getMatchdays(): Promise<Matchday[]> {
  const { data, error } = await supabase.from("matchdays").select("*").order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Matchday[];
}

export async function createMatchday(
  seasonId: string,
  competitionId: string,
  number: number,
  deadline?: string | null,
): Promise<void> {
  const season = (await supabase.from("seasons").select("name,code").eq("id", seasonId).single()).data;
  const code = `J${number}`;
  const { error } = await supabase.from("matchdays").insert([{
    code,
    label: `Journée ${number}`,
    number,
    season_id: seasonId,
    competition_id: competitionId,
    season: season?.name ?? "2026-2027",
    is_open: false,
    is_finished: false,
    deadline: deadline || null,
  }]);
  if (error) throw error;
}

export async function updateMatchday(id: string, patch: Partial<Matchday>): Promise<void> {
  const { error } = await supabase.from("matchdays").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setMatchdayFinished(id: string, finished: boolean): Promise<void> {
  const { error } = await supabase.from("matchdays").update({ is_finished: finished }).eq("id", id);
  if (error) throw error;
}

export async function deleteMatchday(id: string): Promise<void> {
  const { error } = await supabase.from("matchdays").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// 6. RÉGLAGES
// ============================================================
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as AppSettings;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, "id">>): Promise<void> {
  const { error } = await supabase.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
}

// ============================================================
// 7. SYNCHRONISATION DIRECTE API VERCEL -> SUPABASE
// ============================================================
export interface SyncSummary {
  created: number;
  updated: number;
  skipped: number;
  matchdaysCreated: number;
  warnings: string[];
  errors: string[];
}

/**
 * Synchronise les matchs d'un championnat football-data.org donné
 * (`FL1`, `PL`, `PD`, `SA`, `BL1`, ...) vers Supabase.
 *
 * Ligue 1 (FL1) est un cas particulier : les pronostics s'appuient sur
 * `home_team_id`/`away_team_id` (FK vers `teams`, pour badges/logos), donc
 * on résout et exige une correspondance d'équipe connue — comportement
 * historique inchangé, un match sans équipe reconnue est ignoré.
 *
 * Les autres championnats (onglet Bonus) n'ont pas d'équipes en base
 * (`teams` ne contient que les 18 clubs de Ligue 1) : la sélection bonus
 * n'a de toute façon besoin que des noms (`match.home_team`/`away_team`,
 * voir bonusSelectionService), donc `home_team_id`/`away_team_id` restent
 * `null` et aucune équipe n'est jamais "introuvable" pour ces championnats.
 */
export async function syncCompetitionMatches(competitionCode: string): Promise<SyncSummary> {
  const summary: SyncSummary = { created: 0, updated: 0, skipped: 0, matchdaysCreated: 0, warnings: [], errors: [] };
  const isLigue1 = competitionCode === "FL1";

  const response = await fetch(`/api/ligue1/matchs?season=2026&competition=${encodeURIComponent(competitionCode)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`L'API football-data.org a renvoyé une réponse invalide (${response.status}).`);
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || `Erreur API football-data.org (${response.status}).`);
  }

  const apiMatches = Array.isArray(payload.matchs) ? payload.matchs : [];
  if (!apiMatches.length) return summary;

  const [teams, seasons, competitions, existingMatchdays, existingMatches] = await Promise.all([
    getTeams(),
    getSeasons(),
    getCompetitions(),
    getMatchdays(),
    getMatches(),
  ]);

  const season = seasons.find((s) => s.code === "2026-2027" || s.name === "2026-2027") || seasons[0];
  const competition = competitions.find((c) => c.external_code === competitionCode || c.code === competitionCode);
  if (!season) throw new Error("La saison 2026-2027 est introuvable dans Supabase.");
  if (!competition) {
    throw new Error(
      `Le championnat ${competitionCode} n'a pas encore de ligne "competitions" en base — active-le depuis l'onglet Bonus avant de synchroniser.`,
    );
  }

  // Scopé à ce championnat : deux championnats différents peuvent avoir
  // chacun une "J1"/journée n°1, la clé de correspondance ne doit donc
  // jamais mélanger leurs journées.
  const matchdaysByCode = new Map(
    existingMatchdays
      .filter((m) => m.competition_id === competition.id)
      .map((m) => [String(m.code || `J${m.number}`), m]),
  );
  const matchesByFixture = new Map(existingMatches.filter((m) => m.api_fixture_id != null).map((m) => [Number(m.api_fixture_id), m]));

  for (const apiMatch of apiMatches) {
    try {
      const number = Number(apiMatch.journee);
      if (!Number.isInteger(number) || number < 1) {
        summary.skipped++;
        summary.warnings.push(`Journée invalide pour ${apiMatch.domicile || "?"} - ${apiMatch.exterieur || "?"}.`);
        continue;
      }

      let homeTeamId: string | null = null;
      let awayTeamId: string | null = null;
      if (isLigue1) {
        const home = teams.find((t) => teamMatches(t, apiMatch.domicile));
        const away = teams.find((t) => teamMatches(t, apiMatch.exterieur));
        if (!home || !away) {
          summary.skipped++;
          summary.warnings.push(`Équipe introuvable : ${apiMatch.domicile} / ${apiMatch.exterieur}`);
          continue;
        }
        homeTeamId = home.id;
        awayTeamId = away.id;
      }

      const code = `J${number}`;
      let matchday = matchdaysByCode.get(code);
      if (!matchday) {
        const { data, error } = await supabase.from("matchdays").insert([{
          code,
          label: `Journée ${number}`,
          number,
          season_id: season.id,
          competition_id: competition.id,
          season: season.name,
          is_open: false,
          is_finished: false,
          deadline: null,
          deadline_mode: "manual",
        }]).select("*").single();
        if (error) throw error;
        matchday = data as Matchday;
        matchdaysByCode.set(code, matchday);
        summary.matchdaysCreated++;
      }

      const kickoff = apiMatch.date && apiMatch.heure ? `${apiMatch.date}T${apiMatch.heure}:00Z` : null;
      const finished = String(apiMatch.statut || "").toUpperCase() === "FINISHED";
      const fixtureId = apiMatch.apiFixtureId != null ? Number(apiMatch.apiFixtureId) : null;

      const row = {
        matchday_id: matchday.id,
        matchday_code: code,
        matchday: code,
        match_day: number,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team: apiMatch.domicile,
        away_team: apiMatch.exterieur,
        api_fixture_id: fixtureId,
        kickoff,
        kickoff_time: kickoff,
        status: String(apiMatch.statut || "SCHEDULED"),
        finished,
        home_score: apiMatch.scoreDomicile ?? null,
        away_score: apiMatch.scoreExterieur ?? null,
        match_type: competitionCode === "FL1" ? "LIGUE1" : competitionCode,
        is_bonus: false,
      };

      const existing = fixtureId != null ? matchesByFixture.get(fixtureId) : undefined;
      if (existing) {
        const { error } = await supabase.from("matches").update(row).eq("id", existing.id);
        if (error) throw error;
        summary.updated++;
      } else {
        const { data, error } = await supabase.from("matches").insert([row]).select("*").single();
        if (error) throw error;
        if (data?.api_fixture_id != null) matchesByFixture.set(Number(data.api_fixture_id), data as Match);
        summary.created++;
      }
    } catch (error: any) {
      summary.errors.push(`${apiMatch.domicile || "?"} - ${apiMatch.exterieur || "?"} : ${error?.message || error}`);
    }
  }

  return summary;
}

/** Alias rétrocompatible : synchronisation Ligue 1 (utilisé par l'onglet Matchs). */
export function syncLigue1Matches(): Promise<SyncSummary> {
  return syncCompetitionMatches("FL1");
}
/* ============================================================
   VERROUILLAGE DES PRONOSTICS
   ============================================================ */

export async function setMatchdayDeadline(
  matchdayId: string,
  deadline: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({
      deadline,
      deadline_mode: "manual",
    })
    .eq("id", matchdayId);

  if (error) throw error;
}

export async function setMatchdayAutoMinusOne(
  matchdayId: string,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({
      deadline: null,
      deadline_mode: "auto_minus_1",
    })
    .eq("id", matchdayId);

  if (error) throw error;
}

export async function clearMatchdayDeadline(
  matchdayId: string,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({
      deadline: null,
      deadline_mode: "manual",
    })
    .eq("id", matchdayId);

  if (error) throw error;
}
