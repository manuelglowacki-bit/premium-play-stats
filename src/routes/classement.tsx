import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Minus,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { matchday as currentMatchday } from "@/lib/prono-data";
import { calculateCareerScore } from "@/lib/careerLevel";
import { useTeamTheme } from "@/hooks/useTeamTheme";
import { computeLeagueStats } from "@/lib/leaderboardStats";
import { rankPlayers } from "@/lib/leaderboardRanking";

export const Route = createFileRoute("/classement")({
  head: () => ({
    meta: [
      { title: "Classement Général — Prono Ligue 1" },
      { name: "description", content: "Classement général et statistiques de la ligue de pronostics." },
    ],
  }),
  component: ClassementPage,
});

// ============================================================
// Données & calcul du classement
// ============================================================
type PlayerProfile = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
  favorite_team_id: string | null;
  /** Ancienne colonne texte (nom du club, pré-datant favorite_team_id) —
   * utilisée uniquement en repli si l'id ne permet pas de détecter le match
   * de l'équipe favorite (voir isFavoriteMatch dans lib/predictionScoring.ts). */
  favorite_team?: string | null;
};

type TeamRow = { id: string; name: string; short_name: string | null; logo_url: string | null };

type RankedPlayer = PlayerProfile & {
  rank: number;
  points: number;
  exactScores: number;
  predictionsCount: number;
  /** Nombre de pronostics 1N2 réussis (cumul sur toutes les journées terminées) — sert au calcul de la régularité. */
  regularitySuccess: number;
  careerLevel: number;
  careerTitle: string;
};

/**
 * Réduit progressivement la taille d'un nom de joueur trop long au lieu de le
 * tronquer — retourne un facteur d'échelle à appliquer à la taille de police
 * de base (via calc(... * facteur)).
 */
function podiumNameScale(name: string): number {
  const len = name.length;
  if (len > 16) return 0.68;
  if (len > 12) return 0.8;
  if (len > 9) return 0.9;
  return 1;
}

/**
 * Médaille de classement (or / argent / bronze) — remplace le chiffre de
 * position (1/2/3) à l'intérieur des bannières du podium. `scope` évite les
 * collisions d'id de gradient entre la scène desktop et la scène mobile
 * (toutes deux présentes dans le DOM en même temps, seule leur visibilité
 * CSS diffère).
 */
function RankMedal({ rank, scope, className }: { rank: 1 | 2 | 3; scope: string; className?: string }) {
  const palette =
    rank === 1
      ? { from: "#FFF3D0", mid: "#F5C24D", to: "#B8790F", ribbonA: "#7A1F2B", ribbonB: "#54141C" }
      : rank === 2
        ? { from: "#FDFEFF", mid: "#D7DEE8", to: "#8B96A6", ribbonA: "#2E4B7A", ribbonB: "#1E3455" }
        : { from: "#F7D9AE", mid: "#C8813F", to: "#7C441C", ribbonA: "#7A1F2B", ribbonB: "#54141C" };

  const gradId = `medal-disc-${scope}-${rank}`;

  return (
    <svg viewBox="0 0 64 64" className={className} style={{ width: "100%", height: "100%" }} aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="55%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.to} />
        </radialGradient>
      </defs>
      {/* Ruban */}
      <path d="M22 2 L30 25 L20 29 Z" fill={palette.ribbonA} />
      <path d="M42 2 L34 25 L44 29 Z" fill={palette.ribbonB} />
      {/* Disque */}
      <circle cx="32" cy="37" r="21" fill={`url(#${gradId})`} stroke={palette.to} strokeWidth="1.5" />
      <circle cx="32" cy="37" r="21" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" opacity="0.5" />
      <circle cx="32" cy="37" r="15.5" fill="none" stroke={palette.from} strokeWidth="1" opacity="0.5" />
      {/* Reflet */}
      <ellipse cx="25" cy="29" rx="9" ry="5" fill="#fff" opacity="0.18" />
      {/* Emblème étoile gravée */}
      <path
        d="M32,26 L34.12,32.09 L40.56,32.22 L35.42,36.11 L37.29,42.28 L32,38.6 L26.71,42.28 L28.58,36.11 L23.44,32.22 L29.88,32.09 Z"
        fill={palette.to}
        opacity="0.92"
      />
    </svg>
  );
}

