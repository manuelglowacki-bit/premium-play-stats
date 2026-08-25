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
  favorite_team_id: string | null;
  favorite_team_override?: boolean;
  is_admin: boolean;
  /** Derniere ouverture reelle du site (migration 20260824120000). */
  last_seen_at?: string | null;
}

export interface Payment {
  id: string;
  // La table `payments` en base utilise `user_id` (FK profiles.id), pas
  // `player_id` (jamais existé côté Supabase — cause de l'erreur "Could
  // not find the 'player_id' column of 'payments' in the schema cache"),
  // et `payment_date`/`notes`, pas `updated_at` (colonne absente elle
  // aussi) — vérifié directement en base.
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
  external_code?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface DiscoveredCompetition {
  code: string;
  name: string;
  country?: string | null;
  emblem?: string | null;
  available?: boolean;
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

  // Barème de points. Aucun moteur de calcul de points n'existe encore
  // côté code ni base — ces valeurs sont éditables/persistées, prêtes
  // pour le jour où ce moteur sera écrit.
  bonus_exact_score: number;
  points_correct_result: number;
  points_goal_diff_bonus: number;

  closing_delay_minutes: number;

  favorite_team_deadline: string | null;
  favorite_team_auto_lock: boolean;
  favorite_team_bonus_points: number;

  bonus_draws_per_period: number;
  bonus_match_points: number | null;
  bonus_period_start?: string | null;
  bonus_period_end?: string | null;

  registration_deadline: string | null;
  timezone: string;
  maintenance_mode: boolean;
  maintenance_message: string | null;

  // Colonne bien presente en base (migration 20260817090000), toujours lue et
  // enregistree par l'ecran Reglages, mais absente de ce type : TypeScript
  // signalait donc une erreur sur du code parfaitement fonctionnel. La
  // bascule Mercato a ete retiree de l'interface Admin a la demande de
  // l'organisateur ; la valeur, elle, continue d'etre conservee, pour que
  // rien ne soit perdu si la bascule revient. Optionnelle : les anciennes
  // lignes peuvent ne pas la porter.
  mercato_active?: boolean | null;
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
  patch: Partial<Pick<Player, "pseudo" | "favorite_team_id" | "avatar_url" | "favorite_team_override">>,
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

/**
 * Nettoie et reconstruit la liste des paiements à partir des joueurs réels.
 * - 1 seul paiement conservé par user_id
 * - si plusieurs lignes existent, on conserve en priorité une ligne PAYÉE,
 *   puis la plus récente
 * - les joueurs sans paiement reçoivent une ligne à defaultAmount
 * - les lignes doublons sont supprimées de Supabase
 */
export async function regeneratePayments(
  players: Player[],
  defaultAmount: number,
): Promise<{ created: number; removedDuplicates: number }> {
  const { data, error } = await supabase.from("payments").select("*");
  if (error) throw error;

  const raw = (data ?? []) as Payment[];
  const byUser = new Map<string, Payment[]>();

  for (const payment of raw) {
    const rows = byUser.get(payment.user_id) ?? [];
    rows.push(payment);
    byUser.set(payment.user_id, rows);
  }

  const duplicateIds: string[] = [];

  for (const rows of byUser.values()) {
    if (rows.length <= 1) continue;

    const sorted = [...rows].sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? -1 : 1;
      const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
      const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return String(a.id).localeCompare(String(b.id));
    });

    for (const duplicate of sorted.slice(1)) {
      duplicateIds.push(duplicate.id);
    }
  }

  if (duplicateIds.length) {
    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .in("id", duplicateIds);
    if (deleteError) throw deleteError;
  }

  const existingUserIds = new Set(
    raw.filter((payment) => !duplicateIds.includes(payment.id)).map((payment) => payment.user_id),
  );

  const missing = players.filter((player) => !existingUserIds.has(player.id));

  if (missing.length) {
    const { error: insertError } = await supabase.from("payments").insert(
      missing.map((player) => ({
        user_id: player.id,
        amount: defaultAmount,
        paid: false,
      })),
    );
    if (insertError) throw insertError;
  }

  return { created: missing.length, removedDuplicates: duplicateIds.length };
}

