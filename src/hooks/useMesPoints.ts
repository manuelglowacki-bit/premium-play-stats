import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeLeagueStats } from "@/lib/leaderboardStats";
import { fetchLiveApiMatches, reconcileMatchesWithLive, markLiveMatchesScorable } from "@/lib/liveMatches";

/**
 * LES POINTS D'UN JOUEUR, calcules par le MEME moteur que le classement.
 *
 * Pourquoi ne pas additionner soi-meme les points de la journee affichee :
 * parce que deux additions ecrites a deux endroits finissent toujours par se
 * contredire — et le jour ou elles divergent, personne ne sait laquelle croire.
 * Ici, le total affiche sous les pronostics et celui du classement sortent du
 * meme calcul, sur les memes donnees. S'ils sont faux, ils le sont ensemble,
 * et une seule correction les repare tous les deux.
 *
 * Le direct est pris en compte comme sur le classement : un match en cours
 * fait bouger le compteur, sans rien ecrire en base.
 */
export type MesPoints = {
  /** Total de la saison, toutes journees confondues. */
  saison: number;
  /** Points par journee de Ligue 1 : cle = matchday_id. */
  parJournee: Record<string, number>;
  chargement: boolean;
};

export function useMesPoints(userId: string | null | undefined): MesPoints {
  const [etat, setEtat] = useState<MesPoints>({ saison: 0, parJournee: {}, chargement: true });
  // Incremente a chaque sauvegarde de pronostic : sans cela le compteur
  // resterait fige sur la valeur d'ouverture de la page, et un joueur qui
  // vient de valider ne verrait rien bouger.
  const [rafraichir, setRafraichir] = useState(0);

  useEffect(() => {
    const relancer = () => setRafraichir((n) => n + 1);
    window.addEventListener("pronos-saved", relancer);
    window.addEventListener("pronos-updated", relancer);
    return () => {
      window.removeEventListener("pronos-saved", relancer);
      window.removeEventListener("pronos-updated", relancer);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setEtat({ saison: 0, parJournee: {}, chargement: false });
      return;
    }

    let annule = false;

    (async () => {
      try {
        const [{ data: profil }, { data: journees }] = await Promise.all([
          supabase.from("profiles").select("id, pseudo, favorite_team_id, favorite_team").eq("id", userId).maybeSingle(),
          supabase.from("matchdays").select("id, competition_id, season_id"),
        ]);

        const idsJournees = (journees ?? []).map((j: any) => String(j.id));
        if (!idsJournees.length) {
          if (!annule) setEtat({ saison: 0, parJournee: {}, chargement: false });
          return;
        }

        const [{ data: matchsL1 }, { data: options }, { data: pronostics }, { data: equipes }] = await Promise.all([
          supabase
            .from("matches")
            .select("id, matchday_id, home_team_id, away_team_id, home_team, away_team, home_score, away_score, finished, is_bonus, api_fixture_id, status, kickoff")
            .eq("is_bonus", false)
            .in("matchday_id", idsJournees),
          supabase.from("bonus_options").select("matchday_id, match_id, is_active, created_at").in("matchday_id", idsJournees),
          supabase.from("predictions").select("user_id, match_id, home_prediction, away_prediction, created_at").eq("user_id", userId),
          supabase.from("teams").select("id, name"),
        ]);

        const idsMatchsBonus = [...new Set((options ?? []).map((o: any) => String(o.match_id)).filter(Boolean))];
        let matchsBonus: any[] = [];
        if (idsMatchsBonus.length) {
          const { data } = await supabase
            .from("matches")
            .select("id, matchday_id, home_team_id, away_team_id, home_team, away_team, home_score, away_score, finished, is_bonus, api_fixture_id, status, kickoff")
            .in("id", idsMatchsBonus);
          matchsBonus = data ?? [];
        }

        // Direct : meme traitement que le classement, sinon le compteur des
        // pronostics et celui du classement diraient deux choses differentes
        // pendant un match.
        let l1 = (matchsL1 ?? []) as any[];
        let bonus = matchsBonus as any[];
        try {
          const live = await fetchLiveApiMatches();
          if (live?.length) {
            l1 = reconcileMatchesWithLive(l1, live) as any[];
            bonus = reconcileMatchesWithLive(bonus, live) as any[];
          }
        } catch {
          // Le direct est un confort, pas une dependance : sans lui on affiche
          // les scores enregistres en base.
        }

        const nomsEquipes: Record<string, string> = {};
        (equipes ?? []).forEach((e: any) => {
          if (e?.id) nomsEquipes[String(e.id)] = String(e.name ?? "");
        });

        const seasonByMatchdayId: Record<string, string> = {};
        (journees ?? []).forEach((j: any) => {
          if (j?.id) seasonByMatchdayId[String(j.id)] = String(j.season_id ?? "");
        });

        const stats = computeLeagueStats(
          markLiveMatchesScorable(l1) as any,
          markLiveMatchesScorable(bonus) as any,
          (options ?? []) as any,
          (pronostics ?? []) as any,
          [(profil ?? { id: userId, pseudo: null, favorite_team_id: null })] as any,
          nomsEquipes,
          { seasonByMatchdayId },
        );

        if (annule) return;
        setEtat({
          saison: stats.pointsByUser[userId] ?? 0,
          parJournee: stats.pointsByUserAndMatchday?.[userId] ?? {},
          chargement: false,
        });
      } catch (erreur) {
        console.error("Mes points :", erreur);
        if (!annule) setEtat((actuel) => ({ ...actuel, chargement: false }));
      }
    })();

    return () => {
      annule = true;
    };
  }, [userId, rafraichir]);

  return etat;
}
