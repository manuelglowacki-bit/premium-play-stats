import type { VercelRequest, VercelResponse } from "@vercel/node";

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

// Noms connus, uniquement pour l'affichage (compétition legacy "matchs"
// historique) — la validité d'un code n'est PAS limitée à cette liste :
// l'onglet Bonus peut activer n'importe quel championnat renvoyé par
// /api/competitions (voir isCompetitionCode ci-dessous), pas seulement
// ces 5-là codés en dur.
const KNOWN_COMPETITION_NAMES: Record<string, string> = {
  FL1: "Ligue 1",
  PL: "Premier League",
  PD: "Liga",
  SA: "Serie A",
  BL1: "Bundesliga",
};

type CompetitionCode = string;

function send(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

// Codes football-data.org : 2 à 6 lettres/chiffres majuscules (FL1, PL,
// BL1, DED, PPL...). On ne fige pas la liste ici, /api/competitions fait
// déjà ce filtrage en amont (championnats réellement dispos sur le plan).
function isCompetitionCode(value: unknown): value is CompetitionCode {
  return typeof value === "string" && /^[A-Z0-9]{2,6}$/.test(value.toUpperCase());
}

function normalizeCompetition(value: unknown): CompetitionCode | "ALL" {
  if (typeof value !== "string") return "ALL";
  const normalized = value.toUpperCase();
  if (normalized === "ALL") return "ALL";
  return isCompetitionCode(normalized) ? normalized : "ALL";
}

async function fetchCompetition(
  code: CompetitionCode,
  season: string,
  token: string,
): Promise<any[]> {
  const url =
    `https://api.football-data.org/v4/competitions/${code}/matches` +
    `?season=${encodeURIComponent(season)}`;

  const upstream = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
      Accept: "application/json",
    },
  });

  const text = await upstream.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `football-data.org a renvoyé une réponse non JSON pour ${code} (${upstream.status}).`,
    );
  }

  if (!upstream.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `football-data.org a renvoyé HTTP ${upstream.status} pour ${code}.`,
    );
    (error as any).upstreamStatus = upstream.status;
    (error as any).upstream = data;
    throw error;
  }

  const sourceMatches: FootballDataMatch[] = Array.isArray(data?.matches)
    ? data.matches
    : [];

  return sourceMatches
    .filter((match) => match?.id != null)
    .map((match) => {
      const utc = new Date(match.utcDate);
      const validDate = !Number.isNaN(utc.getTime());

      return {
        id: `fd-${match.id}`,
        apiFixtureId: Number(match.id),
        competitionCode: code,
        competition: KNOWN_COMPETITION_NAMES[code] ?? code,
        journee: Number(match.matchday ?? 0),
        domicile: match.homeTeam?.name ?? "",
        exterieur: match.awayTeam?.name ?? "",
        date: validDate ? utc.toISOString().slice(0, 10) : "",
        heure: validDate ? utc.toISOString().slice(11, 16) : "",
        statut: match.status ?? "SCHEDULED",
        scoreDomicile: match.score?.fullTime?.home ?? null,
        scoreExterieur: match.score?.fullTime?.away ?? null,
      };
    })
    .filter(
      (match) =>
        match.domicile &&
        match.exterieur &&
        Number.isFinite(match.journee) &&
        match.journee > 0,
    );
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
    process.env.FOOTBALL_DATA_TOKEN;

  if (!token) {
    return send(res, 500, {
      ok: false,
      message:
        "Variable Vercel FOOTBALL_DATA_API_TOKEN manquante. Ajoute ton token football-data.org dans les variables d'environnement.",
      debugEnvKeys: Object.keys(process.env).filter((k) =>
        k.includes("FOOTBALL"),
      ),
      debugTotalKeys: Object.keys(process.env).length,
      debugAllKeys: Object.keys(process.env).sort(),
    });
  }

  const season =
    typeof req.query.season === "string" && /^\d{4}$/.test(req.query.season)
      ? req.query.season
      : "2026";

  // ?competition=PL
  // ?competition=PD
  // ?competition=SA
  // ?competition=BL1
  // ?competition=FL1
  // ?competition=ALL (ou aucun paramètre) => les 5 compétitions
  const requestedCompetition = normalizeCompetition(req.query.competition);

  const codes: CompetitionCode[] =
    requestedCompetition === "ALL"
      ? ["FL1", "PL", "PD", "SA", "BL1"]
      : [requestedCompetition];

  try {
    const results = await Promise.allSettled(
      codes.map((code) => fetchCompetition(code, season, token)),
    );

    const competitions: Record<string, any[]> = {};
    const errors: string[] = [];

    results.forEach((result, index) => {
      const code = codes[index];

      if (result.status === "fulfilled") {
        competitions[code] = result.value;
      } else {
        const error: any = result.reason;
        errors.push(
          `${code} (${KNOWN_COMPETITION_NAMES[code] ?? code}) : ${
            error?.message || "Erreur inconnue"
          }`,
        );
      }
    });

    // On conserve le format historique "matchs" pour FL1 afin de ne pas
    // casser les anciennes versions du frontend.
    const matchs =
      requestedCompetition === "ALL"
        ? competitions.FL1 ?? []
        : competitions[codes[0]] ?? [];

    const allMatches = Object.values(competitions).flat();

    // Si une seule compétition est demandée et qu'elle échoue, on retourne
    // l'erreur comme avant. Pour ALL, les autres compétitions restent utiles.
    if (
      requestedCompetition !== "ALL" &&
      !competitions[codes[0]]
    ) {
      return send(res, 502, {
        ok: false,
        message: errors[0] || "Impossible de récupérer la compétition.",
        competition: codes[0],
        season,
        errors,
      });
    }

    return send(res, 200, {
      ok: true,
      success: true,

      // Compatibilité ancienne API
      competition:
        requestedCompetition === "ALL"
          ? "ALL"
          : requestedCompetition,
      season,
      count: matchs.length,
      matchs,
      matches: matchs,
      data: matchs,

      // Nouveau format multi-championnats
      competitions,
      allMatches,
      allCount: allMatches.length,
      competitionCodes: codes,

      // Les erreurs partielles sont exposées à l'admin sans bloquer
      // les compétitions qui ont correctement répondu.
      partialErrors: errors,
    });
  } catch (error: any) {
    return send(res, 502, {
      ok: false,
      message:
        error?.message ||
        "Impossible de contacter football-data.org depuis Vercel.",
      upstreamStatus: error?.upstreamStatus,
      upstream: error?.upstream,
    });
  }
}