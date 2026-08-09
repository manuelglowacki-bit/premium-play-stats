import type { VercelRequest, VercelResponse } from "@vercel/node";

// Liste des championnats réellement accessibles depuis notre compte
// football-data.org — remplace toute liste codée en dur côté front (voir
// onglet Bonus) : ce qui est proposé à l'activation dépend du plan de la
// clé API, pas d'une constante figée dans le code.

type FootballDataCompetition = {
  code?: string | null;
  name?: string | null;
  type?: string | null;
  emblem?: string | null;
  area?: { name?: string | null } | null;
};

type FootballDataCompetitionsResponse = {
  message?: string;
  error?: string;
  competitions?: FootballDataCompetition[];
};

function send(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, message: "Méthode non autorisée. Utilise GET." });
  }

  const token = process.env.FOOTBALL_DATA_API_TOKEN || process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return send(res, 500, {
      ok: false,
      message: "Variable Vercel FOOTBALL_DATA_API_TOKEN manquante.",
    });
  }

  try {
    const upstream = await fetch("https://api.football-data.org/v4/competitions", {
      headers: { "X-Auth-Token": token, Accept: "application/json" },
    });

    const text = await upstream.text();
    let data: FootballDataCompetitionsResponse | null = null;
    try {
      data = text ? (JSON.parse(text) as FootballDataCompetitionsResponse) : null;
    } catch {
      throw new Error(`football-data.org a renvoyé une réponse non JSON (${upstream.status}).`);
    }

    if (!upstream.ok) {
      const message = data?.message || data?.error || `football-data.org a renvoyé HTTP ${upstream.status}.`;
      return send(res, 502, { ok: false, message });
    }

    const source: FootballDataCompetition[] = Array.isArray(data?.competitions) ? data.competitions : [];

    // Uniquement les championnats domestiques (type LEAGUE) : les coupes et
    // tournois internationaux (Coupe du monde, Ligue des champions...) ne
    // se prêtent pas au format "1 affiche par journée" de la sélection bonus.
    const competitions = source
      .filter((c) => c.type === "LEAGUE" && c.code && c.name)
      .map((c) => ({
        code: String(c.code),
        name: String(c.name),
        area: c.area?.name ?? null,
        emblem: c.emblem ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return send(res, 200, { ok: true, count: competitions.length, competitions });
  } catch (error) {
    return send(res, 502, {
      ok: false,
      message: error instanceof Error ? error.message : "Impossible de contacter football-data.org depuis Vercel.",
    });
  }
}
