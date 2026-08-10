import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { resizeImageToDataUrl } from "@/lib/resizeImage";
import {
  Trophy,
  Medal,
  ArrowRight,
  Camera,
  Heart,
  Check,
  ChevronRight,
  Crown,
  Sparkles,
  Star
} from "lucide-react";
import { CountdownBlocks } from "@/components/prono/Countdown";
import { useTeamTheme } from "@/hooks/useTeamTheme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Prono Ligue 1 LM" },
      { name: "description", content: "Tableau de bord principal de ta ligue de pronostics entre amis." },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { favoriteTeamId, saveFavoriteTeam } = useFavoriteTeam();
  const { user, profile, refreshProfile } = useAuth();

  const [teams, setTeams] = useState<any[]>([]);
  const [clubId, setClubId] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myStats, setMyStats] = useState({
    rank: 0,
    points: 0,
    exactScores: 0,
    successRate: 0,
    totalPronos: 0,
    avgPoints: 0,
    bestDay: "-",
    bestDayPoints: 0,
  });
  const [currentMatchday, setCurrentMatchday] = useState("J1");
  const [potAmount, setPotAmount] = useState(0);

  // 1. Liste des équipes
  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase
        .from("teams")
        .select("id, name, short_name, logo_url")
        .order("name");
      if (data) setTeams(data);
    }
    fetchTeams();
  }, []);

  // 2. Données d’accueil (classement, stats, cagnotte) – robuste
  useEffect(() => {
    let cancelled = false;

    async function fetchHomeData() {
      try {
        // On récupère chaque ressource indépendamment pour ne pas tout casser
        const [
          { data: profiles, error: profilesError },
          { data: predictions, error: predictionsError },
          { data: matches, error: matchesError },
          { data: payments, error: paymentsError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            // Si la colonne account_status n'existe pas, la 400 disparaît.
            // Tu pourras la rajouter quand elle sera créée.
            .select("id,pseudo,username,player_name,avatar_url,favorite_team_id"),
          supabase
            .from("predictions")
            .select("user_id,match_id,points,exact_score,updated_at"),
          supabase
            .from("matches")
            .select("id,matchday_code,matchday,match_day,status,kickoff,kickoff_time")
            .order("kickoff", { ascending: true }),
          supabase
            .from("payments")
            .select("amount,paid"),
        ]);

        // On logue les erreurs individuelles mais on continue
        if (profilesError) console.warn("Erreur chargement profils :", profilesError);
        if (predictionsError) console.warn("Erreur chargement pronostics :", predictionsError);
        if (matchesError) console.warn("Erreur chargement matchs :", matchesError);
        if (paymentsError) console.warn("Cagnotte non accessible :", paymentsError);

        if (cancelled) return;

        const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
        const teamById = new Map((teams || []).map((t: any) => [t.id, t]));

        // -------- Calcul du classement à partir des pronostics --------
        const rankingMap = new Map<string, number>();
        const exactMap = new Map<string, number>();
        const countMap = new Map<string, number>();

        (predictions || []).forEach((p: any) => {
          const uid = p.user_id;
          const points = Number(p.points || 0);
          rankingMap.set(uid, (rankingMap.get(uid) || 0) + points);
          exactMap.set(uid, (exactMap.get(uid) || 0) + (p.exact_score ? 1 : 0));
          countMap.set(uid, (countMap.get(uid) || 0) + 1);
        });

        // On complète avec les profils manquants (pour les joueurs sans pronos)
        const allUserIds = new Set(rankingMap.keys());
        (profiles || []).forEach((p: any) => allUserIds.add(p.id));

        const normalizedRankings = Array.from(allUserIds)
          .map((uid) => {
            const p = profileById.get(uid) || {};
            const team = teamById.get(p.favorite_team_id);
            return {
              user_id: uid,
              total_points: rankingMap.get(uid) || 0,
              exact_scores: exactMap.get(uid) || 0,
              predictions_count: countMap.get(uid) || 0,
              name: p.pseudo || p.username || p.player_name || "Joueur",
              avatar_url: p.avatar_url || "",
              favorite_team: team?.name || "",
              favorite_logo: team?.logo_url || "",
            };
          })
          // Tri : points décroissant, puis scores exacts, puis nb pronos
          .sort((a, b) =>
            b.total_points - a.total_points ||
            b.exact_scores - a.exact_scores ||
            a.predictions_count - b.predictions_count
          )
          // On attribue un rang (1er ex-aequo garde le même rang)
          .map((row, idx, arr) => ({
            ...row,
            rank: idx === 0 ? 1 : arr[idx - 1].total_points === row.total_points ? arr[idx - 1].rank : idx + 1,
          }));

        setLeaderboard(normalizedRankings);

        // -------- Journée la plus récente terminée --------
        const finished = (matches || []).filter((m: any) =>
          String(m.status || "").toLowerCase() === "finished" ||
          String(m.status || "").toLowerCase() === "ft"
        );
        const dayNumber = (value: any) => {
          const match = String(value ?? "").match(/\d+/);
          return match ? Number(match[0]) : 0;
        };
        const latest = [...finished].sort((a: any, b: any) =>
          dayNumber(b.matchday_code || b.matchday || b.match_day) -
          dayNumber(a.matchday_code || a.matchday || a.match_day)
        )[0];
        if (latest) {
          const raw = latest.matchday_code || latest.matchday || latest.match_day;
          setCurrentMatchday(String(raw).toUpperCase().startsWith("J") ? String(raw).toUpperCase() : `J${raw}`);
        }

        // -------- Stats personnelles --------
        if (user?.id) {
          const mine = (predictions || []).filter((p: any) => p.user_id === user.id);
          const meRanking = normalizedRankings.find((r: any) => r.user_id === user.id);
          const matchById = new Map((matches || []).map((m: any) => [String(m.id), m]));
          const points = mine.reduce((sum: number, p: any) => sum + Number(p.points || 0), 0);
          const exacts = mine.reduce((sum: number, p: any) => sum + (p.exact_score ? 1 : 0), 0);
          const bons = mine.filter((p: any) => Number(p.points || 0) > 0).length;
          const days = new Set<string>();
          const pointsByDay = new Map<string, number>();

          mine.forEach((p: any) => {
            const m = matchById.get(String(p.match_id));
            if (!m) return;
            const rawDay = m.matchday_code || m.matchday || m.match_day;
            if (rawDay === null || rawDay === undefined || rawDay === "") return;
            const day = String(rawDay).toUpperCase().startsWith("J") ? String(rawDay).toUpperCase() : `J${rawDay}`;
            days.add(day);
            pointsByDay.set(day, (pointsByDay.get(day) || 0) + Number(p.points || 0));
          });

          let bestDay = "-";
          let bestDayPoints = 0;
          pointsByDay.forEach((value, day) => {
            if (value > bestDayPoints) {
              bestDayPoints = value;
              bestDay = day;
            }
          });

          const finalPoints = points;
          const finalExacts = exacts;
          const finalCount = mine.length;
          const rank = meRanking?.rank ?? 0;

          setMyStats({
            rank,
            points: finalPoints,
            exactScores: finalExacts,
            successRate: mine.length ? Math.round((bons / mine.length) * 100) : 0,
            totalPronos: finalCount,
            avgPoints: days.size ? Number((points / days.size).toFixed(1)) : 0,
            bestDay,
            bestDayPoints,
          });
        }

        // -------- Cagnotte --------
        if (!paymentsError) {
          const total = (payments || [])
            .filter((p: any) => Boolean(p.paid))
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          setPotAmount(total);
        }
      } catch (error) {
        console.error("Erreur de chargement Supabase accueil :", error);
      }
    }

    fetchHomeData();
    return () => { cancelled = true; };
  }, [user?.id, teams]);

  // 3. Équipe favorite par défaut
  useEffect(() => {
    if (favoriteTeamId) {
      setClubId(favoriteTeamId);
    } else if (teams.length > 0 && !clubId) {
      const defaultTeam = teams.find(t => t.short_name === 'RCL') || teams[0];
      if (defaultTeam) setClubId(defaultTeam.id);
    }
  }, [favoriteTeamId, teams]);

  const activeClub = teams.find((c) => c.id === clubId);
  const {
    theme: clubTheme,
    backgroundUrl: clubWallpaperUrl,
    backgroundFailed: clubWallpaperFailedProbe,
    onBackgroundError: handleClubWallpaperError,
  } = useTeamTheme(activeClub?.name ?? null);

  const openTeamPicker = () => {
    setPendingTeamId(clubId);
    setIsChangingTeam(true);
  };

  const handleConfirmTeamChange = async () => {
    if (!pendingTeamId) return;
    setSavingTeam(true);
    try {
      await saveFavoriteTeam(pendingTeamId);
      setClubId(pendingTeamId);
      setIsChangingTeam(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("Erreur équipe favorite :", err);
      alert("Impossible d'enregistrer l'équipe.");
    } finally {
      setSavingTeam(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: dataUrl, updated_at: new Date().toISOString() });

      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error("Erreur lors de l'envoi de la photo :", err);
      alert("Erreur lors de l'envoi de la photo de profil.");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <AppShell>
      <div className="relative z-10 mx-auto max-w-6xl pb-20 space-y-6">
        
        {/* HERO SECTION avec Effet Verre */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.7)]">
          <div
            role="img"
            aria-label="Ligue 1"
            className="pointer-events-none absolute inset-0 block"
            style={{
              backgroundImage: "url('/logo-ligue1.png')",
              backgroundSize: "cover",
              backgroundPosition: "center 35%",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d1322] from-0% via-[#0d1322]/70 via-40% to-[#0d1322]/10 to-90%"
          />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] items-center">
            <div className="space-y-5 max-w-full lg:max-w-[56%]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 font-mono text-[10px] font-bold text-emerald-400 tracking-wider">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                SAISON 2026—2027 • LIGUE 1 MCDONALD'S
              </div>
              <h1 className="font-display text-4xl md:text-6xl text-white tracking-tight leading-none">
                PRÉDIS LES RÉSULTATS <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400">
                  DE LA LIGUE 1
                </span>
              </h1>
              <p className="text-sm md:text-base text-slate-400 max-w-xl">
                Affronte tes amis, fais les bons pronos et deviens le champion incontesté de la saison.
              </p>

              <div className="max-w-md rounded-2xl border border-slate-800 bg-[#060b16]/70 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                    Prochaine journée · J1 • 21 août 2026
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> EN APPROCHE
                  </span>
                </div>
                <CountdownBlocks />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/pronostics"
                  className="tap flex items-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-500 px-7 py-4 font-display text-sm font-bold text-slate-950 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                >
                  <Medal size={18} /> Faire mes pronos <ArrowRight size={16} />
                </Link>
                <Link
                  to="/classement"
                  className="tap flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-7 py-4 font-display text-sm font-bold text-white transition-all"
                >
                  <Trophy size={18} className="text-amber-400" /> Voir le classement
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* LIGNE : PROFIL avec Effet Verre */}
        <div className="w-full">
          <div
            className="relative overflow-hidden rounded-3xl border bg-[#0d1322]/75 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors duration-500"
            style={{ borderColor: clubTheme.primary + "40" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                backgroundImage: `url('${clubWallpaperUrl}')`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                filter: "saturate(1.3) brightness(1.08)",
              }}
            />
            {clubTheme.id !== "default" && !clubWallpaperFailedProbe && (
              <img
                src={clubTheme.background}
                alt=""
                className="hidden"
                onError={handleClubWallpaperError}
              />
            )}
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#0d1322]/90 from-0% via-[#0d1322]/60 via-35% to-transparent to-62%" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[62%] z-0 bg-gradient-to-t from-[#0d1322]/70 from-0% via-transparent via-30% to-transparent" />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -left-16 z-0 h-64 w-64 rounded-full blur-[110px]"
              style={{ backgroundColor: clubTheme.glow }}
            />
            <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:pr-[30%] lg:pr-[34%]">
              <div className="flex min-w-0 flex-1 items-center gap-5">
                <div className="relative shrink-0">
                  <div className="size-36 md:size-40 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <div className="size-full rounded-full bg-[#060b16] flex items-center justify-center overflow-hidden border border-slate-800">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-3xl md:text-4xl font-extrabold text-red-500 tracking-wider">{(profile?.pseudo || profile?.username || "JO").slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    title="Changer ma photo de profil"
                    className="tap absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-amber-400 text-slate-950 border-2 border-[#0d1322] shadow-[0_2px_10px_rgba(0,0,0,0.5)] hover:bg-amber-300 transition-colors disabled:opacity-60"
                  >
                    <Camera size={18} className={avatarUploading ? "animate-pulse" : undefined} />
                  </button>
                </div>

                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 mb-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold tracking-widest">
                    <Star size={10} className="fill-amber-400" /> NIVEAU 12
                  </span>
                  <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight truncate">{profile?.pseudo || profile?.username || "Joueur"}</h3>

                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-sm font-bold">
                      <Trophy size={14} /> #{myStats.rank || "—"} du classement
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-mono text-sm font-bold">
                      {myStats.points} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden self-stretch w-px bg-gradient-to-b from-transparent via-slate-500/70 to-transparent md:block" />

              <div className="md:w-72 lg:w-80 md:shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                <span className="font-mono text-[10px] uppercase text-red-400 font-bold tracking-widest flex items-center gap-1.5">
                  <Heart size={12} className="fill-red-400" /> Équipe de cœur
                </span>
                <span
                  className="font-display text-xl md:text-2xl font-bold truncate block mt-1"
                  style={
                    clubTheme.id !== "default"
                      ? {
                          backgroundImage: clubTheme.gradient,
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                        }
                      : { color: "#fff" }
                  }
                >
                  {activeClub?.name || "À choisir"}
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {!isChangingTeam ? (
                  <button
                    type="button"
                    onClick={openTeamPicker}
                    className="tap flex items-center gap-2 rounded-xl border bg-slate-900/80 px-4 py-2 text-xs font-display font-bold text-slate-200 hover:border-red-500/50 hover:text-red-400 transition-all"
                    style={{ borderColor: clubTheme.primary + "55" }}
                  >
                    <Heart size={14} style={{ color: clubTheme.primary }} /> Changer mon équipe
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pendingTeamId}
                      onChange={(e) => setPendingTeamId(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-display font-bold text-white focus:border-red-500 focus:outline-none transition-colors cursor-pointer"
                    >
                      {teams.length === 0 && <option value="">Chargement...</option>}
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleConfirmTeamChange}
                      disabled={!pendingTeamId || savingTeam}
                      className="tap flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-500 px-3.5 py-2 text-xs font-display font-bold text-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={14} /> {savingTeam ? "..." : "Valider"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChangingTeam(false)}
                      className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors px-1"
                    >
                      Annuler
                    </button>
                  </div>
                )}
                {isSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 animate-fade-in">
                    <Check size={14} /> Équipe enregistrée !
                  </span>
                )}
              </div>
              <Link
                to="/profil"
                className="tap group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-display font-bold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <Camera size={14} className="text-emerald-400" /> Gérer mon profil <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION : PODIUM & STATS avec Effet Verre */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url('/images/fond-bloc-accueil.png')" }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0d1322]/20 via-[#0d1322]/35 to-[#0d1322]/55" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className="text-amber-400 animate-pulse" />
                  <span className="font-mono text-[10px] uppercase text-amber-400 font-bold tracking-widest">À l'issue de la {currentMatchday}</span>
                </div>
                <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">Classement général</h3>
              </div>
              <Link 
                to="/classement" 
                className="tap rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2 font-mono text-xs text-slate-200 hover:text-white hover:border-amber-500/50 transition-all shadow-md"
              >
                Complet →
              </Link>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3 items-end pt-10 pb-2 text-center">
              {([0, 1, 2] as number[]).map((index) => {
                const player = leaderboard[index];
                const place = index + 1;
                const isFirst = place === 1;
                const height = isFirst ? "h-48 -translate-y-5" : place === 2 ? "h-36" : "h-28";
                const positionOrder =
                  place === 2 ? "order-1" :
                  place === 1 ? "order-2" :
                  "order-3";
                return (
                  <div
                    key={player?.user_id || `place-${place}`}
                    className={`group relative ${positionOrder} rounded-2xl border ${isFirst ? "border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.25)]" : "border-slate-700/80"} p-4 flex flex-col items-center justify-end pb-6 ${height} transition-all hover:scale-105`}
                  >
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('/images/podium/podium-${place}.png')` }} />
                      <div className="absolute inset-0 bg-black/50" />
                    </div>
                    <span className={`absolute -top-3 size-6 rounded-full ${isFirst ? "bg-amber-400 text-slate-950" : place === 2 ? "bg-slate-700 text-white" : "bg-amber-900/60 text-amber-200"} font-mono font-bold text-[10px] grid place-items-center shadow z-10`}>
                      #{place}
                    </span>
                    <span className={`relative z-10 font-mono text-[10px] uppercase tracking-wider mb-1 ${isFirst ? "text-amber-400 font-bold" : "text-slate-300"}`}>
                      {isFirst ? "1er" : `${place}ème`}
                    </span>
                    {player?.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="relative z-10 size-8 rounded-full object-cover border border-white/20 mb-1" />
                    ) : null}
                    <b className="relative z-10 font-display text-sm md:text-base text-white tracking-tight truncate w-full">
                      {player?.name || "En attente"}
                    </b>
                    <div className={`relative z-10 mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isFirst ? "bg-amber-500/10 border border-amber-500/30 text-amber-300" : "bg-slate-800/90 border border-slate-700 text-slate-300"} font-mono text-xs font-bold`}>
                      {Number(player?.total_points || 0)} pts
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Ligue ultra serrée en tête !</span>
              <span className="text-amber-400 font-bold">Cagnotte : {potAmount.toFixed(0)} €</span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url('/images/fond-bloc-accueil.png')" }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0d1322]/20 via-[#0d1322]/35 to-[#0d1322]/55" />

            <div className="relative z-10 flex items-center justify-between mb-6">
              <div>
                <span className="font-mono text-[10px] uppercase text-blue-400 font-bold">Tes performances</span>
                <h3 className="font-display text-2xl text-white mt-0.5">Statistiques personnelles</h3>
              </div>
              <Link to="/stats" className="tap rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 font-mono text-xs text-slate-300 hover:text-white">
                Tout voir →
              </Link>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div
                className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/stats/stat-bons-pronos.png')" }}
              >
                <div className="absolute inset-0 bg-black/45" />
                <span className="relative font-mono text-[10px] uppercase text-slate-300 block mb-1">Bons pronos</span>
                <strong className="relative block font-display text-3xl text-emerald-400">{myStats.successRate}%</strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">{myStats.totalPronos} pronos</span>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/stats/stat-scores-exacts.png')" }}
              >
                <div className="absolute inset-0 bg-black/45" />
                <span className="relative font-mono text-[10px] uppercase text-slate-300 block mb-1">Scores exacts</span>
                <strong className="relative block font-display text-3xl text-blue-400">{myStats.exactScores}</strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">{myStats.totalPronos ? Math.round((myStats.exactScores / myStats.totalPronos) * 100) : 0}% des pronos</span>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/stats/stat-points-moyens.png')" }}
              >
                <div className="absolute inset-0 bg-black/45" />
                <span className="relative font-mono text-[10px] uppercase text-slate-300 block mb-1">Points moyens</span>
                <strong className="relative block font-display text-3xl text-amber-400">{myStats.avgPoints}</strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">Par journée</span>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/stats/stat-meilleure-journee.png')" }}
              >
                <div className="absolute inset-0 bg-black/45" />
                <span className="relative font-mono text-[10px] uppercase text-slate-300 block mb-1">Meilleure journée</span>
                <strong className="relative block font-display text-3xl text-indigo-400">{myStats.bestDayPoints}</strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">Points • {myStats.bestDay}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
