// ============================================================
// Edge Function : sync-ligue1-matches
//
// Récupère les matchs de Ligue 1 (compétition "FL1") depuis
// football-data.org et les upsert dans la table `matches`.
//
// - La clé API football-data.org (FOOTBALL_DATA_API_TOKEN) reste un
//   secret côté serveur : jamais envoyée au navigateur.
// - Réservé aux admins : vérifie profiles.is_admin pour l'utilisateur
//   qui appelle la fonction (le JWT est transmis automatiquement par
//   supabase.functions.invoke côté client).
// - Les équipes football-data.org ne correspondent pas aux uuid de la
//   table `teams` : la correspondance passe par `team_api_mapping`
//   (clé de recherche : external_id numérique). Une équipe sans
//   correspondance ne fait pas planter la synchro : le match est
//   simplement ignoré et un avertissement est renvoyé.
// - Les journées (`matchdays`) sont retrouvées par (numéro + saison
//   active + compétition FL1), ou créées si elles n'existent pas encore.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FOOTBALL_DATA_URL = "https://api.football-data.org/v4/competitions/FL1/matches";
const EXTERNAL_COMPETITION_CODE = "FL1";
const UPSERT_CHUNK_SIZE = 100;
const FETCH_TIMEOUT_MS = 20_000;

type FootballDataTeam = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score?: {
    fullTime?: { home: number | null; away: number | null } | null;
  } | null;
};

type SyncSuccess = {
  ok: true;
  created: number;
  updated: number;
  skipped: number;
  matchdaysCreated: number;
  warnings: string[];
  errors: string[];
};

type SyncFailure = { ok: false; error: string };

function json(body: SyncSuccess | SyncFailure, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Préflight CORS — doit être traité avant toute autre logique.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    return await handleSync(req);
  } catch (error) {
    console.error("sync-ligue1-matches: erreur non gérée", error);
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Erreur inattendue." },
      500,
    );
  }
});

