import type { VercelRequest, VercelResponse } from "@vercel/node";

type CompetitionCode = "FL1" | "PL" | "PD" | "SA" | "BL1";

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  homeTeam?: { name?: string | null };
  awayTeam?: { name?: string | null };
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

const COMPETITIONS: Record<CompetitionCode, string> = {
  FL1: "Ligue 1",
  PL: "Premier League",
  PD: "Liga",
  SA: "Serie A",
  BL1: "Bundesliga",
};

function send(res: VercelResponse, status: number, body: unknown) {
  return res
    .status(status)
    .setHeader("Cache-Control", "no-store")
    .json(body);
}

function normalizeCompetition(value: unknown): CompetitionCode | "ALL" {
  const v = String(value ?? "ALL").trim().toUpperCase();
  if (v === "FL1" || v === "PL" || v === "PD" || v === "SA" || v === "BL1") {
    return v;
  }
  return "ALL";
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchCompetition(
  code: CompetitionCode,
  season: string,
  token: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams({ season });

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    params.set("dateFrom", dateFrom);
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    params.set("dateTo", dateTo);
  }

  const url =
    `https://api.football-data.org/v4/competitions/${code}/matches?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const error: any = new Error(
      `football-data.org a renvoyé une réponse non JSON pour ${code} (${response.status}).`,
    );
    error.upstreamStatus = response.status;
    error.upstream = text?.slice(0, 500);
    throw error;
  }

  if (!response.ok) {
    const error: any = new Error(
      data?.message ||
        data?.error ||
        `football-data.org a renvoyé HTTP ${response.status} pour ${code}.`,
    );
    error.upstreamStatus = response.status;
    error.upstream = data;
    throw error;
  }

  const sourceMatches: FootballDataMatch[] = Array.isArray(data?.matches)
    ? data.matches
    : [];

  return sourceMatches
    .filter((m) => m?.id != null && m?.utcDate)
    .map((m) => {
      const utc = validDate(m.utcDate);

      return {
        id: `fd-${m.id}`,
        apiFixtureId: Number(m.id),
        competitionCode: code,
        competition: COMPETITIONS[code],
        journee: Number(m.matchday ?? 0),
        domicile: m.homeTeam?.name ?? "",
        exterieur: m.awayTeam?.name ?? "",
        date: utc ? utc.slice(0, 10) : "",
        heure: utc ? utc.slice(11, 16) : "",
        kickoff: utc,
        statut: m.status ?? "SCHEDULED",
        scoreDomicile: m.score?.fullTime?.home ?? null,
        scoreExterieur: m.score?.fullTime?.away ?? null,
      };
    })
    .filter((m) => m.domicile && m.exterieur && m.kickoff);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, {
      ok: false,
      message: "Méthode non autorisée. Utilise GET.",
    });
  }

  const token =
    process.env.FOOTBALL_DATA_API_TOKEN ||
    process.env.FOOTBALL_DATA_TOKEN ||
    process.env.FOOTBALL_DATA_KEY;

  if (!token) {
    return send(res, 500, {
      ok: false,
      message:
        "Token football-data.org absent. Vérifie FOOTBALL_DATA_API_TOKEN dans Vercel.",
    });
  }

  const season =
    typeof req.query.season === "string" && /^\d{4}$/.test(req.query.season)
      ? req.query.season
      : "2026";

  const requested = normalizeCompetition(req.query.competition);

  const dateFrom =
    typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;

  const dateTo =
    typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

  // Pour ALL, les appels sont faits séparément et les erreurs sont tolérées.
  // Ainsi un championnat indisponible ne bloque pas les autres.
  const codes: CompetitionCode[] =
    requested === "ALL"
      ? ["FL1", "PL", "PD", "SA", "BL1"]
      : [requested];

  const competitions: Record<string, any[]> = {};
  const errors: Array<{
    code: string;
    name: string;
    status?: number;
    message: string;
  }> = [];

  // Séquentiel volontaire : évite de déclencher plusieurs appels
  // football-data.org simultanément.
  for (const code of codes) {
    try {
      competitions[code] = await fetchCompetition(
        code,
        season,
        token,
        dateFrom,
        dateTo,
      );
    } catch (error: any) {
      errors.push({
        code,
        name: COMPETITIONS[code],
        status: error?.upstreamStatus,
        message: error?.message || "Erreur inconnue",
      });

      competitions[code] = [];
    }
  }

  const allMatches = Object.values(competitions).flat();

  // Une compétition demandée seule doit quand même signaler son échec.
  if (requested !== "ALL" && errors.length > 0) {
    return send(res, 502, {
      ok: false,
      success: false,
      message: errors[0].message,
      competition: requested,
      season,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      errors,
    });
  }

  const matchs =
    requested === "ALL" ? competitions.FL1 ?? [] : competitions[requested] ?? [];

  return send(res, 200, {
    ok: true,
    success: true,
    competition: requested,
    season,
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,

    // Ancien format conservé pour la Ligue 1.
    count: matchs.length,
    matchs,
    matches: matchs,
    data: matchs,

    // Nouveau format multi-championnats.
    competitions,
    allMatches,
    allCount: allMatches.length,
    competitionCodes: codes,

    // Une erreur partielle ne fait plus échouer ALL.
    partialErrors: errors,
  });
}