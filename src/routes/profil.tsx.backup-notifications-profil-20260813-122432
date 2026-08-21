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
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { supabase } from "@/lib/supabase";
import { resizeImageToDataUrl } from "@/lib/resizeImage";
import { useAuth } from "@/context/AuthContext";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { getTeamWallpaperUrl, getTeamWallpaperSlug } from "@/lib/team-wallpapers";

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
  const [tempSelectedTeam, setTempSelectedTeam] = useState("");
  const [isEditingTeam, setIsEditingTeam] = useState(false);

  const favoriteTeamName = teams.find((t) => t.id === favoriteTeamId)?.name || "";

  const [favoriteTeamOverride, setFavoriteTeamOverride] = useState(false);
  const [deadlineStr, setDeadlineStr] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [autoLock, setAutoLock] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);

  // Statistiques personnelles — alimentées par Supabase.
  const [userStats, setUserStats] = useState({
    rank: 0,
    points: 0,
    exactScores: 0,
    successRate: "0%",
    totalPronos: 0,
    bestDay: "-",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
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

        if (cancelled) return;
        setUser(session.user);

        const [
          { data: profile, error: profileError },
          { data: teamsData, error: teamsError },
          { data: settingsData, error: settingsError },
          { data: allPredictionsData, error: predictionsError },
          { data: matchesData, error: matchesError },
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
            .select("favorite_team_deadline, favorite_team_auto_lock")
            .eq("id", 1)
            .maybeSingle(),

          supabase
            .from("predictions")
            .select("user_id,match_id,points,home_prediction,away_prediction"),

          supabase
            .from("matches")
            .select("id,matchday,status,home_score,away_score"),
        ]);

        if (profileError) throw profileError;
        if (teamsError) throw teamsError;
        if (settingsError) throw settingsError;
        if (predictionsError) throw predictionsError;
        if (matchesError) throw matchesError;

        if (cancelled) return;

        if (profile) {
          setUsername(profile.pseudo || "Red evils");
          setFavoriteTeamOverride(Boolean(profile.favorite_team_override));
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

        // Classement : recalculé à partir de `predictions` (tous les joueurs)
        const allPredictions = (allPredictionsData || []) as Array<{
          user_id: string | null;
          match_id: string | null;
          points: number | null;
          home_prediction: number | null;
          away_prediction: number | null;
        }>;

        const matchScoreById = new Map<string, { home_score: number | null; away_score: number | null }>();
        (matchesData || []).forEach((match: any) => {
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

        const rankingMap = new Map<string, number>();
        const exactMap = new Map<string, number>();
        const countMap = new Map<string, number>();

        allPredictions.forEach((prediction) => {
          if (!prediction.user_id) return;
          rankingMap.set(
            prediction.user_id,
            (rankingMap.get(prediction.user_id) || 0) + Number(prediction.points || 0)
          );
          exactMap.set(
            prediction.user_id,
            (exactMap.get(prediction.user_id) || 0) + (isExactPrediction(prediction) ? 1 : 0)
          );
          countMap.set(prediction.user_id, (countMap.get(prediction.user_id) || 0) + 1);
        });

        const allUserIds = new Set(rankingMap.keys());
        allUserIds.add(session.user.id);

        const rankedRows = Array.from(allUserIds)
          .map((uid) => ({
            user_id: uid,
            total_points: rankingMap.get(uid) || 0,
            exact_scores: exactMap.get(uid) || 0,
            predictions_count: countMap.get(uid) || 0,
          }))
          .sort(
            (a, b) =>
              b.total_points - a.total_points ||
              b.exact_scores - a.exact_scores ||
              b.predictions_count - a.predictions_count
          );

        let previousPoints: number | null = null;
        let currentRank = 0;
        const rankedWithPosition = rankedRows.map((row, idx) => {
          if (previousPoints !== row.total_points) currentRank = idx + 1;
          previousPoints = row.total_points;
          return { ...row, rank: currentRank };
        });

        const meRanking = rankedWithPosition.find(
          (row) => row.user_id === session.user.id
        );

        const rank = meRanking?.rank || 0;
        const totalPoints = Number(meRanking?.total_points || 0);
        const exactScores = Number(meRanking?.exact_scores || 0);

        const predictions = allPredictions.filter(
          (prediction) => prediction.user_id === session.user.id
        );

        const matches = (matchesData || []) as Array<{
          id: string;
          matchday: number | string | null;
          status: string | null;
        }>;

        const matchDayById = new Map<string, string>();
        matches.forEach((match) => {
          if (match.matchday !== null && match.matchday !== undefined) {
            matchDayById.set(String(match.id), `J${match.matchday}`);
          }
        });

        const pointsByDay = new Map<string, number>();
        const predictionsByDay = new Map<string, number>();
        predictions.forEach((prediction) => {
          const day = matchDayById.get(String(prediction.match_id));
          if (!day) return;
          pointsByDay.set(
            day,
            (pointsByDay.get(day) || 0) + Number(prediction.points || 0)
          );
          predictionsByDay.set(
            day,
            (predictionsByDay.get(day) || 0) + 1
          );
        });

        let bestDay = "-";
        let bestDayPoints = -1;
        pointsByDay.forEach((points, day) => {
          if (points > bestDayPoints) {
            bestDayPoints = points;
            bestDay = day;
          }
        });

        const playedDays = predictionsByDay.size;
        const successfulPredictions = predictions.filter(
          (prediction) => Number(prediction.points || 0) > 0
        ).length;
        const successRate =
          predictions.length > 0
            ? `${Math.round((successfulPredictions / predictions.length) * 100)}%`
            : "0%";

        setUserStats({
          rank,
          points: totalPoints,
          exactScores,
          successRate,
          totalPronos:
            Number(meRanking?.predictions_count ?? predictions.length) || 0,
          bestDay,
        });

        if (profile?.favorite_team_id) {
          setTempSelectedTeam(profile.favorite_team_id);
        }
      } catch (err) {
        console.error("Erreur de chargement Supabase du profil :", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);
  const isLocked = autoLock && deadlineDate && new Date() > deadlineDate && !favoriteTeamOverride;

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
    if (!user || isLocked || !tempSelectedTeam) return;
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
                    Supprimer
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
              <p className="mt-2 text-sm text-slate-400">
                Joueur actif de la Prono Ligue 1
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Activity className="size-3.5" />
                Saison 2026–2027
              </div>

              {/* 4 stats compactes */}
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">Classement</span>
                  <div className="mt-1 font-display text-3xl font-black text-white">{userStats.rank}</div>
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
                  Saison 2026–2027
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
                      Classement : #{userStats.rank}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                      <Target className="size-3 text-emerald-400" />
                      Saison 2026–2027
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
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-400">
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