import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  User,
  Shield,
  Check,
  Trophy,
  Target,
  Camera,
  Trash2,
  Lock,
  Loader2,
  Star,
  Activity,
  Sparkles,
  Award,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import PushNotificationsButton from "@/components/PushNotificationsButton";
import { supabase } from "@/lib/supabase";
import { resizeImageToDataUrl } from "@/lib/resizeImage";
import { useAuth } from "@/context/AuthContext";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { getTeamWallpaperUrl, getTeamWallpaperSlug } from "@/lib/team-wallpapers";
import {
  calculateCareerScore,
  aggregateCareerStatsByUser,
  getCareerProgressPercent,
  getCareerTitle,
  type CareerResult,
} from "@/lib/careerLevel";
import { rankPlayers } from "@/lib/leaderboardRanking";
import { computeLeagueStats } from "@/lib/leaderboardStats";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import {
  fetchLiveApiMatches,
  reconcileMatchesWithLive,
  markLiveMatchesScorable,
  LIVE_SCORE_CACHE_PREFIX,
} from "@/lib/liveMatches";

export const Route = createFileRoute("/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Contexte auth partagé
  const { refreshProfile } = useAuth();

  // Profil classique
  const [username, setUsername] = useState("Red evils");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Équipe de cœur
  const { favoriteTeamId, saveFavoriteTeam } = useFavoriteTeam();
  const [teams, setTeams] = useState<any[]>([]);
  // Saison affichee : elle etait ecrite en dur ("Saison 2026-2027") a trois
  // endroits de la page et n'aurait jamais change.
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  const [tempSelectedTeam, setTempSelectedTeam] = useState("");
  const [isEditingTeam, setIsEditingTeam] = useState(false);

  const favoriteTeamName = teams.find((t) => t.id === favoriteTeamId)?.name || "";

  const [deadlineStr, setDeadlineStr] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [autoLock, setAutoLock] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [savingTeam, setSavingTeam] = useState(false);

  // Statistiques personnelles — alimentées par Supabase.
  const [userStats, setUserStats] = useState({
    rank: 0,
    totalPlayers: 0,
    points: 0,
    exactScores: 0,
    successRate: "0%",
    totalPronos: 0,
    bestDay: "-",
  });

  // Niveau de carrière — même système que l'Accueil (src/lib/careerLevel.ts,
  // partagé, jamais dupliqué) : points + scores exacts cumulés sur TOUTES
  // les saisons (jamais réinitialisé). null tant que non chargé.
  const [career, setCareer] = useState<CareerResult | null>(null);
  const [careerPredictionsCount, setCareerPredictionsCount] = useState(0);
  const statsRequestSeq = useRef(0);
  const [liveTick, setLiveTick] = useState(() => Date.now());
   // Le Profil privilégie le snapshot publié par le Classement pour les
  // points/exacts/régularité, avec recalcul local uniquement en repli.
  const readClassementSnapshot = () => {
    try {
      const raw = window.localStorage.getItem("prono_ligue1_classement_snapshot");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const readLivePronosCache = () => {
    const scores: Record<string, any> = {};
    try {
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (!key || !key.startsWith(LIVE_SCORE_CACHE_PREFIX)) continue;
        const raw = window.sessionStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        scores[key.slice(LIVE_SCORE_CACHE_PREFIX.length)] = parsed;
      }
    } catch {
      // Le Profil continue avec le snapshot Classement/Supabase.
    }
    return scores;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const requestId = ++statsRequestSeq.current;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          if (!cancelled) setUser(null);
          return;
        }

        if (cancelled || requestId !== statsRequestSeq.current) return;
        setUser(session.user);

        const [
          { data: profile, error: profileError },
          { data: teamsData, error: teamsError },
          { data: settingsData, error: settingsError },
          { data: allPredictionsData, error: predictionsError },
          { data: matchesData, error: matchesError },
          { data: matchdaysData, error: matchdaysError },
          { data: allProfilesData, error: allProfilesError },
          apiLiveMatches,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle(),

          supabase
            .from("teams")
            .select("id,name,short_name,logo_url")
            .order("name"),

          supabase
            .from("app_settings")
            .select("season, favorite_team_deadline, favorite_team_auto_lock")
            .eq("id", 1)
            .maybeSingle(),

          // `points` n'est plus utilisé pour le calcul (voir plus bas) :
          // cette colonne n'est jamais mise à jour par l'application
          // (column_default 0, aucun trigger, vérifié en base) — les
          // points sont recalculés depuis les résultats réels via
          // computeLeagueStats, la même fonction que le Classement.
          // Paginé : sans .range(), PostgREST tronque silencieusement à 1000
          // lignes (voir src/lib/supabaseFetchAll.ts).
          fetchAllRows(
            "predictions",
            "user_id,match_id,home_prediction,away_prediction,created_at",
            ["user_id", "match_id"],
          ),

          // Paginé pour la même raison (5 championnats = plus de 1000 matchs).
          fetchAllRows(
            "matches",
            "id,matchday,matchday_id,status,kickoff,api_fixture_id,home_score,away_score,home_team_id,away_team_id,home_team,away_team,is_bonus,finished",
            ["id"],
          ),

          // Niveau de carrière (cumulé toutes saisons) — même jointure que
          // l'Accueil : predictions -> matches.matchday_id -> matchdays.season_id.
          // competition_id en plus : nécessaire pour isoler les vraies
          // journées Ligue 1 des journées bonus (PL/PD/SA/BL1), même logique
          // que classement.tsx.
          supabase
            .from("matchdays")
            .select("id,season_id,season,competition_id"),

          // Pseudo + équipe favorite de tous les joueurs — nécessaire au
          // départage du classement (rankPlayers) ET à la détection du match
          // favori de chacun (computeLeagueStats), même besoin que sur
          // l'Accueil et la page Classement.
          supabase.from("profiles").select("id, pseudo, favorite_team_id, favorite_team"),

          // Scores LIVE : Supabase reste la source du calendrier, l'API fournit
          // le score/statut courant — même fetcher que toutes les autres
          // pages (src/lib/liveMatches.ts).
          fetchLiveApiMatches(),
        ]);

        const [
          { data: competitionsData, error: competitionsError },
          { data: bonusOptionsData, error: bonusOptionsError },
          { data: favoriteHistoryData, error: favoriteHistoryError },
        ] = await Promise.all([
          supabase.from("competitions").select("id, code, external_code"),
          // Actives ET historiques — même raison que classement.tsx.
          supabase.from("bonus_options").select("matchday_id, match_id"),
          // Équipe favorite historisée par saison (Lot 4).
          supabase.from("user_season_favorite_teams").select("user_id, season_id, favorite_team_id"),
        ]);

        if (profileError) throw profileError;
        if (teamsError) throw teamsError;
        if (settingsError) throw settingsError;
        if (predictionsError) throw predictionsError;
        if (matchesError) throw matchesError;
        if (matchdaysError) console.warn("Erreur chargement journées (niveau de carrière) :", matchdaysError);
        if (allProfilesError) console.warn("Erreur chargement pseudos (classement) :", allProfilesError);
        if (competitionsError) console.warn("Erreur chargement compétitions :", competitionsError);
        if (bonusOptionsError) console.warn("Erreur chargement bonus :", bonusOptionsError);
        if (favoriteHistoryError) console.warn("Historique équipe favorite non chargé :", favoriteHistoryError);

        if (cancelled) return;

        if (profile) {
          setUsername(profile.pseudo || "Red evils");
          setAvatarUrl(profile.avatar_url || "");
        } else {
          const { error: profileCreateError } = await supabase
            .from("profiles")
            .upsert({
              id: session.user.id,
              pseudo: "Red evils",
              updated_at: new Date().toISOString(),
            });

          if (profileCreateError) {
            console.warn("Profil absent et création automatique impossible :", profileCreateError);
          }
        }

        setTeams(teamsData || []);

        if ((settingsData as any)?.season) {
          setSeasonLabel(String((settingsData as any).season));
        }

        const settings = settingsData as {
          favorite_team_deadline: string | null;
          favorite_team_auto_lock: boolean | null;
        } | null;

        if (settings?.favorite_team_deadline) {
          const dateObj = new Date(settings.favorite_team_deadline);
          if (!Number.isNaN(dateObj.getTime())) {
            setDeadlineDate(dateObj);
            setDeadlineStr(
              dateObj.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }) +
                " à " +
                dateObj.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
            );
          }
        } else {
          setDeadlineDate(null);
          setDeadlineStr("");
        }

        setAutoLock(settings?.favorite_team_auto_lock ?? true);

        if (cancelled || requestId !== statsRequestSeq.current) return;

        // ---------------------------------------------------------------------
        // SCORES LIVE — fusion + garde anti-régression centralisées dans
        // src/lib/liveMatches.ts, identiques à Classement/Accueil/Stats.
        // Un score déjà connu ne peut pas régresser pendant le LIVE (ex. 1-1 -> 0-0)
        // à cause d'une réponse API momentanément incomplète.
        // ---------------------------------------------------------------------
        const mergedMatches = reconcileMatchesWithLive((matchesData || []) as any[], apiLiveMatches);

        // Classement : recalculé à partir de `predictions` (tous les joueurs)
        const allPredictions = (allPredictionsData || []) as Array<{
          user_id: string | null;
          match_id: string | null;
          home_prediction: number | null;
          away_prediction: number | null;
          created_at?: string | null;
        }>;

        const matchScoreById = new Map<string, { home_score: number | null; away_score: number | null }>();
        mergedMatches.forEach((match: any) => {
          matchScoreById.set(String(match.id), {
            home_score: match.home_score ?? null,
            away_score: match.away_score ?? null,
          });
        });

        const isExactPrediction = (prediction: { match_id: string | null; home_prediction: number | null; away_prediction: number | null }) => {
          if (prediction.home_prediction == null || prediction.away_prediction == null) return false;
          const result = matchScoreById.get(String(prediction.match_id));
          if (!result || result.home_score == null || result.away_score == null) return false;
          return (
            Number(prediction.home_prediction) === Number(result.home_score) &&
            Number(prediction.away_prediction) === Number(result.away_score)
          );
        };

        // Points/scores exacts/régularité : même moteur que le Classement
        // (computeLeagueStats, src/lib/leaderboardStats.ts) — plus de lecture
        // de `predictions.points` (colonne jamais mise à jour par
        // l'application, voir le commentaire dans leaderboardStats.ts).
        const ligue1CompetitionIds = new Set(
          (competitionsData || [])
            .filter((c: any) => c.code === "FL1" || c.external_code === "FL1")
            .map((c: any) => String(c.id)),
        );
        const ligue1MatchdayIds = new Set(
          (matchdaysData || [])
            .filter((md: any) => !md.competition_id || ligue1CompetitionIds.has(String(md.competition_id)))
            .map((md: any) => String(md.id)),
        );

        const allMatches = mergedMatches as any[];

        // Pour le moteur de points uniquement, un match commencé avec un score
        // live devient un résultat provisoire. Rien n'est écrit en base.
        // Même fonction que Classement/Accueil/Stats (src/lib/liveMatches.ts).
        const liveScoringMatches = markLiveMatchesScorable(allMatches);

        const ligue1Matches = liveScoringMatches.filter(
          (m) =>
            m.home_score != null &&
            m.away_score != null &&
            m.finished &&
            !m.is_bonus &&
            m.matchday_id &&
            ligue1MatchdayIds.has(String(m.matchday_id)),
        );

        const bonusOptions = (bonusOptionsData || []) as { matchday_id: string; match_id: string }[];
        const bonusMatchIds = new Set(bonusOptions.map((o) => String(o.match_id)));
        const bonusMatches = liveScoringMatches.filter(
          (m) =>
            m.home_score != null &&
            m.away_score != null &&
            m.finished &&
            bonusMatchIds.has(String(m.id)),
        );

        const teamNameById: Record<string, string | undefined> = {};
        (teamsData || []).forEach((t: any) => {
          teamNameById[t.id] = t.name;
        });

        const allProfilesForStats = (allProfilesData || []) as Array<{
          id: string;
          pseudo?: string | null;
          favorite_team_id?: string | null;
          favorite_team?: string | null;
        }>;

        // Saison par journée + équipe favorite HISTORISÉE par saison
        // (Lot 4) — construits avant computeLeagueStats pour que le barème
        // favori (2/1/0) d'un pronostic passé utilise le club réellement
        // favori à cette époque, jamais le favori courant du profil.
        const matchdayIdByMatchId = new Map<string, string>();
        (matchesData || []).forEach((match: any) => {
          if (match.matchday_id) {
            matchdayIdByMatchId.set(String(match.id), String(match.matchday_id));
          }
        });

        const seasonByMatchdayId = new Map<string, string>();
        (matchdaysData || []).forEach((md: any) => {
          if (!md?.id) return;
          seasonByMatchdayId.set(String(md.id), String(md.season_id || md.season || "unknown"));
        });
        const seasonByMatchdayIdObj: Record<string, string> = Object.fromEntries(seasonByMatchdayId);

        const favoriteTeamBySeason: Record<string, string> = {};
        (favoriteHistoryData ?? []).forEach((row: any) => {
          if (!row?.user_id || !row?.season_id || !row?.favorite_team_id) return;
          favoriteTeamBySeason[`${row.user_id}:${row.season_id}`] = row.favorite_team_id;
        });

        if (cancelled || requestId !== statsRequestSeq.current) return;

        const {
          pointsByUser: rankingPointsByUser,
          predictionsCountByUser: rankingCountByUser,
          exactScoresByUser: rankingExactByUser,
          regularitySuccessByUser: rankingRegularityByUser,
          participationByUser: rankingParticipationByUser,
          participationTotalByUser: rankingParticipationTotalByUser,
          pointsByUserAndMatchday,
          pointsByPredictionKey,
        } = computeLeagueStats(
          ligue1Matches,
          bonusMatches,
          bonusOptions,
          allPredictions,
          allProfilesForStats,
          teamNameById,
          { seasonByMatchdayId: seasonByMatchdayIdObj, favoriteTeamBySeason },
        );

        // Niveau de carrière — cumulé sur TOUTES les saisons (jamais
        // réinitialisé), même jointure predictions -> matches.matchday_id
        // -> matchdays.season_id que sur l'Accueil, via la fonction partagée
        // aggregateCareerStatsByUser (src/lib/careerLevel.ts). Points réels
        // injectés depuis computeLeagueStats ci-dessus (pointsByPredictionKey) :
        // aggregateCareerStatsByUser lit un champ `points` par pronostic, et
        // `predictions.points` n'est jamais mis à jour par l'application
        // (voir le commentaire dans leaderboardStats.ts).
        const predictionsWithRealPoints = allPredictions.map((p) => ({
          ...p,
          points: pointsByPredictionKey[`${p.user_id}:${p.match_id}`] ?? 0,
        }));

        const careerByUser = aggregateCareerStatsByUser(
          predictionsWithRealPoints,
          isExactPrediction,
          (matchId) => {
            const matchdayId = matchdayIdByMatchId.get(matchId);
            if (!matchdayId) return null;
            return seasonByMatchdayId.get(matchdayId) ?? null;
          },
        );

        const myCareerStats = careerByUser.get(session.user.id) || {
          points: 0,
          exactScores: 0,
          predictionsCount: 0,
        };
        setCareer(calculateCareerScore(myCareerStats));
        setCareerPredictionsCount(myCareerStats.predictionsCount || 0);

        const pseudoById = new Map<string, string>(
          (allProfilesData || []).map((row: any) => [row.id, row.pseudo || "Joueur"]),
        );

        // ================================================================
        // PROFIL = miroir du CLASSEMENT + état LIVE de PRONOSTICS
        // ================================================================
        // Le Classement publie son résultat canonique dans localStorage.
        // On le privilégie pour le rang/points/exacts/régularité : pas de second
        // calcul divergent.
        const classementSnapshot = readClassementSnapshot();
        const classementMe = classementSnapshot?.players?.find(
          (row: any) => String(row.id) === String(session.user.id),
        );

        // Le cache session partagé par Pronostics contient les derniers scores
        // live. Sa lecture permet au Profil de suivre immédiatement les matchs
        // déjà vus sur la page Pronos.
        readLivePronosCache();

        const predictions = allPredictions.filter(
          (prediction) => prediction.user_id === session.user.id
        );

        // Rang calculé sur TOUS les joueurs inscrits, comme le Classement.
        // BUG CORRIGÉ : la liste ne contenait que les clés de
        // rankingPointsByUser, donc uniquement les joueurs ayant déjà marqué.
        // Les joueurs à 0 point étaient absents du classement local et le rang
        // affiché sur le Profil remontait artificiellement (18 au lieu de 22).
        const fallbackAllUserIds = new Set(
          (allProfilesData || []).map((row: any) => String(row.id)),
        );
        Object.keys(rankingPointsByUser).forEach((uid) => fallbackAllUserIds.add(uid));
        fallbackAllUserIds.add(session.user.id);

        const fallbackRankedRows = Array.from(fallbackAllUserIds).map((uid) => ({
          id: uid,
          name: pseudoById.get(uid) || "Joueur",
          avatar: "",
          points: Number(rankingPointsByUser[uid] || 0),
          exactScores: Number(rankingExactByUser[uid] || 0),
          predictionsCount: Number(rankingCountByUser[uid] || 0),
          regularitySuccess: Number(rankingRegularityByUser[uid] || 0),
          // Même départage que le Classement (voir leaderboardRanking.ts).
          participation: Number(rankingParticipationByUser[uid] || 0),
          participationTotal: Number(rankingParticipationTotalByUser[uid] || 0),
          pseudo: pseudoById.get(uid) || "Joueur",
        }));

        const fallbackRanked = rankPlayers(fallbackRankedRows as any);
        const fallbackMe = fallbackRanked.find(
          (row: any) => String(row.id) === String(session.user.id),
        );

        const rank = Number(fallbackMe?.rank ?? 0);
        // Un rang seul ne dit rien : 12e sur 12 ou 12e sur 23, ce n'est pas
        // la meme histoire.
        const totalPlayers = fallbackRanked.length;
        // BUG CORRIGÉ : le snapshot localStorage publié par le Classement
        // passait EN PREMIER. `??` ne bascule que sur null/undefined, donc un
        // snapshot périmé (ex. points: 1, écrit lors d'une visite précédente)
        // gagnait indéfiniment contre le calcul frais de computeLeagueStats
        // (points: 2) — le Profil restait figé sur une ancienne valeur pendant
        // que le Classement, lui, se mettait à jour.
        // Le calcul frais est désormais prioritaire ; le snapshot ne sert plus
        // que de dernier recours si le moteur n'a rien pu produire.
        const totalPoints = Number(
          rankingPointsByUser[session.user.id] ??
          fallbackMe?.points ??
          classementMe?.points ??
          0,
        );
        const exactScores = Number(
          rankingExactByUser[session.user.id] ??
          fallbackMe?.exactScores ??
          classementMe?.exactScores ??
          0,
        );

        // Libellé de journée ("J5") par matchday_id — pur affichage.
        const dayLabelByMatchdayId = new Map<string, string>();
        allMatches.forEach((match) => {
          if (!match.matchday_id || dayLabelByMatchdayId.has(String(match.matchday_id))) return;
          if (match.matchday === null || match.matchday === undefined) return;
          // Selon les lignes, `matchday` vaut "1" ou deja "J1" : prefixer
          // sans regarder donnait "JJ1" sous Meilleure journee.
          const brut = String(match.matchday).trim();
          dayLabelByMatchdayId.set(
            String(match.matchday_id),
            /^j/i.test(brut) ? `J${brut.slice(1)}` : `J${brut}`,
          );
        });

        const myPointsByDay = pointsByUserAndMatchday[session.user.id] ?? {};
        const playedDays = Object.keys(myPointsByDay).length;

        let bestDay = "-";
        let bestDayPoints = -1;
        Object.entries(myPointsByDay).forEach(([matchdayId, points]) => {
          if (points > bestDayPoints) {
            bestDayPoints = points;
            bestDay = dayLabelByMatchdayId.get(matchdayId) ?? "-";
          }
        });

        const successfulPredictions = rankingRegularityByUser[session.user.id] || 0;
        const totalCounted = rankingCountByUser[session.user.id] || 0;
        const successRate =
          totalCounted > 0
            ? `${Math.round((successfulPredictions / totalCounted) * 100)}%`
            : "0%";

        setUserStats({
          rank,
          totalPlayers,
          points: totalPoints,
          exactScores,
          successRate,
          // Même ordre de priorité que points/exacts ci-dessus : calcul frais
          // d'abord, snapshot en dernier recours.
          totalPronos:
            Number(
              rankingCountByUser[session.user.id] ??
              fallbackMe?.predictionsCount ??
              classementMe?.predictionsCount ??
              predictions.length,
            ) || 0,
          bestDay,
        });

        // Live snapshot consumed by every performance block above.
        setLiveTick(Date.now());

        if (profile?.favorite_team_id) {
          setTempSelectedTeam(profile.favorite_team_id);
        }
      } catch (err) {
        console.error("Erreur de chargement Supabase du profil :", err);
      } finally {
        if (!cancelled && requestId === statsRequestSeq.current) setLoading(false);
      }
    }

    loadData();

     // Même cadence que Classement/Accueil/Stats/Gazette (15s, cf.
     // src/lib/liveMatches.ts) — compromis charge API / fraîcheur live.
     const liveRefreshTimer = window.setInterval(() => {
      setLiveTick(Date.now());
      if (document.visibilityState === "visible") {
        loadData();
      }
    }, 15_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    const handleFocus = () => {
      loadData();
    };

     document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      ++statsRequestSeq.current;
      window.clearInterval(liveRefreshTimer);
       document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  // Horloge légère : le verrouillage devient effectif sans rechargement de page.
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isLocked = Boolean(
    autoLock &&
      deadlineDate &&
      currentTime >= deadlineDate,
  );

  // Fond d'écran dynamique par équipe
  const teamWallpaperUrl = getTeamWallpaperSlug(favoriteTeamName)
    ? getTeamWallpaperUrl(favoriteTeamName)
    : null;
  const [wallpaperFailed, setWallpaperFailed] = useState(false);

  useEffect(() => {
    setWallpaperFailed(false);
  }, [teamWallpaperUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      alert("Veuillez choisir une image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Choisissez une image de moins de 2 Mo.");
      return;
    }

    setSavingProfile(true);

    try {
      const dataUrl = await resizeImageToDataUrl(file);

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          avatar_url: dataUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setAvatarUrl(dataUrl);
      await refreshProfile();

      setSavedProfile(true);
      window.setTimeout(() => setSavedProfile(false), 3000);
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la photo :", err);
      alert("Impossible d'enregistrer la photo de profil.");
    } finally {
      setSavingProfile(false);
    }
  };
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      alert("Le pseudo ne peut pas être vide.");
      return;
    }

    if (cleanUsername.length > 24) {
      alert("Le pseudo doit contenir 24 caractères maximum.");
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          pseudo: cleanUsername,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setUsername(cleanUsername);
      await refreshProfile();

      setSavedProfile(true);
      window.setTimeout(() => setSavedProfile(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du profil :", err);
      alert("Erreur lors de la mise à jour du profil.");
    } finally {
      setSavingProfile(false);
    }
  };
  const handleDeleteAvatar = async () => {
    if (!user || !avatarUrl) return;

    const confirmed = window.confirm(
      "Supprimer définitivement ta photo de profil ?"
    );
    if (!confirmed) return;

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setAvatarUrl("");
      await refreshProfile();

      setSavedProfile(true);
      window.setTimeout(() => setSavedProfile(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la suppression de la photo :", err);
      alert("Impossible de supprimer la photo de profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveFavoriteTeam = async () => {
    if (!user || !tempSelectedTeam) return;

    // Recontrôle au moment de la sauvegarde : impossible de valider un
    // changement si la date limite vient d'être dépassée.
    const lockedNow = Boolean(
      autoLock &&
        deadlineDate &&
        new Date() >= deadlineDate,
    );
    if (lockedNow) {
      setIsEditingTeam(false);
      alert("La période de choix de l'équipe de cœur est terminée.");
      return;
    }

    setSavingTeam(true);

    try {
      await saveFavoriteTeam(tempSelectedTeam);
      setTempSelectedTeam(tempSelectedTeam);
      setIsEditingTeam(false);
      await refreshProfile();
    } catch (err) {
      console.error("Erreur équipe favorite :", err);
      alert("Impossible d'enregistrer l'équipe.");
    } finally {
      setSavingTeam(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-emerald-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relative z-10 mx-auto max-w-6xl space-y-8 pb-28 md:space-y-10 md:pb-20">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* ================= NOTIFICATIONS ================= */}
        <section
          id="profile-push-notifications"
          className="rounded-3xl border border-emerald-400/20 bg-[#0d1322]/75 p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-6"
        >
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Notifications
          </div>

          <PushNotificationsButton />
        </section>
        {/* ================= MON PROFIL ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8">
          {/* Fond stade nocturne */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: "url('/profil-background-ligue1.png')" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d1322]/20 via-[#0d1322]/35 to-[#0d1322]/55" />
          {/* Logo Ligue 1 décoratif élégant */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 size-40 opacity-[0.07]"
          >
            <img
              src="/logo%20ligue%201%20white.png"
              alt=""
              className="size-full object-contain"
            />
          </div>

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
            {/* Photo + actions */}
            <div className="flex flex-col items-center gap-3 md:w-48 md:shrink-0">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-emerald-500/15 blur-xl" />
                <div className="relative size-28 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-cyan-400 p-[3px] shadow-[0_0_30px_rgba(16,185,129,0.25)] md:size-32">
                  <div className="flex size-full items-center justify-center overflow-hidden rounded-full border-4 border-[#0d1322] bg-[#060b16]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                    ) : (
                      <span className="font-display text-3xl font-black tracking-wider text-white">
                        {username ? username.substring(0, 2).toUpperCase() : "RE"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Boutons discrets et secondaires */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingProfile}
                  className="tap flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Camera className="size-3" />
                  )}
                  {savingProfile ? "..." : "Photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    disabled={savingProfile}
                    className="tap flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                    Retirer la photo
                  </button>
                )}
              </div>
            </div>

            {/* Identité + stats */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
                Mon profil
              </div>
              <h1
                className="mt-2 bg-gradient-to-b from-white via-white to-[color-mix(in_oklab,var(--sky)_32%,white)] bg-clip-text font-display text-4xl font-black uppercase leading-none tracking-tight text-transparent md:text-5xl"
                style={{
                  filter:
                    "drop-shadow(0 1px 0 rgba(0,0,0,.35)) drop-shadow(0 0 20px rgba(22,82,240,.16))",
                }}
              >
                {username}
              </h1>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Activity className="size-3.5" />
                Saison {seasonLabel ?? "—"}
              </div>

              {/* 4 stats compactes */}
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">Classement</span>
                  <div className="mt-1 flex items-baseline gap-1.5 font-display text-3xl font-black text-white">
                    {userStats.rank > 0 ? (
                      <>
                        {userStats.rank}
                        <span className="text-sm font-bold text-slate-500">
                          e{userStats.totalPlayers > 0 ? ` / ${userStats.totalPlayers}` : ""}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">Points</span>
                  <div
                    className="mt-1 font-display text-3xl font-black text-white"
                    style={{ filter: "drop-shadow(0 0 12px rgba(110,231,183,.35))" }}
                  >
                    {userStats.points}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">Meilleure journée</span>
                  <div className="mt-1 font-display text-3xl font-black text-white">
                    {userStats.bestDay === "-" ? "—" : userStats.bestDay}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">Équipe de cœur</span>
                  <div className="mt-2 truncate font-display text-sm font-bold text-white">
                    {favoriteTeamName || "Non renseignée"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= NIVEAU DE CARRIÈRE ================= */}
        {/* Même système que le badge "Niveau" de l'Accueil (src/lib/careerLevel.ts,
            source de vérité partagée, jamais dupliquée) : points + scores
            exacts cumulés sur TOUTES les saisons, jamais réinitialisés. */}
        <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-[#0d1322]/75 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">
                <Award className="size-3.5" />
                Progression joueur
              </div>
              <h2 className="mt-1.5 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                Niveau de carrière
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                Cumulé sur toutes les saisons, jamais réinitialisé.
              </p>
            </div>

            {/* Badge niveau — même langage visuel que le badge "Niveau" de l'Accueil */}
            <div className="relative inline-flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/35 bg-[#060b16]/85 px-4 py-3 shadow-[0_0_24px_rgba(245,158,11,0.12)] backdrop-blur-md">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/[0.10] via-transparent to-amber-200/[0.05]" />
              <div className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/20 via-amber-500/10 to-transparent shadow-[inset_0_0_16px_rgba(245,158,11,0.12)]">
                <span className="font-display text-xl font-black leading-none text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]">
                  {career?.level ?? 1}
                </span>
              </div>
              <div className="relative min-w-0">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-amber-400/80">
                  Niveau
                </span>
                <span className="block truncate font-display text-sm font-extrabold uppercase tracking-wide text-white sm:text-base">
                  {getCareerTitle(career?.level ?? 1)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Points carrière cumulés */}
            <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                <Trophy className="size-3 text-amber-400" />
                Points carrière cumulés
              </div>
              <div
                className="mt-1.5 font-display text-3xl font-black text-white"
                style={{ filter: "drop-shadow(0 0 12px rgba(245,158,11,.25))" }}
              >
                {career?.points ?? 0}
              </div>
            </div>

            {/* Progression vers le niveau suivant — pourcentage relatif
                uniquement, jamais les seuils bruts (voir careerLevel.ts). */}
            <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                <TrendingUp className="size-3 text-amber-400" />
                Progression
              </div>
              {career && career.level >= 30 ? (
                <div className="mt-2.5 text-sm font-bold text-amber-300">Niveau maximum atteint</div>
              ) : (
                <>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,.5)] transition-all"
                      style={{ width: `${career ? getCareerProgressPercent(career.careerScore) : 0}%` }}
                    />
                  </div>
                  <div className="mt-1.5 font-display text-sm font-bold text-white">
                    {career ? getCareerProgressPercent(career.careerScore) : 0}%
                  </div>
                </>
              )}
            </div>

            {/* % de scores exacts (carrière) */}
            <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                <Target className="size-3 text-amber-400" />
                % de scores exacts
              </div>
              <div className="mt-1.5 font-display text-3xl font-black text-white">
                {careerPredictionsCount > 0 && career
                  ? Math.round((career.exactScores / careerPredictionsCount) * 100)
                  : 0}
                %
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {career?.exactScores ?? 0} sur {careerPredictionsCount} pronostic{careerPredictionsCount > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </section>

        {/* ================= MON ÉQUIPE DE CŒUR ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Fond dynamique du club */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{
              backgroundImage: `url('${!wallpaperFailed && teamWallpaperUrl ? teamWallpaperUrl : "/profil-background-ligue1.png"}')`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d1322]/95 via-[#0d1322]/80 to-[#0d1322]/40" />

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">
                  <Star className="size-3.5 fill-amber-400" />
                  Saison {seasonLabel ?? "—"}
                </div>
                <h2 className="mt-1.5 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                  Mon équipe de cœur
                </h2>
              </div>

              {favoriteTeamId && !isEditingTeam && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-emerald-300">
                  <Check className="size-3.5" />
                  Choix enregistré
                </span>
              )}
            </div>

            {!favoriteTeamId || isEditingTeam ? (
              <div className="mt-6">
                <p className="mb-4 text-sm text-slate-300">
                  Sélectionne ton club de cœur pour personnaliser ton expérience :
                </p>

                {!isLocked ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={tempSelectedTeam}
                      onChange={(e) => setTempSelectedTeam(e.target.value)}
                      className="w-full flex-1 rounded-xl border border-slate-700 bg-[#060b16]/90 p-3.5 text-sm text-white outline-none transition focus:border-emerald-500/50"
                    >
                      <option value="" disabled>Sélectionne un club...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleSaveFavoriteTeam}
                      disabled={!tempSelectedTeam || savingTeam}
                      className="tap flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {savingTeam ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Valider
                    </button>

                    {isEditingTeam && favoriteTeamId && (
                      <button
                        onClick={() => setIsEditingTeam(false)}
                        className="tap rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-3.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                    <Lock className="size-4 shrink-0" />
                    La période de modification est clôturée. Votre choix est verrouillé.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Logo du club */}
                <div className="relative flex size-28 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[0_20px_50px_rgba(0,0,0,.4)] backdrop-blur-md">
                  <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-emerald-400/10 via-cyan-400/10 to-amber-300/10 blur-lg" />
                  <div className="relative flex size-full items-center justify-center">
                    {teams.find((t) => t.id === favoriteTeamId)?.logo_url ? (
                      <img
                        src={teams.find((t) => t.id === favoriteTeamId)?.logo_url ?? ""}
                        alt={favoriteTeamName || "Équipe de cœur"}
                        className="size-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,.15)]"
                      />
                    ) : (
                      <span className="font-display text-2xl font-black text-white">
                        {(favoriteTeamName || "FC").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Infos club */}
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[.2em] text-slate-400">
                    Équipe de cœur
                  </div>
                  <h3 className="mt-1 truncate font-display text-3xl font-black tracking-tight text-white md:text-4xl">
                    {favoriteTeamName}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                      <Trophy className="size-3 text-amber-400" />
                      Classement : {userStats.rank > 0 ? `#${userStats.rank}` : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                      <Target className="size-3 text-emerald-400" />
                      Saison {seasonLabel ?? "—"}
                    </span>
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => {
                        setTempSelectedTeam(favoriteTeamId ?? "");
                        setIsEditingTeam(true);
                      }}
                      className="tap mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-400"
                    >
                      Modifier mon choix
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================= MON IDENTITÉ ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">
                  Profil joueur
                </span>
                <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                  Mon identité
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-slate-300">
                <Shield className="size-3.5 text-emerald-400" />
                Compte sécurisé
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
              {/* Pseudo actuel */}
              <div className="min-w-0">
                <div className="text-[9px] font-mono font-bold uppercase tracking-[.2em] text-slate-500">
                  Pseudo actuel
                </div>
                <div className="mt-1 truncate font-display text-3xl font-black tracking-tight text-white md:text-4xl">
                  {username || "Ton pseudo"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,.7)]" />
                  Visible dans les classements et sur le site
                </div>
              </div>

              {/* Édition pseudo */}
              <form onSubmit={handleUpdateProfile} className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-5">
                <div className="mb-4">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-[.2em] text-slate-500">
                    Modifier mon pseudo
                  </label>
                  <div className="relative mt-3">
                    <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={username}
                      maxLength={24}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ton pseudo"
                      className="w-full rounded-xl border border-slate-700 bg-[#040a14]/90 py-3.5 pl-11 pr-14 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600">
                      {username.length}/24
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 font-display text-[11px] font-black uppercase tracking-[.14em] text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition hover:bg-emerald-500"
                >
                  {savingProfile ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Enregistrement...
                    </span>
                  ) : savedProfile ? (
                    <span className="flex items-center gap-2">
                      <Check className="size-4" />
                      Modifications enregistrées
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4" />
                      Enregistrer les modifications
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}