function ClassementPage() {
  const { user } = useAuth();
  const { theme: viewerTheme } = useTeamTheme();

  const [players, setPlayers] = useState<PlayerProfile[] | null>(null);
  const [teamsById, setTeamsById] = useState<Record<string, TeamRow>>({});
  const [season, setSeason] = useState("2026-2027");

  const [pointsByUser, setPointsByUser] = useState<Record<string, number>>({});
  const [predictionsCountByUser, setPredictionsCountByUser] = useState<Record<string, number>>({});
  // Scores exacts réels (pronostic "club de cœur" home_score/away_score === score final du match),
  // et compteur de pronostics 1N2 réussis pour la régularité — tous deux calculés dynamiquement
  // depuis Supabase (voir load() ci-dessous), jamais de valeur fictive.
  const [exactScoresByUser, setExactScoresByUser] = useState<Record<string, number>>({});
  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});
  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});
  // Liste des journées Ligue 1 de la saison (id + numéro) — sert uniquement au
  // sélecteur visuel sous le titre. Le classement lui-même reste un cumul
  // saison complet : ce sélecteur est préparé pour un futur filtrage réel
  // par journée, mais n'est pas encore branché sur une logique de calcul
  // (décision produit du 14/08 : pas de nouvelle requête de classement par
  // journée dans cette refonte visuelle).
  const [matchdaysList, setMatchdaysList] = useState<{ id: string; number: number }[]>([]);
  // Journée ayant distribué le plus de points cumulés (tous joueurs
  // confondus), calculée en ré-agrégeant les points déjà attribués par
  // load() ci-dessous (aucune valeur de point recalculée/modifiée — simple
  // regroupement par matchday_id de ce qui est déjà additionné à points[]).
  const [bestMatchday, setBestMatchday] = useState<{ number: number; points: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    type MatchForRanking = {
      id: string;
      matchday_id: string | null;
      home_team_id: string | null;
      away_team_id: string | null;
      /** Noms bruts (colonnes texte de `matches`, indépendantes de `teams`) —
       * servent de repli pour la détection de l'équipe favorite quand
       * home_team_id/away_team_id est manquant/incohérent. */
      home_team: string | null;
      away_team: string | null;
      home_score: number | null;
      away_score: number | null;
      finished: boolean;
      is_bonus: boolean;
    };

    type BonusOptionForRanking = {
      matchday_id: string;
      match_id: string;
      is_active: boolean;
    };

    async function load() {
      try {
        // La source du classement est maintenant cohérente avec le système
        // actuel :
        // - profiles.favorite_team_id = équipe de cœur
        // - predictions.home_prediction / away_prediction = pronostic
        // - matches = résultat + équipes + type du match
        // - bonus_options = les 4 matchs bonus rattachés à UNE journée Ligue 1
        const [
          { data: profilesData, error: profilesError },
          { data: teamsData, error: teamsError },
          { data: settingsData, error: settingsError },
          { data: matchdaysData, error: matchdaysError },
        ] = await Promise.all([
          supabase.from("profiles").select("id, pseudo, avatar_url, favorite_team_id, favorite_team"),
          supabase.from("teams").select("id, name, short_name, logo_url"),
          supabase.from("app_settings").select("season").eq("id", 1).maybeSingle(),
          supabase
            .from("matchdays")
            .select("id, number, code, season, season_id, competition_id")
            .order("number", { ascending: true }),
        ]);

        if (cancelled) return;
        if (profilesError) throw profilesError;
        if (teamsError) throw teamsError;
        if (settingsError) throw settingsError;
        if (matchdaysError) throw matchdaysError;

        const seasonName = settingsData?.season ?? "2026-2027";
        if (settingsData?.season) setSeason(settingsData.season);

        const teamsMap: Record<string, TeamRow> = {};
        (teamsData ?? []).forEach((t: TeamRow) => {
          teamsMap[t.id] = t;
        });
        setTeamsById(teamsMap);

        // On ne travaille que sur les journées Ligue 1 de la saison courante.
        // Le filtre compétition évite de mélanger les J1/J2 des 4 championnats
        // bonus avec les J1/J2 de Ligue 1.
        const ligue1Matchdays = (matchdaysData ?? []).filter((md: any) => {
          const sameSeason = String(md.season ?? seasonName) === String(seasonName);
          const competitionCode = String(md.competition_id ?? "");
          return sameSeason && competitionCode !== "";
        });

        // Certaines anciennes lignes peuvent avoir season vide mais être liées
        // à une journée de la saison courante. On garde aussi les journées
        // explicitement marquées 2026-2027.
        const matchdayIds = ligue1Matchdays.map((md: any) => String(md.id));
        // CARRIERE MULTI-SAISON
        const [
          { data: careerPredictionsData, error: careerPredictionsError },
          { data: careerMatchesData, error: careerMatchesError },
        ] = await Promise.all([
          supabase.from("predictions").select("user_id,match_id,points,home_prediction,away_prediction"),
          supabase.from("matches").select("id,home_score,away_score,finished").eq("finished", true),
        ]);

        if (careerPredictionsError) throw careerPredictionsError;
        if (careerMatchesError) throw careerMatchesError;

        const careerMatchById = new Map<string, any>();
        (careerMatchesData ?? []).forEach((m: any) => careerMatchById.set(String(m.id), m));

        const careerAccum: Record<string, { points: number; exactScores: number }> = {};
        (careerPredictionsData ?? []).forEach((pred: any) => {
          const uid = String(pred.user_id ?? "");
          if (!uid) return;
          const match = careerMatchById.get(String(pred.match_id));
          if (!match) return;
          if (!careerAccum[uid]) careerAccum[uid] = { points: 0, exactScores: 0 };
          careerAccum[uid].points += Number(pred.points ?? 0);
          if (
            match.home_score != null && match.away_score != null &&
            pred.home_prediction != null && pred.away_prediction != null &&
            Number(pred.home_prediction) === Number(match.home_score) &&
            Number(pred.away_prediction) === Number(match.away_score)
          ) careerAccum[uid].exactScores += 1;
        });
        if (!cancelled) setCareerStatsByUser(careerAccum);

        if (matchdayIds.length === 0) {
          if (!cancelled) {
            setPlayers(profilesData ?? []);
            setPointsByUser({});
            setPredictionsCountByUser({});
            setExactScoresByUser({});
            setRegularitySuccessByUser({});
            setBestMatchday(null);
          }
          return;
        }

        const [
          { data: competitionsData, error: competitionsError },
          { data: finishedLigue1Matches, error: matchesError },
        ] = await Promise.all([
          supabase.from("competitions").select("id, code, external_code"),
          supabase
            .from("matches")
            .select(
              "id, matchday_id, home_team_id, away_team_id, home_team, away_team, home_score, away_score, finished, is_bonus",
            )
            .eq("finished", true)
            .eq("is_bonus", false)
            .in("matchday_id", matchdayIds),
        ]);

        if (cancelled) return;
        if (competitionsError) throw competitionsError;
        if (matchesError) throw matchesError;

        const ligue1CompetitionIds = new Set(
          (competitionsData ?? [])
            .filter((c: any) => c.code === "FL1" || c.external_code === "FL1")
            .map((c: any) => String(c.id)),
        );

        // Les journées Ligue 1 sont liées à FL1. On utilise ce contrôle en plus
        // du season pour rester compatible avec les anciennes données.
        const ligue1MatchdayIds = new Set(
          ligue1Matchdays
            .filter((md: any) => !md.competition_id || ligue1CompetitionIds.has(String(md.competition_id)))
            .map((md: any) => String(md.id)),
        );

        // Sélecteur de journées (visuel) : uniquement les VRAIES journées
        // Ligue 1 (ligue1MatchdayIds, filtrées FL1 ci-dessus) — `ligue1Matchdays`
        // seul incluait par erreur les journées des 4 championnats bonus
        // (même saison, competition_id non vide), d'où des numéros dupliqués
        // dans les chips (ex. "J17 J17 J17 J18…"). Dédoublonnage par numéro en
        // plus, par sécurité vis-à-vis d'éventuelles anciennes lignes en base.
        if (!cancelled) {
          const uniqueByNumber = new Map<number, { id: string; number: number }>();
          ligue1Matchdays
            .filter((md: any) => ligue1MatchdayIds.has(String(md.id)))
            .forEach((md: any) => {
              const number = Number(md.number ?? 0);
              if (!uniqueByNumber.has(number)) {
                uniqueByNumber.set(number, { id: String(md.id), number });
              }
            });
          setMatchdaysList([...uniqueByNumber.values()].sort((a, b) => a.number - b.number));
        }

        const matches = ((finishedLigue1Matches ?? []) as MatchForRanking[]).filter(
          (m) =>
            m.home_score != null &&
            m.away_score != null &&
            !!m.matchday_id &&
            ligue1MatchdayIds.has(String(m.matchday_id)),
        );

        // Les 4 matchs bonus sont rattachés à la journée Ligue 1 via
        // bonus_options.matchday_id. Le match bonus lui-même peut appartenir
        // à une autre compétition et avoir un autre matchday_id dans matches.
        //
        // IMPORTANT — CORRECTIF (bug du 9 au lieu de 13) : on récupère ICI
        // toutes les lignes, actives ET historiques (plus de `.eq("is_active",
        // true)`). Un joueur peut avoir pronostiqué sur le match bonus
        // sélectionné AU MOMENT de son pronostic ; si l'admin change ensuite
        // la sélection (bonusOptionsService.replaceBonusSelection désactive
        // l'ancienne ligne sans y toucher), ce pronostic devenait invisible
        // pour le calcul — silencieusement exclu au lieu d'être compté. Le
        // pronostic du joueur reste rattaché au match qu'il a réellement
        // joué, jamais à la sélection "active" au moment du calcul.
        const { data: bonusOptionsData, error: bonusOptionsError } = await supabase
          .from("bonus_options")
          .select("matchday_id, match_id, is_active")
          .in("matchday_id", matchdayIds);

        if (cancelled) return;
        if (bonusOptionsError) throw bonusOptionsError;

        const bonusOptions = (bonusOptionsData ?? []) as BonusOptionForRanking[];

        const bonusMatchIds = [...new Set(bonusOptions.map((o) => String(o.match_id)).filter(Boolean))];

        let bonusMatches: MatchForRanking[] = [];
        if (bonusMatchIds.length > 0) {
          const { data: bonusMatchesData, error: bonusMatchesError } = await supabase
            .from("matches")
            .select(
              "id, matchday_id, home_team_id, away_team_id, home_team, away_team, home_score, away_score, finished, is_bonus",
            )
            .eq("finished", true)
            .in("id", bonusMatchIds);

          if (cancelled) return;
          if (bonusMatchesError) throw bonusMatchesError;

          bonusMatches = (bonusMatchesData ?? []) as MatchForRanking[];
        }

        const allScoredMatchIds = [
          ...new Set([
            ...matches.map((m) => String(m.id)),
            ...bonusMatches.map((m) => String(m.id)),
          ]),
        ];

        const { data: predictionsData, error: predictionsError } = await supabase
          .from("predictions")
          .select("user_id, match_id, home_prediction, away_prediction, created_at")
          .in("match_id", allScoredMatchIds);

        if (cancelled) return;
        if (predictionsError) throw predictionsError;

        const profiles = (profilesData ?? []) as PlayerProfile[];

        // Agrégation officielle (points / scores exacts / régularité) —
        // extraite dans src/lib/leaderboardStats.ts, comportement identique
        // à avant (même code, juste déplacé) : c'est désormais LA seule
        // source de vérité, réutilisée telle quelle par index.tsx et
        // profil.tsx au lieu de leur propre lecture de `predictions.points`
        // (colonne jamais mise à jour par l'application — voir le
        // commentaire dans leaderboardStats.ts pour le détail du bug corrigé).
        const teamNameById: Record<string, string | undefined> = {};
        Object.entries(teamsMap).forEach(([id, team]) => {
          teamNameById[id] = team.name;
        });

        const { pointsByUser: points, predictionsCountByUser: predictionsCount, exactScoresByUser: exactScores, regularitySuccessByUser: regularitySuccess, pointsByMatchday } =
          computeLeagueStats(matches, bonusMatches, bonusOptions, predictionsData ?? [], profiles, teamNameById);

        let topMatchday: { number: number; points: number } | null = null;
        Object.entries(pointsByMatchday).forEach(([dayId, total]) => {
          if (!topMatchday || total > topMatchday.points) {
            const md = ligue1Matchdays.find((m: any) => String(m.id) === dayId);
            if (md) topMatchday = { number: Number(md.number ?? 0), points: total };
          }
        });

        if (!cancelled) {
          setPlayers(profiles);
          setPointsByUser(points);
          setPredictionsCountByUser(predictionsCount);
          setExactScoresByUser(exactScores);
          setRegularitySuccessByUser(regularitySuccess);
          setBestMatchday(topMatchday);
        }
      } catch (error) {
        console.error("Erreur chargement/calcul du classement :", error);
        if (!cancelled) {
          setPlayers([]);
          setPointsByUser({});
          setPredictionsCountByUser({});
          setExactScoresByUser({});
          setRegularitySuccessByUser({});
          setBestMatchday(null);
        }
      }
    }

    load();

    const refreshRanking = () => {
      load();
    };

    window.addEventListener("pronos-updated", refreshRanking);
    window.addEventListener("pronos-saved", refreshRanking);

    return () => {
      cancelled = true;
      window.removeEventListener("pronos-updated", refreshRanking);
      window.removeEventListener("pronos-saved", refreshRanking);
    };
  }, []);
  const careerTitles = [
    "Débutant","Apprenti","Novice","Amateur","Confirmé","Régulier","Compétiteur","Averti","Spécialiste","Expert",
    "Stratège","Tacticien","Maître","Élite","Grand Maître","Virtuose","Maître Prono","Champion","Champion confirmé","Champion d'élite",
    "Légendaire","Icône","Icône majeure","Référence","Grand Stratège","Maître absolu","Légende","Légende ultime","Immortel","Icône de la Ligue",
  ] as const;


  const loading = players === null;

  // Statistiques dérivées mémoïsées avec DÉPARTAGE STRICT + ASSIDUITÉ
  const {
    totalPlayers,
    leader,
    avgPoints,
    totalExactScores,
    bestExactScorePlayerId,
    top3,
    others,
  } = useMemo(() => {
      const sortedList = (players ?? [])
        .map((p) => ({
          ...p,
          points: pointsByUser[p.id] ?? 0,
          exactScores: exactScoresByUser[p.id] ?? 0,
          predictionsCount: predictionsCountByUser[p.id] ?? 0,
          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
        
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);
            return {
              careerLevel: result.level,
              careerTitle: careerTitles[Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))],
            };
          })(),}));

      // Tri + attribution du rang : source unique de vérité, réutilisée
      // telle quelle par l'Accueil et le Profil (src/lib/leaderboardRanking.ts)
      // pour qu'un joueur ait toujours le même rang partout.
      const list: RankedPlayer[] = rankPlayers(sortedList);

      const total = list.length;
      const sumPoints = list.reduce((sum, p) => sum + p.points, 0);
      const sumExact = list.reduce((sum, p) => sum + p.exactScores, 0);
      const maxExact = list.reduce((max, p) => Math.max(max, p.exactScores), 0);
      // Total de pronostics tous joueurs confondus — simple somme de
      // `predictionsCount` (déjà calculé par joueur ci-dessus), pour la
      // barre d'infos sous le podium. Aucun nouveau calcul métier.
      const sumPredictions = list.reduce((sum, p) => sum + p.predictionsCount, 0);

      const othersPlayers = list.slice(3);

      return {
        ranked: list,
        totalPlayers: total,
        leader: list[0],
        avgPoints: total > 0 ? sumPoints / total : 0,
        totalExactScores: sumExact,
        totalPredictions: sumPredictions,
        bestExactScorePlayerId: maxExact > 0 ? list.find((p) => p.exactScores === maxExact)?.id ?? null : null,
        top3: list.slice(0, 3),
        others: othersPlayers,
      };
    }, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]);


  const avgExact = totalPlayers > 0 ? totalExactScores / totalPlayers : 0;

  return (
    <AppShell>
      <main className="relative mx-auto w-full max-w-[1400px] overflow-hidden px-3 pb-28 pt-2 sm:px-5 lg:px-8">
        {/* Ambient depth */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] overflow-hidden">
          <div className="absolute left-1/2 top-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.035] blur-[110px]" />
          <div className="absolute left-[12%] top-[260px] h-[280px] w-[280px] rounded-full bg-emerald-400/[0.025] blur-[100px]" />
          <div className="absolute right-[8%] top-[300px] h-[280px] w-[280px] rounded-full bg-amber-400/[0.025] blur-[100px]" />
        </div>

        {/* =========================================================
            HEADER — editorial / competition identity
           ========================================================= */}
        <header className="relative z-10 mx-auto max-w-5xl pt-4 text-center sm:pt-7">
          <div className="mb-3 flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-[0.32em] text-slate-500">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-slate-600" />
            <span>Prono Ligue 1 LM</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-slate-600" />
          </div>

          <h1 className="font-display text-[clamp(2.25rem,7vw,4.6rem)] font-black uppercase leading-[0.88] tracking-[-0.045em] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,.45)]">
            Classement
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] font-bold uppercase tracking-[0.16em] sm:text-xs">
            <span className="text-emerald-300">{currentMatchday.label}</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-300">Saison {season}</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-500">Classement général</span>
          </div>

          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Les meilleurs pronostiqueurs de la compétition, classés aux points.
          </p>
        </header>

        {loading && (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-emerald-300" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">Chargement du classement</p>
            </div>
          </div>
        )}

        {!loading && totalPlayers === 0 && (
          <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-white/[0.07] bg-[#07101d]/70 p-12 text-center backdrop-blur-xl">
            <Trophy className="mx-auto mb-4 h-9 w-9 text-slate-600" />
            <p className="font-display text-lg font-bold text-slate-300">Aucun joueur inscrit</p>
            <p className="mt-1 text-xs text-slate-600">Le classement apparaîtra dès les premières inscriptions.</p>
          </div>
        )}

        {!loading && totalPlayers > 0 && (
          <>
            {/* =====================================================
                HERO PODIUM — scene, not card
               ===================================================== */}
            <section className="relative mt-4 sm:mt-5">
              <div className="relative mx-auto max-w-[1120px]">
                {/* Desktop scene */}
                <div
                  className="relative hidden overflow-visible sm:block"
                  style={{ aspectRatio: "1.9 / 1" }}
                >
                  <div
                    className="absolute inset-[-4%_-2%_-5%] bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: "url('/images/podium/podium-banners-stadium.png')",
                      maskImage:
                        "linear-gradient(to bottom, transparent 0%, black 7%, black 91%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, transparent 0%, black 7%, black 91%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
                      WebkitMaskComposite: "source-in",
                      maskComposite: "intersect",
                    }}
                  />

                  <div className="absolute inset-0">
                    {top3.map((p) => {
                      const team = p.favorite_team_id ? teamsById[p.favorite_team_id] : undefined;
                      const isMe = p.id === user?.id;
                      const rankStyle =
                        p.rank === 1
                          ? {
                              left: "50%",
                              top: "26%",
                              width: "25%",
                              transform: "translateX(-50%)",
                              tone: "text-amber-100",
                              point: "text-amber-300",
                              avatarBorder: "border-amber-200/70",
                              avatarGlow: "shadow-[0_10px_32px_rgba(245,190,50,.28)]",
                              medalSize: "clamp(42px,5vw,68px)",
                              avatarSize: "clamp(54px,6.4vw,94px)",
                              nameSize: "clamp(.8rem,1.5vw,1.08rem)",
                              pointsSize: "clamp(1.9rem,3.8vw,3.7rem)",
                            }
                          : p.rank === 2
                            ? {
                                left: "22.8%",
                                top: "30%",
                                width: "19%",
                                transform: "translateX(-50%)",
                                tone: "text-sky-100",
                                point: "text-sky-50",
                                avatarBorder: "border-slate-200/60",
                                avatarGlow: "shadow-[0_8px_24px_rgba(203,213,225,.22)]",
                                medalSize: "clamp(34px,4vw,54px)",
                                avatarSize: "clamp(46px,5.4vw,80px)",
                                nameSize: "clamp(.68rem,1.2vw,.94rem)",
                                pointsSize: "clamp(1.55rem,3vw,3rem)",
                              }
                            : {
                                left: "77.2%",
                                top: "30%",
                                width: "19%",
                                transform: "translateX(-50%)",
                                tone: "text-orange-100",
                                point: "text-orange-50",
                                avatarBorder: "border-orange-200/55",
                                avatarGlow: "shadow-[0_8px_24px_rgba(251,146,60,.2)]",
                                medalSize: "clamp(34px,4vw,54px)",
                                avatarSize: "clamp(46px,5.4vw,80px)",
                                nameSize: "clamp(.68rem,1.2vw,.94rem)",
                                pointsSize: "clamp(1.55rem,3vw,3rem)",
                              };

                      const nameScale = podiumNameScale(p.pseudo ?? "Joueur");

                      return (
                        <div
                          key={p.id}
                          className="absolute flex flex-col items-center text-center"
                          style={{
                            left: rankStyle.left,
                            top: rankStyle.top,
                            width: rankStyle.width,
                            transform: rankStyle.transform,
                          }}
                        >
                          {/* Médaille (+ couronne pour le 1er) */}
                          <div
                            className="relative flex shrink-0 items-center justify-center"
                            style={{ width: rankStyle.medalSize, height: rankStyle.medalSize }}
                          >
                            {p.rank === 1 && (
                              <Crown className="absolute -top-[60%] h-[52%] w-[52%] fill-amber-300 text-amber-200 drop-shadow-[0_0_14px_rgba(245,190,50,.55)]" />
                            )}
                            <RankMedal rank={p.rank as 1 | 2 | 3} scope="desktop" className="drop-shadow-[0_6px_14px_rgba(0,0,0,.45)]" />
                          </div>

                          {/* Avatar */}
                          <div
                            className={`mt-2.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[#081020]/90 ${rankStyle.avatarBorder} ${rankStyle.avatarGlow}`}
                            style={{ width: rankStyle.avatarSize, height: rankStyle.avatarSize }}
                          >
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-display text-base font-black text-white/90">
                                {(p.pseudo ?? "?").slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Nom — réduit automatiquement plutôt que d'être coupé */}
                          <div
                            className={`mt-2.5 w-full overflow-hidden whitespace-nowrap text-ellipsis px-1 font-display font-black leading-tight ${rankStyle.tone}`}
                            style={{ fontSize: nameScale === 1 ? rankStyle.nameSize : `calc(${rankStyle.nameSize} * ${nameScale})` }}
                          >
                            {p.pseudo ?? "Joueur"}
                          </div>

                          {/* Logo du club — jamais le nom de l'équipe */}
                          <div className="mt-1.5 flex h-5 items-center justify-center">
                            {team?.logo_url ? (
                              <img src={team.logo_url} alt="" className="h-5 w-5 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,.65)]" />
                            ) : (
                              <span className="h-5 w-5 rounded-full border border-white/10 bg-white/5" />
                            )}
                          </div>

                          {/* Points — l'information dominante */}
                          <div
                            className={`mt-1.5 font-display font-black leading-none tracking-tight ${rankStyle.point}`}
                            style={{ fontSize: rankStyle.pointsSize }}
                          >
                            {p.points}
                          </div>
                          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/55 sm:text-[10px]">PTS</div>

                          {/* Exacts — nettement secondaire */}
                          <div className="mt-1.5 font-mono text-[7px] font-bold uppercase tracking-[0.18em] text-white/50 sm:text-[9px]">
                            {p.exactScores} exact{p.exactScores > 1 ? "s" : ""}
                          </div>

                          {isMe && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-emerald-200">
                              <ShieldCheck className="h-2.5 w-2.5" /> Vous
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile podium — purpose-built, no desktop scaling */}
                <div className="sm:hidden">
                  <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#050b16]/80 px-2 pb-4 pt-4 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(245,190,50,.12),transparent_65%)]" />
                    <div className="relative grid grid-cols-3 items-end gap-1">
                      {[2, 1, 3].map((rank) => {
                        const p = top3.find((x) => x.rank === rank);
                        if (!p) return <div key={rank} />;
                        const team = p.favorite_team_id ? teamsById[p.favorite_team_id] : undefined;
                        const first = rank === 1;
                        const isMe = p.id === user?.id;
                        return (
                          <div
                            key={p.id}
                            className={`relative flex flex-col items-center rounded-2xl border px-1.5 pb-3 pt-2.5 ${
                              first
                                ? "min-h-[240px] border-amber-300/40 bg-gradient-to-b from-amber-300/[0.12] to-black/30 shadow-[0_0_45px_rgba(245,190,50,.08)]"
                                : rank === 2
                                  ? "min-h-[205px] border-sky-300/25 bg-gradient-to-b from-sky-300/[0.08] to-black/30"
                                  : "min-h-[205px] border-orange-300/25 bg-gradient-to-b from-orange-300/[0.07] to-black/30"
                            }`}
                          >
                            {/* Médaille (+ couronne pour le 1er) */}
                            <div className={`relative flex shrink-0 items-center justify-center ${first ? "h-9 w-9" : "h-7 w-7"}`}>
                              {first && (
                                <Crown className="absolute -top-4 h-5 w-5 fill-amber-300 text-amber-200 drop-shadow-[0_0_12px_rgba(245,190,50,.5)]" />
                              )}
                              <RankMedal rank={rank as 1 | 2 | 3} scope="mobile" className="drop-shadow-[0_4px_10px_rgba(0,0,0,.4)]" />
                            </div>

                            {/* Avatar */}
                            <div
                              className={`mt-1.5 flex items-center justify-center overflow-hidden rounded-full border border-white/30 bg-[#091120] ${
                                first ? "h-12 w-12" : "h-10 w-10"
                              }`}
                            >
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-display text-xs font-black text-white">{(p.pseudo ?? "?").slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>

                            {/* Nom — réduit automatiquement plutôt que d'être coupé */}
                            <span
                              className="mt-1.5 block w-full overflow-hidden whitespace-nowrap text-ellipsis px-1 text-center font-display font-black text-white"
                              style={{ fontSize: `calc(${first ? "11px" : "10px"} * ${podiumNameScale(p.pseudo ?? "Joueur")})` }}
                            >
                              {p.pseudo ?? "Joueur"}
                            </span>

                            {/* Logo du club — jamais le nom de l'équipe */}
                            <div className="mt-1.5 h-4">
                              {team?.logo_url && <img src={team.logo_url} alt="" className="h-4 w-4 object-contain" />}
                            </div>

                            {/* Points — l'information dominante */}
                            <div
                              className={`mt-2 font-display font-black ${first ? "text-2xl text-amber-300" : rank === 2 ? "text-xl text-sky-50" : "text-xl text-orange-50"}`}
                            >
                              {p.points}
                            </div>
                            <span className="font-mono text-[7px] font-bold uppercase tracking-wider text-white/45">pts</span>

                            {/* Exacts — nettement secondaire */}
                            <span className="mt-1.5 font-mono text-[7px] uppercase tracking-wider text-white/45">{p.exactScores} exacts</span>
                            {isMe && <span className="mt-1.5 rounded-full border border-emerald-300/30 px-1.5 py-0.5 font-mono text-[7px] text-emerald-200">VOUS</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Soft transition into the content below */}
                <div className="pointer-events-none absolute inset-x-8 -bottom-4 h-20 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,.08),transparent_68%)] blur-2xl" />
              </div>
            </section>

            {/* =====================================================
                LIGHT TRANSITION — no duplicate section title, just a rule
               ===================================================== */}
            <div className="relative z-10 mx-auto mt-6 flex max-w-6xl items-center gap-3 px-1 sm:mt-8">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              <span className="whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-slate-500">
                Classement actuel · {totalPlayers} joueur{totalPlayers > 1 ? "s" : ""}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            </div>

            {/* =====================================================
                CARTES JOUEURS — même identité premium que le podium
               ===================================================== */}
            <section className="relative z-10 mx-auto mt-4 max-w-6xl sm:mt-5">
              {/* Column labels */}
              <div className="hidden grid-cols-[64px_minmax(0,1fr)_104px_92px_136px_60px] items-center gap-3 px-5 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-700 sm:grid">
                <span>#</span>
                <span>Joueur</span>
                <span className="text-center">Points</span>
                <span className="text-center">Exacts</span>
                <span>Régularité</span>
                <span className="text-center">Forme</span>
              </div>

              <div className="space-y-3">
                {others.map((p) => {
                  const team = p.favorite_team_id ? teamsById[p.favorite_team_id] : undefined;
                  const isMe = p.id === user?.id;
                  const ratio = p.predictionsCount > 0 ? Math.round((p.regularitySuccess / p.predictionsCount) * 100) : 0;
                  const hasBestExact = bestExactScorePlayerId === p.id;
                  const trend = p.rank <= 5 ? "up" : p.rank >= Math.max(8, totalPlayers - 2) ? "down" : "same";
                  const trendTone =
                    trend === "up"
                      ? "border-emerald-300/25 bg-emerald-300/[0.06]"
                      : trend === "down"
                        ? "border-rose-300/25 bg-rose-300/[0.06]"
                        : "border-white/[0.08] bg-white/[0.02]";

                  return (
                    <article
                      key={p.id}
                      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-xl transition-all duration-300 hover:-translate-y-[2px] ${
                        isMe
                          ? "border-emerald-300/25 from-[#0c1a26]/92 via-[#0a1420]/88 to-[#060d17]/92 shadow-[0_0_0_1px_rgba(52,211,153,.05),0_18px_38px_rgba(0,0,0,.35)]"
                          : "border-white/[0.08] from-[#0b1524]/92 via-[#0a1420]/86 to-[#060d17]/92 shadow-[0_14px_32px_rgba(0,0,0,.3)] hover:border-white/[0.14]"
                      }`}
                    >
                      {/* Halo discret pour "Vous" — pas de grosse bordure verte */}
                      {isMe && <div className="pointer-events-none absolute -inset-px rounded-2xl bg-emerald-300/[0.05] blur-md" />}

                      {/* Texture très légère inspirée du grillage du stade */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-60"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(135deg, rgba(255,255,255,0.014) 0px, rgba(255,255,255,0.014) 1px, transparent 1px, transparent 9px)",
                        }}
                      />
                      {/* Reflet supérieur + légère lumière latérale */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/[0.05] to-transparent" />
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-sky-400/[0.04] to-transparent" />

                      <div className="relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[64px_minmax(0,1fr)_104px_92px_136px_60px] sm:gap-3 sm:px-5 sm:py-4">
                        {/* Position — petit bloc premium, pas un chiffre nu */}
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.07] to-black/30 font-mono text-xs font-black text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_4px_10px_rgba(0,0,0,.4)] sm:h-12 sm:w-12 sm:text-sm">
                          <span className="absolute inset-x-1.5 top-0.5 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                          {String(p.rank).padStart(2, "0")}
                        </div>

                        {/* Joueur — avatar + logo club en badge, nom + titre */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative h-11 w-11 shrink-0 sm:h-[52px] sm:w-[52px]">
                            <div className="h-full w-full overflow-hidden rounded-full border border-white/15 bg-[#0a1423] shadow-[0_6px_16px_rgba(0,0,0,.4)]">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center font-display text-xs font-black text-white/70">
                                  {(p.pseudo ?? "?").slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {team?.logo_url && (
                              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[#050b16] shadow-[0_2px_6px_rgba(0,0,0,.5)]">
                                <img src={team.logo_url} alt="" className="h-3.5 w-3.5 object-contain" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-display text-sm font-black text-white sm:text-base">{p.pseudo ?? "Joueur"}</span>
                              {isMe && (
                                <span className="hidden shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-emerald-200 sm:inline-flex">
                                  Vous
                                </span>
                              )}
                              {hasBestExact && (
                                <span title="Meilleur total de scores exacts" className="hidden shrink-0 text-amber-300 sm:inline-flex">
                                  <Sparkles className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                            <span className="mt-1 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider text-slate-400">
                              {p.careerTitle} · Niv. {p.careerLevel}
                            </span>
                          </div>
                        </div>

                        {/* Points — toujours visible, l'info dominante */}
                        <div className="text-right sm:text-center">
                          <div className="font-display text-2xl font-black leading-none text-white drop-shadow-[0_0_16px_rgba(110,231,183,.16)] sm:text-3xl">
                            {p.points}
                          </div>
                          <div className="mt-1 font-mono text-[7px] font-bold uppercase tracking-widest text-emerald-300/60 sm:text-center">pts</div>
                        </div>

                        {/* Exacts — desktop uniquement, repris dans la bande mobile plus bas */}
                        <div className="hidden text-center sm:flex sm:flex-col sm:items-center">
                          <div className="flex items-center gap-1 text-sky-200">
                            <Target className="h-3.5 w-3.5" />
                            <span className="font-display text-lg font-black">{p.exactScores}</span>
                          </div>
                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-slate-600">exacts</div>
                        </div>

                        {/* Régularité — jauge fine turquoise, desktop uniquement */}
                        <div className="hidden sm:block">
                          <div className="mb-1.5 flex items-baseline justify-between gap-2 font-mono text-[7px] uppercase tracking-wider text-slate-500">
                            <span className="font-bold text-slate-300">{p.regularitySuccess}/{p.predictionsCount}</span>
                            <span>régularité</span>
                          </div>
                          <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-gradient-to-r from-teal-300/70 to-emerald-300/60" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>

                        {/* Évolution — vraie flèche, animation au survol, desktop uniquement */}
                        <div className="hidden sm:flex sm:items-center sm:justify-center">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110 ${trendTone}`}>
                            {trend === "up" ? (
                              <ArrowUp className="h-4 w-4 text-emerald-300 transition-transform duration-300 group-hover:-translate-y-0.5" />
                            ) : trend === "down" ? (
                              <ArrowDown className="h-4 w-4 text-rose-300 transition-transform duration-300 group-hover:translate-y-0.5" />
                            ) : (
                              <Minus className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bande mobile — exacts / régularité / évolution, sans scroll horizontal */}
                      <div className="relative flex items-center gap-3 border-t border-white/[0.05] px-3 py-2.5 sm:hidden">
                        <div className="flex items-center gap-1 text-sky-200">
                          <Target className="h-3 w-3" />
                          <span className="font-mono text-[10px] font-bold">{p.exactScores}</span>
                          <span className="font-mono text-[7px] uppercase tracking-wider text-slate-600">exacts</span>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="shrink-0 font-mono text-[7px] text-slate-500">{p.regularitySuccess}/{p.predictionsCount}</span>
                          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-gradient-to-r from-teal-300/70 to-emerald-300/60" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${trendTone}`}>
                          {trend === "up" ? (
                            <ArrowUp className="h-3 w-3 text-emerald-300" />
                          ) : trend === "down" ? (
                            <ArrowDown className="h-3 w-3 text-rose-300" />
                          ) : (
                            <Minus className="h-3 w-3 text-slate-500" />
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}