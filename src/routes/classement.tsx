import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { PlayerCard, type PlayerCardData, type ExtraBadge } from "@/components/prono/PlayerCard";
import { PodiumBoard, type PodiumEntry } from "@/components/prono/PodiumBoard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTeamTheme } from "@/hooks/useTeamTheme";
import { matchday as currentMatchday } from "@/lib/prono-data";

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
// Système de récupération Supabase et logique de points INCHANGÉS par
// rapport à la version précédente de cette page : mêmes tables (profiles,
// app_settings, matches, predictions), même règle de calcul.
// ============================================================
type PlayerProfile = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
  favorite_team_id: string | null;
};

type TeamRow = { id: string; name: string; short_name: string | null; logo_url: string | null };

type RankedPlayer = PlayerProfile & {
  rank: number;
  points: number;
  exactScores: number;
};

/** Résultat 1/N/2 réel d'un match terminé, à partir du score final. */
function matchResult(home: number | null, away: number | null): "1" | "N" | "2" | null {
  if (home == null || away == null) return null;
  if (home > away) return "1";
  if (home < away) return "2";
  return "N";
}

function ClassementPage() {
  const { user } = useAuth();
  // Thème de l'équipe favorite du VIEWER (utilisateur connecté) — même
  // design system que l'accueil et /pronostics (src/lib/team-theme.ts).
  // Utilisé uniquement comme accent personnel ("Toi") sur le podium et la
  // liste : le reste de la page garde la palette bleu nuit / cyan du site.
  const { theme: viewerTheme } = useTeamTheme();

  // null = chargement initial, [] = chargé mais aucun joueur
  const [players, setPlayers] = useState<PlayerProfile[] | null>(null);
  const [teamsById, setTeamsById] = useState<Record<string, TeamRow>>({});
  const [season, setSeason] = useState("2026-2027");
  const [pointsByUser, setPointsByUser] = useState<Record<string, number>>({});
  // Les "scores exacts" (2 pts) supposent un score prédit enregistré, pas
  // seulement 1/N/2 — donnée non encore persistée par /pronostics (voir
  // handleSave, qui n'envoie que `pick`). Structure prête : dès que ce
  // pipeline existera, il suffira de peupler ce total avec les vraies valeurs.
  const exactScoresByUser: Record<string, number> = {};

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: profilesData }, { data: teamsData }, { data: settingsData }, { data: finishedMatches }] = await Promise.all([
        supabase.from("profiles").select("id, pseudo, avatar_url, favorite_team_id"),
        // Table `teams` — même source que /profil et /accueil (voir useTeamTheme.ts) :
        // le blason affiché sur le podium vient d'ici via favorite_team_id, jamais
        // d'un logo statique.
        supabase.from("teams").select("id, name, short_name, logo_url"),
        supabase.from("app_settings").select("season").eq("id", 1).maybeSingle(),
        supabase.from("matches").select("id, home_score, away_score").eq("status", "finished"),
      ]);

      if (cancelled) return;
      if (settingsData?.season) setSeason(settingsData.season);

      const teamsMap: Record<string, TeamRow> = {};
      (teamsData ?? []).forEach((t: TeamRow) => {
        teamsMap[t.id] = t;
      });
      setTeamsById(teamsMap);

      const matches = finishedMatches ?? [];
      const points: Record<string, number> = {};

      if (matches.length > 0) {
        const matchIds = matches.map((m: { id: string }) => m.id);
        // NB : si la RLS de `predictions` limite la lecture aux lignes de
        // l'utilisateur connecté, seuls ses propres bons pronostics seront
        // comptabilisés ici — les autres joueurs resteront à 0 plutôt que
        // d'afficher une donnée inventée.
        const { data: predictions } = await supabase
          .from("predictions")
          .select("user_id, match_id, pick")
          .in("match_id", matchIds);

        if (!cancelled && predictions) {
          const resultByMatch = new Map(
            matches.map((m: { id: string; home_score: number | null; away_score: number | null }) => [
              m.id,
              matchResult(m.home_score, m.away_score),
            ]),
          );
          predictions.forEach((pred: { user_id: string; match_id: string; pick: string }) => {
            const result = resultByMatch.get(pred.match_id);
            if (result && pred.pick === result) {
              points[pred.user_id] = (points[pred.user_id] ?? 0) + 1;
            }
          });
        }
      }

      if (!cancelled) {
        setPlayers(profilesData ?? []);
        setPointsByUser(points);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = players === null;

  // Statistiques dérivées mémoïsées — ne se recalculent que si la liste de
  // joueurs ou les points changent (pas à chaque rendu, ex. frappe clavier
  // ailleurs sur la page, changement de thème...).
  const { ranked, totalPlayers, leader, avgPoints, totalExactScores, seasonNotStarted, bestExactScorePlayerId } =
    useMemo(() => {
      const list: RankedPlayer[] = (players ?? [])
        .map((p) => ({
          ...p,
          points: pointsByUser[p.id] ?? 0,
          exactScores: exactScoresByUser[p.id] ?? 0,
        }))
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.exactScores - a.exactScores ||
            (a.pseudo ?? "").localeCompare(b.pseudo ?? ""),
        )
        .map((p, i) => ({ ...p, rank: i + 1 }));

      const total = list.length;
      const sumPoints = list.reduce((sum, p) => sum + p.points, 0);
      const sumExact = list.reduce((sum, p) => sum + p.exactScores, 0);
      const maxExact = list.reduce((max, p) => Math.max(max, p.exactScores), 0);

      return {
        ranked: list,
        totalPlayers: total,
        leader: list[0],
        avgPoints: total > 0 ? sumPoints / total : 0,
        totalExactScores: sumExact,
        seasonNotStarted: total > 0 && sumPoints === 0 && sumExact === 0,
        bestExactScorePlayerId: maxExact > 0 ? list.find((p) => p.exactScores === maxExact)?.id ?? null : null,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players, pointsByUser]);

  const podium = ranked.slice(0, 3);
  const others = ranked.slice(3);

  const podiumEntries: PodiumEntry[] = podium.map((p) => ({
    player: toCardData(p, teamsById),
    isMe: p.id === user?.id,
    badges: cardBadges(p, bestExactScorePlayerId),
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 pb-32">
        {/* ================= HERO — STADE DE NUIT (100% CSS, sans image) ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-b from-[#060b16] to-[#03050b] p-6 md:p-10 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          {/* Halo bleu nuit / cyan — statique, fait partie de l'identité du site (pas du thème équipe). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 12% -10%, rgba(56,189,248,0.16), transparent 70%), radial-gradient(ellipse 45% 40% at 95% 110%, rgba(59,130,246,0.10), transparent 70%)",
            }}
          />
          {/* Projecteurs stylisés (deux faisceaux, purement CSS) */}
          <div aria-hidden className="pointer-events-none absolute -top-20 left-6 h-64 w-40 -rotate-[22deg] bg-gradient-to-b from-cyan-200/10 to-transparent blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -top-20 right-6 h-64 w-40 rotate-[22deg] bg-gradient-to-b from-sky-200/10 to-transparent blur-2xl" />
          {/* Lignes HUD, très discrètes */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 64px)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 64px)" }}
          />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-sky-300">
                <span className="size-1.5 rounded-full bg-sky-400" />
                CLASSEMENT OFFICIEL
              </span>
              <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.4rem)] uppercase leading-none tracking-tight text-white">
                🏆 Classement Général
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Saison {season} • {currentMatchday.label} • {totalPlayers} joueur{totalPlayers !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
              <StatTile emoji="👥" label="Joueurs" value={totalPlayers} />
              <StatTile emoji="👑" label="Leader" value={leader?.pseudo || "—"} />
              <StatTile emoji="📊" label="Moy. points" value={avgPoints.toFixed(1)} />
              <StatTile emoji="🎯" label="Scores exacts" value={totalExactScores} />
            </div>
          </div>
        </section>

        {loading && <p className="py-16 text-center font-mono text-sm text-slate-500">Chargement du classement…</p>}

        {!loading && totalPlayers === 0 && (
          <p className="py-16 text-center font-mono text-sm text-slate-500">Aucun joueur inscrit pour le moment.</p>
        )}

        {!loading && totalPlayers > 0 && (
          <>
            {seasonNotStarted && (
              <p className="text-center font-mono text-[11px] text-slate-500">
                La saison n'a pas encore commencé — les points s'activeront dès que les résultats des matchs seront validés.
              </p>
            )}

            {/* ================= PODIUM — image /podium-bg.png (socles or/argent/bronze), horizontal desktop / empilé mobile ================= */}
            <section className="pt-4">
              <PodiumBoard entries={podiumEntries} viewerTheme={viewerTheme} />
            </section>

            {/* ================= LISTE DES AUTRES JOUEURS (#4+) ================= */}
            {others.length > 0 && (
              <section className="space-y-4">
                {others.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={toCardData(p, teamsById)}
                    isMe={p.id === user?.id}
                    viewerTheme={viewerTheme}
                    badges={cardBadges(p, bestExactScorePlayerId)}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function toCardData(p: RankedPlayer, teamsById: Record<string, TeamRow>): PlayerCardData {
  const team = p.favorite_team_id ? teamsById[p.favorite_team_id] : undefined;
  return {
    id: p.id,
    pseudo: p.pseudo,
    avatarUrl: p.avatar_url,
    // Blason réel depuis Supabase (table `teams`, via favorite_team_id) —
    // jamais de logo générique/statique. `null` si le joueur n'a pas encore
    // choisi de club favori via /profil, ou si la table n'a pas (encore)
    // chargé : PlayerCard masque proprement le badge dans ce cas.
    favoriteTeam: team ? { name: team.name, shortName: team.short_name, logoUrl: team.logo_url } : null,
    rank: p.rank,
    // Aucun instantané de classement de la journée précédente n'est stocké
    // en base pour l'instant : `null` fait afficher "➡ —" (voir
    // EvolutionIndicator dans PlayerCard.tsx) plutôt qu'une valeur inventée.
    previousRank: null,
    points: p.points,
    exactScores: p.exactScores,
  };
}

/** Badges additionnels réellement justifiés par une donnée en base (❤️ équipe
 * favorite est géré automatiquement par PlayerCard à partir de favoriteTeamId).
 * Voir Badge.tsx pour le pourquoi de champion/streak absents. */
function cardBadges(p: RankedPlayer, bestExactScorePlayerId: string | null): ExtraBadge[] {
  const badges: ExtraBadge[] = [];
  if (bestExactScorePlayerId === p.id) badges.push({ kind: "exactKing", label: "Roi exact" });
  return badges;
}

function StatTile({ emoji, label, value }: { emoji: string; label: string; value: string | number }) {
  return (
    <div className="flex min-w-[128px] flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md px-5 py-4 text-center">
      <span className="text-xl leading-none">{emoji}</span>
      <span className="truncate font-display text-2xl font-black leading-none text-white">{value}</span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}
