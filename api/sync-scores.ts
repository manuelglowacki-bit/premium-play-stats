import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// SYNCHRONISATION AUTOMATIQUE DES SCORES
//
// Appelée toutes les 30 minutes par une tâche programmée Supabase (voir
// supabase/activer-cron-sync-scores.sql), elle écrit en base le score des
// matchs terminés depuis le dernier passage.
//
// Ce qu'elle fait, volontairement, et RIEN D'AUTRE :
//   - met à jour home_score, away_score et finished
//   - uniquement sur des matchs DÉJÀ PRÉSENTS en base, retrouvés par leur
//     identifiant football-data (api_fixture_id)
//
// Ce qu'elle ne fait pas : créer un match, créer une journée, toucher aux
// équipes, aux pronostics ou aux points. Une tâche automatique qui tourne
// sans surveillance doit avoir le périmètre le plus étroit possible.
//
// Le direct, lui, ne dépend pas de cette route : les pages lisent déjà
// football-data.org à chaque affichage (voir src/lib/liveMatches.ts). Ceci
// ne sert qu'à FIXER le résultat définitif, pour qu'un match ne reste pas
// à "?-?" si personne n'ouvre le site.

type MatchApi = {
  apiFixtureId: number;
  statut: string;
  scoreDomicile: number | null;
  scoreExterieur: number | null;
};

function reponse(res: VercelResponse, statut: number, corps: Record<string, unknown>) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(statut).json(corps);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protégée par un secret : sans lui, n'importe qui pourrait déclencher des
  // écritures en base en boucle, et faire dépasser le quota football-data.
  const secretAttendu = (process.env.CRON_SECRET ?? "").trim();
  if (!secretAttendu) {
    return reponse(res, 503, { erreur: "CRON_SECRET absent" });
  }

  const fourni =
    String(req.headers["x-cron-secret"] ?? "").trim() ||
    String((req.query?.secret as string) ?? "").trim();

  if (fourni !== secretAttendu) {
    return reponse(res, 403, { erreur: "secret invalide" });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return reponse(res, 503, { erreur: "Supabase non configure" });
  }

  try {
    // 1) Les matchs Ligue 1 vus par football-data, via le proxy existant
    //    (le jeton reste côté serveur, on ne le manipule pas ici).
    const base = `https://${req.headers.host}`;
    const reponseApi = await fetch(`${base}/api/ligue1/matchs`);
    if (!reponseApi.ok) {
      return reponse(res, 502, { erreur: "football-data indisponible" });
    }

    const corps = await reponseApi.json();
    const matchsApi: MatchApi[] = Array.isArray(corps?.matchs) ? corps.matchs : corps;

    const termines = (matchsApi ?? []).filter(
      (m) =>
        m &&
        String(m.statut ?? "").toUpperCase() === "FINISHED" &&
        m.scoreDomicile != null &&
        m.scoreExterieur != null &&
        m.apiFixtureId != null,
    );

    if (termines.length === 0) {
      return reponse(res, 200, { misAJour: 0, message: "aucun match termine a enregistrer" });
    }

    // 2) Les matchs correspondants en base, qui n'ont pas encore leur score.
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: enBase, error } = await admin
      .from("matches")
      .select("id, api_fixture_id, home_score, away_score, finished")
      .in(
        "api_fixture_id",
        termines.map((m) => m.apiFixtureId),
      );

    if (error) {
      return reponse(res, 500, { erreur: error.message });
    }

    const parFixture = new Map(
      (enBase ?? [])
        .filter((m) => m.api_fixture_id != null)
        .map((m) => [Number(m.api_fixture_id), m]),
    );

    // 3) On n'écrit QUE si quelque chose change réellement : pas d'écriture
    //    inutile toutes les 30 minutes sur 306 matchs.
    let misAJour = 0;

    for (const match of termines) {
      const cible = parFixture.get(Number(match.apiFixtureId));
      if (!cible) continue;

      const dejaBon =
        cible.home_score === match.scoreDomicile &&
        cible.away_score === match.scoreExterieur &&
        cible.finished === true;

      if (dejaBon) continue;

      const { error: erreurEcriture } = await admin
        .from("matches")
        .update({
          home_score: match.scoreDomicile,
          away_score: match.scoreExterieur,
          finished: true,
        })
        .eq("id", cible.id);

      if (!erreurEcriture) misAJour += 1;
    }

    return reponse(res, 200, { misAJour, examines: termines.length });
  } catch (e: any) {
    return reponse(res, 500, { erreur: e?.message ?? "erreur inconnue" });
  }
}