export async function setPaymentPaid(id: string, paid: boolean): Promise<void> {
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

// ============================================================
// 4. MATCHS
// ============================================================
// getMatches() pagine explicitement par lots de MATCHES_PAGE_SIZE lignes :
// Supabase (PostgREST hébergé) plafonne toute requête à 1000 lignes par
// défaut ("Max Rows", réglage serveur invisible dans ce code), et la table
// `matches` dépasse déjà ce plafond (~1750 lignes mesurées le 2026-08-10,
// en croissance à chaque championnat/saison synchronisé). Un simple
// .select("*") sans pagination tronque donc silencieusement le résultat au
// 1000e match trié par kickoff — c'est ce qui causait de faux "aucun match
// éligible" dans l'onglet Bonus (BonusTab), qui filtre ce tableau côté
// client. NE PAS retirer cette boucle en pensant que c'est du code mort :
// sans elle, getMatches() re-tronque dès que la table dépasse PAGE_SIZE
// lignes, sans la moindre erreur pour le signaler.
//
// (Les autres select("*") de ce fichier — teams: 18, seasons: 1,
// competitions: 9, matchdays: 182, payments/profiles: <10 lignes, mesurés le
// même jour — restent très en dessous du plafond et sont structurellement
// bornés par le nombre de clubs/saisons/utilisateurs ; pas besoin de la même
// pagination pour l'instant.)
const MATCHES_PAGE_SIZE = 1000;

export async function getMatches(): Promise<Match[]> {
  const all: Match[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("kickoff", { ascending: true })
      .range(from, from + MATCHES_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Match[];
    all.push(...page);
    if (page.length < MATCHES_PAGE_SIZE) break;
    from += MATCHES_PAGE_SIZE;
  }
  return all;
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

export async function syncLigue1Matches(): Promise<SyncSummary> {
  const summary: SyncSummary = { created: 0, updated: 0, skipped: 0, matchdaysCreated: 0, warnings: [], errors: [] };

  const response = await fetch("/api/ligue1/matchs?season=2026", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`L'API Ligue 1 a renvoyé une réponse invalide (${response.status}).`);
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || `Erreur API Ligue 1 (${response.status}).`);
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
  const competition = competitions.find((c) => c.code === "FL1" || normalize(c.name) === "ligue1");
  if (!season) throw new Error("La saison 2026-2027 est introuvable dans Supabase.");
  if (!competition) throw new Error("La compétition Ligue 1 (FL1) est introuvable dans Supabase.");

  // BUG corrigé ici — cette map était construite depuis TOUTES les
  // matchdays de la base, indexées uniquement par `code` ("J1", "J2", ...),
  // sans filtrer par compétition/saison. Comme les championnats étrangers
  // (syncCompetitionMatches, plus bas dans ce fichier) utilisent le même
  // format de code, une matchday "J1" de Serie A/Bundesliga/etc. pouvait
  // écraser celle de Ligue 1 dans cette map (Map.set garde la dernière
  // valeur pour une clé donnée) — les matchs Ligue 1 se retrouvaient alors
  // rattachés à la matchday d'un AUTRE championnat portant le même numéro.
  // On scope désormais par competition_id + season_id, comme le fait déjà
  // correctement syncCompetitionMatches.
  const matchdaysByNumber = new Map(
    existingMatchdays
      .filter((m) => m.competition_id === competition.id && m.season_id === season.id)
      .map((m) => [Number(m.number), m]),
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

      const home = teams.find((t) => teamMatches(t, apiMatch.domicile));
      const away = teams.find((t) => teamMatches(t, apiMatch.exterieur));
      if (!home || !away) {
        summary.skipped++;
        summary.warnings.push(`Équipe introuvable : ${apiMatch.domicile} / ${apiMatch.exterieur}`);
        continue;
      }

      const code = `J${number}`;
      let matchday = matchdaysByNumber.get(number);
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
          // VERROUILLAGE PAR DEFAUT. Le couple (deadline_mode "manual",
          // deadline null) signifie AUCUN blocage : les pronostics restent
          // ouverts apres le coup d'envoi, donc apres le resultat. Une
          // journee creee automatiquement par la synchro arrivait ainsi
          // grande ouverte, et rien ne le signalait.
          //
          // Le defaut sur : verrouillage 1 minute avant chaque coup d'envoi.
          // L'admin peut toujours choisir autre chose depuis l'onglet
          // Verrouillage, mais il doit le faire exprès.
          deadline_mode: "auto_minus_1",
        }]).select("*").single();
        if (error) throw error;
        matchday = data as Matchday;
        matchdaysByNumber.set(number, matchday);
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
        home_team_id: home.id,
        away_team_id: away.id,
        home_team: apiMatch.domicile,
        away_team: apiMatch.exterieur,
        api_fixture_id: fixtureId,
        kickoff,
        kickoff_time: kickoff,
        status: String(apiMatch.statut || "SCHEDULED"),
        finished,
        home_score: apiMatch.scoreDomicile ?? null,
        away_score: apiMatch.scoreExterieur ?? null,
        match_type: "LIGUE1",
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


// ============================================================
// 8. CHAMPIONNATS BONUS — API football-data.org
// ============================================================
const BONUS_COMPETITIONS: Record<string, { name: string; country: string }> = {
  PL: { name: "Premier League", country: "England" },
  PD: { name: "Liga", country: "Spain" },
  SA: { name: "Serie A", country: "Italy" },
  BL1: { name: "Bundesliga", country: "Germany" },
};

export async function getAvailableCompetitions(): Promise<DiscoveredCompetition[]> {
  const response = await fetch("/api/ligue1/matchs?season=2026&competition=ALL", {
    headers: { Accept: "application/json" },
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Le handler ne renvoie jamais 502 lui-même pour competition=ALL (les
    // erreurs par championnat sont tolérées, voir api/ligue1/matchs.ts) —
    // un statut non-JSON ici vient donc de la plateforme (timeout Vercel,
    // 502 HTML/texte...), pas de notre code. Le corps loggé permet de
    // trancher sans deviner.
    console.error("[getAvailableCompetitions] réponse non-JSON:", { status: response.status, body: text.slice(0, 300) });
    throw new Error(`L'API championnats a renvoyé une réponse invalide (${response.status}) : ${text.slice(0, 120) || "(corps vide)"}`);
  }

  // Pour ALL, l'API accepte désormais les erreurs partielles : les championnats
  // disponibles restent utilisables même si une ligue est temporairement indisponible.
  if (!response.ok || !body?.ok) {
    throw new Error(body?.message || `Erreur API championnats (${response.status}).`);
  }

  const returnedCodes = new Set<string>(
    Object.keys(body?.competitions ?? {}).map((code) => code.toUpperCase()),
  );

  return Object.entries(BONUS_COMPETITIONS).map(([code, info]) => ({
    code,
    name: info.name,
    country: info.country,
    available: returnedCodes.has(code),
  }));
}

export async function setCompetitionActive(
  discovered: DiscoveredCompetition,
  existingId: string | null,
  active: boolean,
): Promise<void> {
  // On conserve les colonnes historiques `code`/`name` si elles existent.
  // Si le schéma possède external_code/is_active, elles sont également écrites.
  if (existingId) {
    const { error } = await supabase
      .from("competitions")
      .update({
        name: discovered.name,
        code: discovered.code,
        external_code: discovered.code,
        is_active: active,
      })
      .eq("id", existingId);
    if (!error) return;

    // Compatibilité avec un ancien schéma sans external_code/is_active.
    const fallback = await supabase
      .from("competitions")
      .update({ name: discovered.name, code: discovered.code })
      .eq("id", existingId);
    if (fallback.error) throw error;
    return;
  }

  const { error } = await supabase.from("competitions").insert({
    name: discovered.name,
    code: discovered.code,
    external_code: discovered.code,
    is_active: active,
  });
  if (!error) return;

  const fallback = await supabase.from("competitions").insert({
    name: discovered.name,
    code: discovered.code,
  });
  if (fallback.error) throw error;
}

export async function syncCompetitionMatches(code: string): Promise<SyncSummary> {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (!BONUS_COMPETITIONS[normalizedCode]) {
    throw new Error(`Championnat bonus inconnu : ${normalizedCode}`);
  }

  const response = await fetch(`/api/ligue1/matchs?season=2026&competition=${encodeURIComponent(normalizedCode)}`, {
    headers: { Accept: "application/json" },
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    throw new Error(`L'API ${normalizedCode} a renvoyé une réponse invalide (${response.status}).`);
  }
  if (!response.ok || !body?.ok) {
    throw new Error(body?.message || `Erreur API ${normalizedCode} (${response.status}).`);
  }

  const apiMatches = Array.isArray(body?.matchs) ? body.matchs : [];
  const summary: SyncSummary = { created: 0, updated: 0, skipped: 0, matchdaysCreated: 0, warnings: [], errors: [] };
  if (!apiMatches.length) return summary;

  const [teams, seasons, competitions, existingMatchdays, existingMatches] = await Promise.all([
    getTeams(), getSeasons(), getCompetitions(), getMatchdays(), getMatches(),
  ]);
  const season = seasons.find((s) => s.code === "2026-2027" || s.name === "2026-2027") || seasons[0];
  if (!season) throw new Error("La saison 2026-2027 est introuvable dans Supabase.");

  const competition = competitions.find((c) =>
    String(c.code ?? c.external_code ?? "").toUpperCase() === normalizedCode ||
    normalize(c.name) === normalize(BONUS_COMPETITIONS[normalizedCode].name),
  );
  if (!competition) {
    throw new Error(`La compétition ${BONUS_COMPETITIONS[normalizedCode].name} (${normalizedCode}) est absente de Supabase.`);
  }

  const matchdaysByNumber = new Map<number, Matchday>();
  existingMatchdays
    .filter((m) => m.season_id === season.id && m.competition_id === competition.id)
    .forEach((m) => matchdaysByNumber.set(Number(m.number), m));

  const matchesByFixture = new Map<number, Match>();
  existingMatches.filter((m) => m.api_fixture_id != null).forEach((m) => matchesByFixture.set(Number(m.api_fixture_id), m));

  for (const apiMatch of apiMatches) {
    try {
      const number = Number(apiMatch.journee);
      const fixtureId = Number(apiMatch.apiFixtureId ?? String(apiMatch.id ?? "").replace(/^fd-/, ""));
      if (!Number.isFinite(number) || number < 1 || !Number.isFinite(fixtureId)) {
        summary.skipped++;
        summary.warnings.push(`Match bonus ignoré : ${apiMatch.domicile ?? "?"} - ${apiMatch.exterieur ?? "?"}.`);
        continue;
      }

      const home = teams.find((t) => teamMatches(t, apiMatch.domicile));
      const away = teams.find((t) => teamMatches(t, apiMatch.exterieur));
      const existing = matchesByFixture.get(fixtureId);

      // Les anciennes données bonus peuvent déjà exister sans que les équipes
      // étrangères soient dans `teams`. Dans ce cas on met à jour l'existant,
      // mais on ne fabrique jamais de faux team_id.
      if (!existing && (!home || !away)) {
        summary.skipped++;
        summary.warnings.push(`Équipe bonus introuvable : ${apiMatch.domicile} - ${apiMatch.exterieur}.`);
        continue;
      }

      let matchday = matchdaysByNumber.get(number);
      if (!matchday) {
        const { data, error } = await supabase.from("matchdays").insert({
          code: `J${number}`,
          label: `Journée ${number}`,
          number,
          season_id: season.id,
          competition_id: competition.id,
          season: season.name,
          is_open: false,
          is_finished: false,
          deadline: null,
          // Meme regle que ci-dessus : jamais de journee creee sans verrou.
          deadline_mode: "auto_minus_1",
        }).select("*").single();
        if (error) throw error;
        matchday = data as Matchday;
        matchdaysByNumber.set(number, matchday);
        summary.matchdaysCreated++;
      }

      const kickoff = apiMatch.date && apiMatch.heure ? `${apiMatch.date}T${apiMatch.heure}:00Z` : null;
      const payload: any = {
        matchday_id: matchday.id,
        matchday_code: `J${number}`,
        matchday: `J${number}`,
        match_day: number,
        api_fixture_id: fixtureId,
        kickoff,
        kickoff_time: kickoff,
        status: String(apiMatch.statut || "SCHEDULED").toLowerCase(),
        finished: String(apiMatch.statut || "").toUpperCase() === "FINISHED",
        home_score: apiMatch.scoreDomicile ?? null,
        away_score: apiMatch.scoreExterieur ?? null,
        match_type: normalizedCode,
        is_bonus: true,
        home_team: apiMatch.domicile,
        away_team: apiMatch.exterieur,
      };
      if (home) payload.home_team_id = home.id;
      if (away) payload.away_team_id = away.id;

      if (existing) {
        const { error } = await supabase.from("matches").update(payload).eq("id", existing.id);
        if (error) throw error;
        summary.updated++;
      } else {
        const { data, error } = await supabase.from("matches").insert(payload).select("*").single();
        if (error) throw error;
        if (data?.api_fixture_id != null) matchesByFixture.set(fixtureId, data as Match);
        summary.created++;
      }
    } catch (error: any) {
      summary.errors.push(`${apiMatch.domicile ?? "?"} - ${apiMatch.exterieur ?? "?"} : ${error?.message || error}`);
    }
  }

  return summary;
}

// ============================================================
// 9. VERROUILLAGE DES JOURNÉES
// ============================================================
export async function setMatchdayDeadline(id: string, deadline: string | null): Promise<void> {
  const { error } = await supabase.from("matchdays").update({ deadline, deadline_mode: "manual" }).eq("id", id);
  if (error) throw error;
}

export async function setMatchdayAutoMinusOne(id: string): Promise<void> {
  const { data: md, error } = await supabase.from("matchdays").select("id, competition_id, season_id, number").eq("id", id).single();
  if (error) throw error;
  const { data: matches, error: matchError } = await supabase.from("matches").select("kickoff").eq("matchday_id", id).not("kickoff", "is", null).order("kickoff", { ascending: true }).limit(1);
  if (matchError) throw matchError;
  const kickoff = matches?.[0]?.kickoff;
  const deadline = kickoff ? new Date(new Date(kickoff).getTime() - 60_000).toISOString() : null;
  const { error: updateError } = await supabase.from("matchdays").update({ deadline, deadline_mode: "auto_minus_1" }).eq("id", md.id);
  if (updateError) throw updateError;
}

export async function clearMatchdayDeadline(id: string): Promise<void> {
  const { error } = await supabase.from("matchdays").update({ deadline: null, deadline_mode: "manual" }).eq("id", id);
  if (error) throw error;
}