async function handleSync(req: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");

  // Ces 3 variables sont auto-injectées par le runtime Supabase — si elles
  // manquent, c'est un problème d'environnement, pas de configuration admin.
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "Configuration Supabase manquante côté fonction." }, 500);
  }

  // --- 1. Vérification admin (ne jamais faire confiance au client) ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ ok: false, error: "Authentification requise." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return json({ ok: false, error: "Session invalide ou expirée." }, 401);
  }

  // Toutes les lectures/écritures suivantes passent par la clé service_role
  // (contourne la RLS) : on vient de vérifier que l'appelant est admin.
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return json(
      { ok: false, error: `Impossible de vérifier les droits admin : ${profileError.message}` },
      500,
    );
  }
  if (!profile?.is_admin) {
    return json({ ok: false, error: "Réservé aux administrateurs." }, 403);
  }

  // --- 2. Appel football-data.org ---
  if (!apiToken) {
    return json(
      {
        ok: false,
        error: "Le secret FOOTBALL_DATA_API_TOKEN n'est pas configuré sur ce projet Supabase.",
      },
      500,
    );
  }

  let apiMatches: FootballDataMatch[];
  try {
    apiMatches = await fetchLigue1Matches(apiToken);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Échec de l'appel à football-data.org.",
      },
      500,
    );
  }

  // --- 3. Résolution compétition + saison ---
  const { data: competition, error: competitionError } = await db
    .from("competitions")
    .select("id")
    .eq("external_code", EXTERNAL_COMPETITION_CODE)
    .maybeSingle();

  if (competitionError) {
    return json(
      { ok: false, error: `Erreur lors de la résolution de la compétition : ${competitionError.message}` },
      500,
    );
  }
  if (!competition) {
    return json(
      {
        ok: false,
        error:
          "Aucune ligne `competitions` avec external_code = 'FL1'. Configure-la d'abord, par exemple : " +
          "update competitions set external_code = 'FL1' where id = '<id de ta ligne Ligue 1>';",
      },
      500,
    );
  }

  const { data: seasons, error: seasonError } = await db
    .from("seasons")
    .select("id")
    .eq("is_active", true);

  if (seasonError) {
    return json(
      { ok: false, error: `Erreur lors de la résolution de la saison : ${seasonError.message}` },
      500,
    );
  }
  if (!seasons || seasons.length === 0) {
    return json(
      { ok: false, error: "Aucune saison active trouvée (seasons.is_active = true)." },
      500,
    );
  }
  if (seasons.length > 1) {
    return json(
      {
        ok: false,
        error: "Plusieurs saisons actives trouvées : une seule ligne `seasons` doit avoir is_active = true.",
      },
      500,
    );
  }

  const competitionId = competition.id as string;
  const seasonId = seasons[0].id as string;

  // --- 4. Résolution / création des journées, en une seule passe groupée ---
  const matchdayNumbers = Array.from(
    new Set(
      apiMatches
        .map((m) => m.matchday)
        .filter((n): n is number => typeof n === "number"),
    ),
  );

  const matchdayIdByNumber = new Map<number, string>();
  let matchdaysCreated = 0;

  if (matchdayNumbers.length > 0) {
    const { data: existingMatchdays, error: matchdaysError } = await db
      .from("matchdays")
      .select("id, number")
      .eq("competition_id", competitionId)
      .eq("season_id", seasonId)
      .in("number", matchdayNumbers);

    if (matchdaysError) {
      return json(
        { ok: false, error: `Erreur lors de la lecture des journées : ${matchdaysError.message}` },
        500,
      );
    }

    (existingMatchdays ?? []).forEach((md: { id: string; number: number }) => {
      matchdayIdByNumber.set(md.number, md.id);
    });

    const missingNumbers = matchdayNumbers.filter((n) => !matchdayIdByNumber.has(n));

    if (missingNumbers.length > 0) {
      const { data: createdMatchdays, error: createMatchdaysError } = await db
        .from("matchdays")
        .insert(
          missingNumbers.map((number) => ({
            season_id: seasonId,
            competition_id: competitionId,
            number,
            is_finished: false,
            deadline: null,
          })),
        )
        .select("id, number");

      if (createMatchdaysError) {
        return json(
          { ok: false, error: `Erreur lors de la création des journées : ${createMatchdaysError.message}` },
          500,
        );
      }

      (createdMatchdays ?? []).forEach((md: { id: string; number: number }) => {
        matchdayIdByNumber.set(md.number, md.id);
      });
      matchdaysCreated = missingNumbers.length;
    }
  }

  // --- 5. Résolution des équipes via team_api_mapping ---
  const { data: mappingRows, error: mappingError } = await db
    .from("team_api_mapping")
    .select("external_id, team_id");

  if (mappingError) {
    return json(
      { ok: false, error: `Erreur lors de la lecture de team_api_mapping : ${mappingError.message}` },
      500,
    );
  }

  const teamIdByExternalId = new Map<number, string>();
  (mappingRows ?? []).forEach((row: { external_id: number; team_id: string }) => {
    teamIdByExternalId.set(row.external_id, row.team_id);
  });

  type ResolvedRow = {
    external_id: number;
    matchday_id: string | null;
    home_team_id: string;
    away_team_id: string;
    kickoff: string;
    home_score: number | null;
    away_score: number | null;
    finished: boolean;
  };

  const warnings: string[] = [];
  let skipped = 0;
  const resolvedRows: ResolvedRow[] = [];

  for (const match of apiMatches) {
    const homeTeamId = teamIdByExternalId.get(match.homeTeam.id);
    const awayTeamId = teamIdByExternalId.get(match.awayTeam.id);

    const missingTeams: string[] = [];
    if (!homeTeamId) missingTeams.push(`domicile "${match.homeTeam.name}" (id ${match.homeTeam.id})`);
    if (!awayTeamId) missingTeams.push(`extérieur "${match.awayTeam.name}" (id ${match.awayTeam.id})`);

    // Une équipe non mappée ne doit jamais faire planter toute la synchro :
    // on log un avertissement et on passe au match suivant.
    if (missingTeams.length > 0) {
      const warning = `Match #${match.id} ignoré : équipe(s) non mappée(s) — ${missingTeams.join(", ")}.`;
      console.warn(warning);
      warnings.push(warning);
      skipped += 1;
      continue;
    }

    resolvedRows.push({
      external_id: match.id,
      matchday_id:
        typeof match.matchday === "number" ? matchdayIdByNumber.get(match.matchday) ?? null : null,
      home_team_id: homeTeamId as string,
      away_team_id: awayTeamId as string,
      kickoff: match.utcDate,
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
      finished: match.status === "FINISHED",
    });
  }

  // --- 6. Upsert par lots, en distinguant créations et mises à jour ---
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  if (resolvedRows.length > 0) {
    const allExternalIds = resolvedRows.map((r) => r.external_id);

    // Un upsert seul ne dit pas combien de lignes existaient déjà : on
    // interroge d'abord pour pouvoir annoncer un vrai compte créés/mis à jour.
    const { data: alreadyExisting, error: existingError } = await db
      .from("matches")
      .select("external_id")
      .in("external_id", allExternalIds);

    if (existingError) {
      errors.push(`Impossible de distinguer créations/mises à jour : ${existingError.message}`);
    }

    const existingIds = new Set(
      (alreadyExisting ?? []).map((row: { external_id: number }) => row.external_id),
    );

    for (let i = 0; i < resolvedRows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = resolvedRows.slice(i, i + UPSERT_CHUNK_SIZE);
      const { error: upsertError } = await db
        .from("matches")
        .upsert(chunk, { onConflict: "external_id" });

      if (upsertError) {
        errors.push(`Échec de l'enregistrement d'un lot de ${chunk.length} match(s) : ${upsertError.message}`);
        continue;
      }

      chunk.forEach((row) => {
        if (existingIds.has(row.external_id)) updated += 1;
        else created += 1;
      });
    }
  }

  return json(
    { ok: true, created, updated, skipped, matchdaysCreated, warnings, errors },
    200,
  );
}

async function fetchLigue1Matches(apiToken: string): Promise<FootballDataMatch[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(FOOTBALL_DATA_URL, {
      headers: { "X-Auth-Token": apiToken },
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new Error("football-data.org a limité les requêtes (429). Réessaie dans une minute.");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`football-data.org a répondu ${response.status} : ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { matches?: FootballDataMatch[] };
    return payload.matches ?? [];
  } finally {
    clearTimeout(timeout);
  }
}
