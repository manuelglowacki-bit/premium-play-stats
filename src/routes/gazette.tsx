import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Lightbulb,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMatches, getMatchdays } from "@/services/adminService";

export const Route = createFileRoute("/gazette")({
  head: () => ({
    meta: [
      { title: "La Gazette — Prono Ligue 1" },
      {
        name: "description",
        content: "La Gazette de votre championnat de pronostics.",
      },
    ],
  }),
  component: GazettePage,
});

type Profile = {
  id: string;
  email?: string | null;
  player_name?: string | null;
  pseudo?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
};

type Journee = {
  id: string;
  number: number | string;
  title: string;
  matches: any[];
  bonus: any[];
};

// Pronostics d'un joueur, indexés directement par match_id — predictions.match_id
// référence matches.id (voir pronostics.tsx), donc plus besoin d'appareillage
// flou par nom d'équipe ni de regroupement par journée pour retrouver un prono.
type PlayerPronos = {
  favoriteTeam: string;
  byMatch: Map<string, any>;
};

type PlayerStats = {
  id: string;
  name: string;
  avatar: string;
  total: number;
  favoritePoints: number;
  bonusPoints: number;
  normalPoints: number;
  favoriteExacts: number;
  bonusExacts: number;
  exacts: number;
  attempts: number;
  corrects: number;
  successRate: number;
  lastPoints: number;
  byJournee: { journee: number; points: number }[];
  rank: number;
  oldRank: number;
  evolution: number;
};

type DayMatch = {
  match: any;
  journee: Journee;
  isBonus: boolean;
};

function clean(value: any) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sameClub(a: any, b: any) {
  const ca = clean(a);
  const cb = clean(b);
  return Boolean(ca && cb && (ca === cb || ca.includes(cb) || cb.includes(ca)));
}

function getTeamHome(match: any) {
  return (
    match?.home_team ??
    match?.home ??
    match?.domicile ??
    match?.equipeDomicile ??
    match?.homeTeam ??
    match?.club1 ??
    match?.equipe1 ??
    ""
  );
}

function getTeamAway(match: any) {
  return (
    match?.away_team ??
    match?.away ??
    match?.exterieur ??
    match?.equipeExterieur ??
    match?.awayTeam ??
    match?.club2 ??
    match?.equipe2 ??
    ""
  );
}

function getScoreHome(match: any) {
  return (
    match?.homeScore ??
    match?.scoreHome ??
    match?.score_domicile ??
    match?.domicileScore ??
    match?.result?.home ??
    match?.home_score ??
    null
  );
}

function getScoreAway(match: any) {
  return (
    match?.awayScore ??
    match?.scoreAway ??
    match?.score_exterieur ??
    match?.exterieurScore ??
    match?.result?.away ??
    match?.away_score ??
    null
  );
}

function hasScore(match: any) {
  const h = Number(getScoreHome(match));
  const a = Number(getScoreAway(match));
  return Number.isFinite(h) && Number.isFinite(a);
}

function getResult1N2(home: any, away: any): "1" | "N" | "2" | null {
  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return "1";
  if (h < a) return "2";
  return "N";
}

// Le pick 1N2 d'un pronostic : soit renseigné directement (liste principale),
// soit dérivé du score exact (club de cœur / bonus — voir pronostics.tsx qui
// stocke déjà les deux). `pick` prime, le score sert de repli défensif.
function pickResult(prono: any): "1" | "N" | "2" | "" {
  if (!prono) return "";
  const p = String(prono.pick ?? "").toUpperCase();
  if (p === "1" || p === "N" || p === "2") return p;
  return getResult1N2(prono.home_score, prono.away_score) || "";
}

// Score exact uniquement pertinent pour les pronostics "club de cœur"/bonus :
// les picks 1N2 classiques n'ont jamais home_score/away_score renseignés,
// donc cette fonction retourne naturellement false pour eux.
function isExactPrediction(match: any, prono: any): boolean {
  if (!prono || prono.home_score == null || prono.away_score == null) return false;
  if (!hasScore(match)) return false;
  return (
    Number(prono.home_score) === Number(getScoreHome(match)) &&
    Number(prono.away_score) === Number(getScoreAway(match))
  );
}

