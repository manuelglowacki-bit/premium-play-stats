import type { VercelRequest, VercelResponse } from "@vercel/node";

// Proxy football-data.org /standings — même schéma que api/competitions.ts
// et api/ligue1/matchs.ts (token serveur uniquement, jamais exposé au
// front). Sert le classement en direct des 4 championnats bonus au moteur
// de sélection (src/services/standingsService.ts), pour que l'équilibre
// d'un match candidat soit jugé sur la position réelle des deux équipes au
// moment de la génération, pas sur une réputation figée.

// FL1 en plus des 4 championnats bonus : la Gazette s'en sert pour designer
// l'affiche d'une journee sur le classement REEL des deux equipes, au lieu
// d'une reputation figee.
type CompetitionCode = "PL" | "PD" | "SA" | "BL1" | "FL1";

const COMPETITIONS: Record<CompetitionCode, string> = {
  PL: "Premier League",
  PD: "Liga",
  SA: "Serie A",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
};

type FootballDataStandingsRow = {
  position: number;
  team?: { name?: string | null } | null;
  playedGames?: number | null;
  points?: number | null;
  goalDifference?: number | null;
  form?: string | null;
};

type FootballDataStandingsGroup = {
  stage?: string | null;
  type?: string | null;
  group?: string | null;
  table?: FootballDataStandingsRow[] | null;
};

type FootballDataStandingsResponse = {
  message?: string;
  error?: string;
  standings?: FootballDataStandingsGroup[] | null;
};

function send(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

function normalizeCompetition(value: unknown): CompetitionCode | null {
  const v = String(value ?? "").trim().toUpperCase();
  return v === "PL" || v === "PD" || v === "SA" || v === "BL1" || v === "FL1" ? v : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, message: "Méthode non autorisée. Utilise GET." });
  }

  const token =
    process.env.FOOTBALL_DATA_API_TOKEN ||
    process.env.FOOTBALL_DATA_TOKEN ||
    process.env.FOOTBALL_DATA_KEY;

  if (!token) {
    return send(res, 500, {
      ok: false,
      message: "Token football-data.org absent. Vérifie FOOTBALL_DATA_API_TOKEN dans Vercel.",
    });
  }

  const code = normalizeCompetition(req.query.competition);
  if (!code) {
    return send(res, 400, { ok: false, message: "Paramètre 'competition' invalide (attendu : PL, PD, SA, BL1 ou FL1)." });
  }

  const season =
    typeof req.query.season === "string" && /^\d{4}$/.test(req.query.season)
      ? req.query.season
      : "2026";

  try {
    const upstream = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/standings?season=${encodeURIComponent(season)}`,
      { headers: { "X-Auth-Token": token, Accept: "application/json" } },
    );

    const text = await upstream.text();
    let data: FootballDataStandingsResponse | null = null;
    try {
      data = text ? (JSON.parse(text) as FootballDataStandingsResponse) : null;
    } catch {
      throw new Error(`football-data.org a renvoyé une réponse non JSON pour ${code} (${upstream.status}).`);
    }

    if (!upstream.ok) {
      const message = data?.message || data?.error || `football-data.org a renvoyé HTTP ${upstream.status} pour ${code}.`;
      return send(res, 502, { ok: false, message, competition: code, season });
    }

    const groups = Array.isArray(data?.standings) ? data.standings : [];
    // "TOTAL" = classement général (pas domicile/extérieur séparé). Les
    // championnats servis ici sont des poules uniques (pas de groupes), donc
    // il n'y a normalement qu'une seule entrée pertinente.
    const totalGroup = groups.find((g) => g.type === "TOTAL") ?? groups[0] ?? null;
    const rows = Array.isArray(totalGroup?.table) ? totalGroup!.table! : [];

    const table = rows
      .filter((r) => r?.team?.name)
      .map((r) => ({
        position: Number(r.position ?? 0),
        team: { name: String(r.team!.name) },
        playedGames: r.playedGames ?? 0,
        points: r.points ?? 0,
        goalDifference: r.goalDifference ?? 0,
        form: r.form ?? null,
      }));

    return send(res, 200, { ok: true, competition: code, name: COMPETITIONS[code], season, count: table.length, table });
  } catch (error) {
    return send(res, 502, {
      ok: false,
      message: error instanceof Error ? error.message : `Impossible de contacter football-data.org pour ${code}.`,
      competition: code,
      season,
    });
  }
}