function getFavoriteTeamValue(value: any) {
  if (!value) return "Non choisi";

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return (
        parsed.favoriteTeam ??
        parsed.club ??
        parsed.team ??
        parsed.equipe ??
        Object.values(parsed).find(Boolean) ??
        "Non choisi"
      );
    }
  } catch {
    return String(value);
  }

  return String(value);
}

function isFavoriteMatch(match: any, favoriteTeam: string) {
  if (!favoriteTeam || favoriteTeam === "Non choisi") return false;
  return (
    sameClub(getTeamHome(match), favoriteTeam) ||
    sameClub(getTeamAway(match), favoriteTeam)
  );
}

function sortRanking(
  a: Omit<PlayerStats, "rank" | "oldRank" | "evolution">,
  b: Omit<PlayerStats, "rank" | "oldRank" | "evolution">
) {
  return (
    b.total - a.total ||
    b.exacts - a.exacts ||
    b.attempts - a.attempts ||
    a.name.localeCompare(b.name, "fr")
  );
}

function calculatePlayer(
  profile: Profile,
  playerPronos: PlayerPronos | undefined,
  journees: Journee[],
  scoredJournees: number[],
  lastJournee: number,
  onlyBeforeLast = false
): Omit<PlayerStats, "rank" | "oldRank" | "evolution"> {
  const byMatch = playerPronos?.byMatch;
  const favoriteTeam = playerPronos?.favoriteTeam || "Non choisi";

  let total = 0;
  let favoritePoints = 0;
  let bonusPoints = 0;
  let normalPoints = 0;
  let favoriteExacts = 0;
  let bonusExacts = 0;
  let attempts = 0;
  let corrects = 0;
  let lastPoints = 0;

  const byJournee = scoredJournees.map((num) => ({
    journee: num,
    points: 0,
  }));

  journees.forEach((journee) => {
    const isLast = Number(journee.number) === Number(lastJournee);
    if (onlyBeforeLast && isLast) return;

    let dayPoints = 0;

    // Barème aligné sur classement.tsx : 1 point par pick 1N2 correct (le
    // pronostic "club de cœur" en score exact compte pour le même point s'il
    // donne le bon résultat — aucun bonus de points pour l'exact ici, la
    // distinction favori ne sert qu'à ventiler l'affichage de la Gazette).
    (journee.matches || []).forEach((match) => {
      if (!hasScore(match)) return;

      const prono = byMatch?.get(String(match.id));
      if (!prono) return;

      const favorite = isFavoriteMatch(match, favoriteTeam);
      const pick = pickResult(prono);
      const real = getResult1N2(getScoreHome(match), getScoreAway(match));
      const correct = Boolean(pick) && pick === real;
      const points = correct ? 1 : 0;

      attempts += 1;
      if (correct) corrects += 1;
      total += points;
      dayPoints += points;

      if (favorite) {
        favoritePoints += points;
        if (isExactPrediction(match, prono)) favoriteExacts += 1;
      } else {
        normalPoints += points;
      }
    });

    // Matchs bonus : exclus du total, comme dans classement.tsx ("les matchs
    // bonus ayant leur propre système de points séparé"). On garde des
    // compteurs informatifs (bonusPoints/bonusExacts) pour les rubriques
    // dédiées de la Gazette, jamais ajoutés à `total`/`attempts`/`corrects`.
    // Seul le match bonus effectivement choisi par le joueur a une prediction
    // (les autres candidats de la journée n'en ont aucune) — pas besoin de
    // retrouver une "sélection" séparée.
    (journee.bonus || []).forEach((match) => {
      if (!hasScore(match)) return;

      const prono = byMatch?.get(String(match.id));
      if (!prono) return;

      const pick = pickResult(prono);
      const real = getResult1N2(getScoreHome(match), getScoreAway(match));
      const correct = Boolean(pick) && pick === real;

      if (correct) bonusPoints += 1;
      if (isExactPrediction(match, prono)) bonusExacts += 1;
    });

    const day = byJournee.find(
      (item) => Number(item.journee) === Number(journee.number)
    );
    if (day) day.points += dayPoints;

    if (isLast) lastPoints += dayPoints;
  });

  const name = profile.pseudo || "Joueur";

  return {
    id: profile.id,
    name,
    avatar: profile.avatar_url || "",
    total,
    favoritePoints,
    bonusPoints,
    normalPoints,
    favoriteExacts,
    bonusExacts,
    exacts: favoriteExacts + bonusExacts,
    attempts,
    corrects,
    successRate: attempts ? Math.round((corrects / attempts) * 100) : 0,
    lastPoints,
    byJournee,
  };
}

function GazettePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [journees, setJournees] = useState<Journee[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predictionsByUser, setPredictionsByUser] = useState<
    Map<string, PlayerPronos>
  >(new Map());

  const scrollerRef = useRef<HTMLDivElement>(null);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [
        { data: competitionsData, error: competitionsError },
        matchdaysData,
        matchesData,
        { data: bonusOptionsData, error: bonusOptionsError },
        { data: profileData, error: profileError },
        { data: predictionData, error: predictionError },
      ] = await Promise.all([
        supabase.from("competitions").select("id, external_code, code"),
        // Déjà triées par number, mêmes fonctions que admin.tsx/adminService.ts.
        getMatchdays(),
        // Paginée (>1000 lignes gérées) — même fonction que l'onglet admin.
        getMatches(),
        supabase
          .from("bonus_options")
          .select("matchday_id, match_id")
          .eq("is_active", true),
        // IMPORTANT : select("*") évite les anciennes colonnes
        // player_name / account_status qui n'existent plus dans la base.
        supabase
          .from("profiles")
          .select("*")
          .order("pseudo", { ascending: true, nullsFirst: false }),
        // Les pronostics sont maintenant dans predictions.
        supabase.from("predictions").select("*"),
      ]);

      if (competitionsError) throw competitionsError;
      if (bonusOptionsError) throw bonusOptionsError;
      if (profileError) throw profileError;
      if (predictionError) throw predictionError;

      // Filtre Ligue 1 : même pattern que pronostics.tsx — les matchdays des
      // 4 championnats bonus (PL/PD/SA/BL1) partagent le même format de code
      // ("J1", "J2"...), donc on scope explicitement par competition_id
      // plutôt que par code/numéro.
      const ligue1CompetitionId = (competitionsData ?? []).find(
        (c: any) => c.external_code === "FL1" || c.code === "FL1"
      )?.id;

      const ligue1Matchdays = (matchdaysData ?? []).filter(
        (md: any) => md.competition_id === ligue1CompetitionId
      );

      const matchesById = new Map<string, any>();
      const matchesByMatchday = new Map<string, any[]>();

      (matchesData ?? []).forEach((match: any) => {
        matchesById.set(String(match.id), match);

        if ((match.match_type ?? "LIGUE1") !== "LIGUE1") return;
        if (!match.matchday_id) return;

        const list = matchesByMatchday.get(match.matchday_id) ?? [];
        list.push(match);
        matchesByMatchday.set(match.matchday_id, list);
      });

      // Le match bonus réellement retenu pour une journée n'est pas marqué
      // par un flag sur `matches` (is_bonus n'indique que "appartient à une
      // compétition bonus", pas "sélectionné") — il faut passer par
      // bonus_options (jusqu'à 4 candidats actifs par journée, un par
      // championnat, cf. bonusOptionsService.ts).
      const bonusMatchesByMatchday = new Map<string, any[]>();

      (bonusOptionsData ?? []).forEach((option: any) => {
        const match = matchesById.get(String(option.match_id));
        if (!match) return;

        const list = bonusMatchesByMatchday.get(option.matchday_id) ?? [];
        list.push(match);
        bonusMatchesByMatchday.set(option.matchday_id, list);
      });

      const normalized: Journee[] = ligue1Matchdays
        .map((matchday: any) => ({
          id: matchday.id,
          number: matchday.number,
          title: `J${matchday.number}`,
          matches: matchesByMatchday.get(matchday.id) ?? [],
          bonus: bonusMatchesByMatchday.get(matchday.id) ?? [],
        }))
        .sort((a, b) => Number(a.number) - Number(b.number));

      const profilesLoaded = (profileData || []) as Profile[];
      const predictions = predictionData || [];

      // predictions.match_id référence directement matches.id (voir
      // pronostics.tsx) : indexation directe, aucun appareillage flou requis.
      const predictionsMap = new Map<string, PlayerPronos>();

      profilesLoaded.forEach((profile: any) => {
        predictionsMap.set(profile.id, {
          favoriteTeam: getFavoriteTeamValue(
            profile.favorite_team ?? profile.favorite_team_id ?? null
          ),
          byMatch: new Map(),
        });
      });

      predictions.forEach((prediction: any) => {
        const entry = predictionsMap.get(prediction?.user_id);
        if (!entry || !prediction?.match_id) return;
        entry.byMatch.set(String(prediction.match_id), prediction);
      });

      setJournees(normalized);
      setProfiles(profilesLoaded);
      setPredictionsByUser(predictionsMap);

      if (normalized.length) {
        const scored = normalized.filter((journee) =>
          [...journee.matches, ...journee.bonus].some(hasScore)
        );

        const lastScored = scored.length - 1;
        setSelectedDayIndex(
          Math.max(
            0,
            normalized.indexOf(scored[lastScored] || normalized[0])
          )
        );
      }
    } catch (err: any) {
      setError(err?.message || "Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = window.setInterval(() => loadData(true), 300000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedJournee = journees[selectedDayIndex];

  const scoredJournees = useMemo(
    () =>
      [...new Set(
        journees
          .filter((j) => [...j.matches, ...j.bonus].some(hasScore))
          .map((j) => Number(j.number))
          .filter(Boolean)
      )].sort((a, b) => a - b),
    [journees]
  );

  const lastJournee = scoredJournees[scoredJournees.length - 1] || 1;

  const allStats = useMemo(() => {
    const current = profiles
      .map((profile) =>
        calculatePlayer(
          profile,
          predictionsByUser.get(profile.id),
          journees,
          scoredJournees,
          lastJournee
        )
      )
      .sort(sortRanking)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const beforeLast = profiles
      .map((profile) =>
        calculatePlayer(
          profile,
          predictionsByUser.get(profile.id),
          journees,
          scoredJournees,
          lastJournee,
          true
        )
      )
      .sort(sortRanking)
      .map((item, index) => ({
        id: item.id,
        oldRank: index + 1,
      }));

    return current.map((item) => {
      const old = beforeLast.find((entry) => entry.id === item.id);
      const oldRank = old?.oldRank || item.rank;

      return {
        ...item,
        oldRank,
        evolution: oldRank - item.rank,
      };
    });
  }, [
    profiles,
    predictionsByUser,
    journees,
    scoredJournees,
    lastJournee,
  ]);

  const selectedDayMatches = useMemo<DayMatch[]>(
    () =>
      selectedJournee
        ? [
            ...selectedJournee.matches.map((match) => ({
              match,
              journee: selectedJournee,
              isBonus: false,
            })),
            ...selectedJournee.bonus.map((match) => ({
              match,
              journee: selectedJournee,
              isBonus: true,
            })),
          ].filter(({ match }) => hasScore(match))
        : [],
    [selectedJournee]
  );

  const dayPredictionStats = useMemo(() => {
    const distribution = {
      "1": 0,
      N: 0,
      "2": 0,
    };

    let totalPredictions = 0;
    let totalExact = 0;

    const matchRows: {
      dayMatch: DayMatch;
      picks: { result: string; exact: boolean }[];
    }[] = [];

    profiles.forEach((profile) => {
      const playerPronos = predictionsByUser.get(profile.id);

      selectedDayMatches.forEach((dayMatch) => {
        const prono = playerPronos?.byMatch.get(String(dayMatch.match.id));
        if (!prono) return;

        const pick = pickResult(prono);
        const exact = isExactPrediction(dayMatch.match, prono);

        if (pick === "1" || pick === "N" || pick === "2") {
          distribution[pick] += 1;
          totalPredictions += 1;
        }

        if (exact) totalExact += 1;

        let row = matchRows.find(
          (entry) => entry.dayMatch.match === dayMatch.match
        );
        if (!row) {
          row = { dayMatch, picks: [] };
          matchRows.push(row);
        }

        row.picks.push({ result: pick || "", exact });
      });
    });

    return {
      distribution,
      totalPredictions,
      totalExact,
      matchRows,
    };
  }, [profiles, predictionsByUser, selectedDayMatches]);

  const dynamicStats = useMemo(() => {
    const matches = dayPredictionStats.matchRows;

    const bestExact = [...allStats]
      .sort(
        (a, b) =>
          (b.byJournee.find(
            (d) => Number(d.journee) === Number(selectedJournee?.number)
          )?.points || 0) -
            (a.byJournee.find(
              (d) => Number(d.journee) === Number(selectedJournee?.number)
            )?.points || 0) ||
          b.exacts - a.exacts
      )[0];

    const bestExactDay = [...allStats]
      .map((player) => {
        const day = player.byJournee.find(
          (item) => Number(item.journee) === Number(selectedJournee?.number)
        );
        return {
          player,
          dayPoints: day?.points || 0,
        };
      })
      .sort((a, b) => b.dayPoints - a.dayPoints)[0]?.player;

    const bestExactCount = [...allStats]
      .map((player) => {
        const playerPronos = predictionsByUser.get(player.id);

        let exacts = 0;
        selectedDayMatches.forEach(({ match }) => {
          const prono = playerPronos?.byMatch.get(String(match.id));
          if (isExactPrediction(match, prono)) exacts += 1;
        });

        return { player, exacts };
      })
      .sort((a, b) => b.exacts - a.exacts)[0];

    const remontee = [...allStats].sort(
      (a, b) => b.evolution - a.evolution
    )[0];

    const totalVotes = dayPredictionStats.totalPredictions;
    const homePct = totalVotes
      ? Math.round((dayPredictionStats.distribution["1"] / totalVotes) * 100)
      : 0;
    const drawPct = totalVotes
      ? Math.round((dayPredictionStats.distribution.N / totalVotes) * 100)
      : 0;
    const awayPct = Math.max(0, 100 - homePct - drawPct);

    const surpriseCandidates = matches
      .map((row) => {
        const actual = getResult1N2(
          getScoreHome(row.dayMatch.match),
          getScoreAway(row.dayMatch.match)
        );

        const votes = row.picks.filter(
          (pick) => pick.result === actual
        ).length;

        return {
          ...row,
          actual,
          votes,
          percentage: row.picks.length
            ? Math.round((votes / row.picks.length) * 100)
            : 100,
        };
      })
      .filter((row) => row.actual)
      .sort((a, b) => a.percentage - b.percentage)[0];

    const flopCandidates = matches
      .map((row) => {
        const lost = row.picks.filter((pick) => !pick.exact).length;
        return {
          ...row,
          lost,
        };
      })
      .sort((a, b) => b.lost - a.lost)[0];

    return {
      bestExactPlayer:
        bestExactCount?.exacts
          ? bestExactCount.player
          : bestExactDay || bestExact || null,
      bestExactCount: bestExactCount?.exacts || 0,
      remontee,
      homePct,
      drawPct,
      awayPct,
      surprise: surpriseCandidates || null,
      flop: flopCandidates || null,
      totalVotes,
      totalExact: dayPredictionStats.totalExact,
    };
  }, [
    allStats,
    dayPredictionStats,
    selectedJournee,
    selectedDayMatches,
    predictionsByUser,
  ]);

  const supportersStats = useMemo(() => {
    const counts: Record<string, number> = {};

    profiles.forEach((profile) => {
      const team = predictionsByUser.get(profile.id)?.favoriteTeam || "Non choisi";

      if (team && team !== "Non choisi") {
        counts[team] = (counts[team] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [profiles, predictionsByUser]);

  const topSupporterText = supportersStats.length
    ? supportersStats
        .map(
          ({ team, count }) =>
            `${count} ${count > 1 ? "joueurs" : "joueur"} pour ${team}`
        )
        .join(" • ")
    : "Les données des supporters apparaîtront dès que les équipes de cœur seront renseignées.";

  const scroll = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: direction * 240,
      behavior: "smooth",
    });
  };

  const nextDay = journees[selectedDayIndex + 1]?.title || "—";

  const cardData = useMemo(() => {
    const surprise = dynamicStats.surprise;
    const flop = dynamicStats.flop;
    const remontee = dynamicStats.remontee;
    const best = dynamicStats.bestExactPlayer;

    const surpriseHome = surprise
      ? getTeamHome(surprise.dayMatch.match)
      : "—";
    const surpriseAway = surprise
      ? getTeamAway(surprise.dayMatch.match)
      : "—";

    const flopHome = flop ? getTeamHome(flop.dayMatch.match) : "—";
    const flopAway = flop ? getTeamAway(flop.dayMatch.match) : "—";

    const flopScore = flop
      ? `${getScoreHome(flop.dayMatch.match)}–${getScoreAway(
          flop.dayMatch.match
        )}`
      : "—";

    return {
      chiffre: {
        value: `${dynamicStats.homePct}%`,
        text: (
          <>
            des pronostics indiquent une
            <br />
            <span className="text-emerald-300">
              victoire à domicile.
            </span>
          </>
        ),
      },
      surprise: {
        value: `${surprise?.percentage ?? 0}%`,
        text: (
          <>
            seulement {surprise?.percentage ?? 0}% avaient
            <br />
            trouvé le résultat{" "}
            <span className="text-amber-300">
              {surprise ? `${surpriseHome} ${surprise.actual}` : "surprise"}.
            </span>
          </>
        ),
        teams: `${surpriseHome} — ${surpriseAway}`,
      },
      flop: {
        value: flopScore,
        text: (
          <>
            <span className="font-bold text-white">
              {flopHome} — {flopAway}
            </span>
            <br />
            le match qui a fait perdre
            <br />
            le plus de points.
          </>
        ),
      },
      remontee: {
        value: `${Math.max(0, remontee?.evolution || 0) > 0 ? "+" : ""}${remontee?.evolution || 0}`,
        suffix: "PLACES",
        text: (
          <>
            {remontee?.name || "—"} gagne{" "}
            <span className="text-emerald-300">
              {Math.max(0, remontee?.evolution || 0)} place(s)
            </span>
            <br />
            au classement.
          </>
        ),
      },
      exact: {
        value: String(dynamicStats.bestExactCount),
        text: (
          <>
            {best?.name || "Aucun joueur"}{" "}
            {dynamicStats.bestExactCount > 1
              ? "a trouvé"
              : "a trouvé"}{" "}
            {dynamicStats.bestExactCount} score(s) exact(s)
            <br />
            cette journée.
          </>
        ),
      },
    };
  }, [dynamicStats]);

  const donut = {
    home: dynamicStats.homePct,
    draw: dynamicStats.drawPct,
    away: dynamicStats.awayPct,
  };

  const circumference = 2 * Math.PI * 47;
  const homeDash = (donut.home / 100) * circumference;
  const drawDash = (donut.draw / 100) * circumference;
  const awayDash = (donut.away / 100) * circumference;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-6xl overflow-hidden pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[#030914]" />
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/background-l1.png')" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,.72),#030914_32%,#030914_100%)]" />
        </div>

        <div className="relative z-10 px-3 pt-4 md:px-5 md:pt-6">
          {/* HEADER */}
          <section
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07111e]"
            style={{
              backgroundImage: "url('/bloc%20la%20gazette.png')",
              backgroundSize: "cover",
              backgroundPosition: "center center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative flex min-h-[155px] items-center justify-between gap-6 px-5 py-7 md:px-8">
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                  <img
                    src="/logo%20ligue%201%20white.png"
                    alt="Ligue 1"
                    className="h-10 w-auto object-contain"
                  />
                </div>

                <div>
                  <h1 className="font-display text-4xl font-black uppercase tracking-[-0.03em] text-white md:text-6xl">
                    La Gazette
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-5 text-slate-400">
                    Toute l'actualité, les analyses et les tendances
                    <br />
                    de votre saison de <span className="text-lime-300">Ligue 1.</span>
                  </p>
                </div>
              </div>

              <div className="hidden text-right sm:block">
                <div className="font-mono text-[9px] tracking-[.25em] text-slate-600">
                  ÉDITION
                </div>
                <div className="mt-1 font-display text-4xl font-black text-white">
                  {selectedJournee?.title || "—"}
                </div>
                <div className="mt-1 flex items-center justify-end gap-2 font-mono text-[9px] font-bold tracking-widest text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {loading ? "CHARGEMENT" : "EN LIGNE"}
                </div>
              </div>
            </div>
          </section>

          {/* SELECTEUR */}
          {journees.length === 0 && !loading ? (
            <section className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#07111e] px-4 py-8 text-center md:px-7">
              <p className="font-mono text-[11px] font-bold tracking-[.14em] text-slate-400">
                Aucun calendrier disponible pour le moment.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Reviens un peu plus tard, la Gazette se met à jour dès que les journées sont publiées.
              </p>
            </section>
          ) : journees.length > 0 && (
            <section
              className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#07111e]"
              style={{
                backgroundImage: "url('/bloc%20la%20gazette.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="relative px-4 py-5 md:px-7 md:py-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-mono text-[9px] font-bold tracking-[.22em] text-slate-300 md:text-[10px]">
                    SÉLECTIONNE TA JOURNÉE
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="size-1.5 rounded-full bg-lime-300" />
                    <span className="font-mono text-[8px] font-bold tracking-[.16em] text-lime-300">
                      STATS EN DIRECT
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => scroll(-1)}
                    aria-label="Journée précédente"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#07111e]/80 text-slate-400 transition hover:border-white/20 hover:text-white"
                  >
                    <ChevronLeft className="size-5" />
                  </button>

                  <div
                    ref={scrollerRef}
                    className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="flex min-w-max gap-2.5 md:gap-3">
                      {journees.map((journee, index) => {
                        const active = index === selectedDayIndex;
                        const scored = [...journee.matches, ...journee.bonus].some(hasScore);

                        return (
                          <button
                            key={journee.id}
                            type="button"
                            onClick={() => setSelectedDayIndex(index)}
                            className={`relative flex h-[76px] w-[118px] shrink-0 flex-col items-center justify-center rounded-2xl border transition-all duration-200 md:h-[82px] md:w-[132px] ${
                              active
                                ? "border-emerald-400 bg-[#061b18]/90 text-white"
                                : "border-white/[0.08] bg-[#07111e]/80 text-slate-300 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            {active && (
                              <span className="absolute -top-2 rounded-full bg-emerald-400 px-2 py-0.5 font-mono text-[6px] font-black tracking-[.14em] text-[#04120e]">
                                ACTIVE
                              </span>
                            )}

                            <span className={`font-display text-2xl font-black leading-none ${
                              active ? "text-emerald-300" : "text-white"
                            }`}>
                              {journee.title}
                            </span>

                            <span className={`mt-2 font-mono text-[7px] font-bold tracking-[.12em] ${
                              scored ? "text-emerald-200/70" : "text-slate-600"
                            }`}>
                              {scored ? "DONNÉES DISPONIBLES" : "À VENIR"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => scroll(1)}
                    aria-label="Journée suivante"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#07111e]/80 text-slate-400 transition hover:border-white/20 hover:text-white"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {loading ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-[#07101c]/95 py-20 text-center">
              <div className="mx-auto size-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
              <p className="mt-4 font-mono text-xs text-slate-500">
                Connexion aux statistiques des joueurs...
              </p>
            </div>
          ) : error ? (
            <div className="mt-5 rounded-3xl border border-red-400/20 bg-[#160b10]/95 p-8 text-center">
              <p className="font-mono text-xs text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => loadData()}
                className="mt-4 rounded-xl border border-red-400/30 px-4 py-2 font-mono text-[9px] font-bold text-red-300"
              >
                RÉESSAYER
              </button>
            </div>
          ) : (
            <>
              {/* 6 RUBRIQUES */}
              <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/le%20chiffre%20de%20la%20journee.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full min-h-[190px] items-center justify-start p-5 text-left">
                    <div>
                      <div className="flex items-center justify-start gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-emerald-300">
                        <BarChart3 className="size-4" />
                        LE CHIFFRE DE LA JOURNÉE
                      </div>
                      <div className="mt-4 font-display text-5xl font-black text-white md:text-6xl">
                        {cardData.chiffre.value}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        {cardData.chiffre.text}
                      </p>
                      <button className="mt-4 rounded-md border border-emerald-300/30 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold text-emerald-300">
                        Voir plus <ChevronRight className="ml-1 inline size-3" />
                      </button>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/le%20prono%20surprise.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full min-h-[190px] items-center justify-start p-5 text-left">
                    <div>
                      <div className="flex items-center justify-start gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-amber-300">
                        <Lightbulb className="size-4" />
                        LE PRONO SURPRISE
                      </div>
                      <div className="mt-4 font-display text-5xl font-black text-white md:text-6xl">
                        {cardData.surprise.value}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        {cardData.surprise.text}
                        <br />
                        <span className="text-amber-300">
                          {cardData.surprise.teams}
                        </span>
                      </p>
                      <button className="mt-4 rounded-md border border-amber-300/30 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold text-amber-300">
                        Voir plus <ChevronRight className="ml-1 inline size-3" />
                      </button>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/le%20flop%20de%20la%20semaine.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full min-h-[190px] items-center justify-start p-5 text-left">
                    <div>
                      <div className="flex items-center justify-start gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-red-300">
                        <Flame className="size-4" />
                        LE FLOP DE LA JOURNÉE
                      </div>
                      <div className="mt-4 font-display text-5xl font-black text-white md:text-6xl">
                        {cardData.flop.value}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        {cardData.flop.text}
                      </p>
                      <button className="mt-4 rounded-md border border-red-300/30 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold text-red-300">
                        Voir plus <ChevronRight className="ml-1 inline size-3" />
                      </button>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/la%20remonte%20de%20la%20semaine.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full min-h-[190px] items-center justify-start p-5 text-left">
                    <div>
                      <div className="flex items-center justify-start gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-emerald-300">
                        <TrendingUp className="size-4" />
                        LA REMONTÉE DE LA SEMAINE
                      </div>
                      <div className="mt-4 font-display text-5xl font-black text-white md:text-6xl">
                        {cardData.remontee.value}
                      </div>
                      <div className="font-display text-sm font-black text-emerald-300">
                        {cardData.remontee.suffix}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        {cardData.remontee.text}
                      </p>
                      <button className="mt-4 rounded-md border border-emerald-300/30 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold text-emerald-300">
                        Voir plus <ChevronRight className="ml-1 inline size-3" />
                      </button>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/meilleur%20score%20exact.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full min-h-[190px] items-center justify-start p-5 text-left">
                    <div>
                      <div className="flex items-center justify-start gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-blue-300">
                        <Target className="size-4" />
                        LE MEILLEUR SCORE EXACT
                      </div>
                      <div className="mt-4 font-display text-5xl font-black text-white md:text-6xl">
                        {cardData.exact.value}
                      </div>
                      <div className="font-display text-sm font-black text-blue-300">
                        SCORES EXACTS
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">
                        {cardData.exact.text}
                      </p>
                      <button className="mt-4 rounded-md border border-blue-300/30 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold text-blue-300">
                        Voir plus <ChevronRight className="ml-1 inline size-3" />
                      </button>
                    </div>
                  </div>
                </article>

                {/* PRONOSTICS DES JOUEURS — DONUT DYNAMIQUE */}
                <article className="relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#07111d]/95">
                  <img
                    src="/les%20pronostics%20des%20joueurs.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25" />

                  <div className="relative z-10 flex h-full min-h-[190px] items-center gap-5 p-5">
                    <div className="relative flex h-[125px] w-[125px] shrink-0 items-center justify-center md:h-[140px] md:w-[140px]">
                      <svg
                        viewBox="0 0 120 120"
                        className="h-full w-full -rotate-90"
                      >
                        <circle
                          cx="60"
                          cy="60"
                          r="47"
                          fill="none"
                          stroke="#172033"
                          strokeWidth="12"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="47"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="12"
                          strokeDasharray={`${homeDash} ${circumference - homeDash}`}
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="47"
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="12"
                          strokeDasharray={`${drawDash} ${circumference - drawDash}`}
                          strokeDashoffset={-homeDash}
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="47"
                          fill="none"
                          stroke="#e879f9"
                          strokeWidth="12"
                          strokeDasharray={`${awayDash} ${circumference - awayDash}`}
                          strokeDashoffset={-(homeDash + drawDash)}
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-3xl font-black leading-none text-white">
                          {donut.home}%
                        </span>
                        <span className="mt-1 font-mono text-[7px] font-bold tracking-[.18em] text-slate-500">
                          DOMICILE
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.14em] text-fuchsia-300">
                        <Users className="size-4 shrink-0" />
                        LES PRONOSTICS DES JOUEURS
                      </div>

                      <div className="mt-4 space-y-2">
                        {[
                          ["Victoire domicile", donut.home, "bg-emerald-400", "text-emerald-300"],
                          ["Nul", donut.draw, "bg-cyan-300", "text-cyan-300"],
                          ["Victoire extérieur", donut.away, "bg-fuchsia-300", "text-fuchsia-300"],
                        ].map(([label, value, dot, color]) => (
                          <div key={String(label)} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${dot}`} />
                              <span className="font-mono text-[9px] text-slate-300">
                                {label}
                              </span>
                            </div>
                            <span className={`font-display text-lg font-black ${color}`}>
                              {value}%
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 font-mono text-[7px] text-slate-600">
                        {dayPredictionStats.totalPredictions} pronostics analysés
                      </div>
                    </div>
                  </div>
                </article>
              </section>


            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}