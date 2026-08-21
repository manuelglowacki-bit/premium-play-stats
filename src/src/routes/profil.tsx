import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { 
  User, Shield, LogOut, Check, Trophy, Target, Flame, 
  Award, Sparkles, Activity, Star, Camera, Trash2, ChevronDown, Lock
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import TeamBadge from "@/components/TeamBadge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// 🌟 1. ON IMPORTE LE HOOK GLOBAL
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { getTeamWallpaperUrl, getTeamWallpaperSlug } from "@/lib/team-wallpapers";

export const Route = createFileRoute("/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Contexte auth partagé : même source de vérité que la carte profil de
  // l'accueil. refreshProfile() propage tout changement d'avatar/pseudo
  // sans attendre un rechargement de page.
  const { refreshProfile } = useAuth();
  
  // Profil classique
  const [username, setUsername] = useState("Red evils");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 2. ON UTILISE LE HOOK AU LIEU DES USESTATE LOCAUX
  const { favoriteTeamId, saveFavoriteTeam } = useFavoriteTeam();
  const [teams, setTeams] = useState<any[]>([]);
  const [tempSelectedTeam, setTempSelectedTeam] = useState("");
  const [isEditingTeam, setIsEditingTeam] = useState(false); // Pour le bouton "Modifier mon choix"

  // Le nom se calcule tout seul en croisant l'ID du hook et la liste des équipes
  const favoriteTeamName = teams.find(t => t.id === favoriteTeamId)?.name || "";

  const [favoriteTeamOverride, setFavoriteTeamOverride] = useState(false);
  const [deadlineStr, setDeadlineStr] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [autoLock, setAutoLock] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);

  // Stats
  const [userStats] = useState({
    rank: 5,
    points: 0,
    exactScores: 0,
    successRate: "0%",
    totalPronos: 0,
    bestDay: "-",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          
          // 1. Charger le profil joueur
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          
          if (profile) {
            setUsername(profile.username || profile.pseudo || "Red evils");
            setFavoriteTeamOverride(profile.favorite_team_override || false);
            setAvatarUrl(profile.avatar_url || "");
          }

          // 2. Récupérer la liste des équipes
          const { data: teamsData } = await supabase
            .from("teams")
            .select("id,name,short_name,logo_url")
            .order("name");

          if (teamsData) {
            setTeams(teamsData);
          }

          // 🌟 3. SUPPRESSION du vieux code qui assignait manuellement l'équipe favorite ici. Le hook gère ça !

          // 4. Charger les réglages globaux
          const { data: settingsData } = await supabase.from("app_settings").select("*");
          if (settingsData) {
            const d = settingsData.find(s => s.key === "favorite_team_deadline");
            const l = settingsData.find(s => s.key === "favorite_team_auto_lock");
            
            if (d) {
              const dateObj = new Date(d.value);
              setDeadlineDate(dateObj);
              setDeadlineStr(
                dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + 
                " " + 
                dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              );
            }
            if (l) setAutoLock(l.value === "true");
          }
        }
      } catch (err) {
        console.error("Erreur de chargement des données :", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const isLocked = autoLock && deadlineDate && new Date() > deadlineDate && !favoriteTeamOverride;

  // Fond d'écran dynamique par équipe : un fichier par club dans
  // public/team-wallpapers/, retrouvé par correspondance de nom (voir
  // src/lib/team-wallpapers.ts). Tant qu'une image spécifique n'a pas été
  // fournie pour un club, on retombe sur le fond stade générique déjà
  // utilisé ailleurs sur le site.
  const teamWallpaperUrl = getTeamWallpaperSlug(favoriteTeamName)
    ? getTeamWallpaperUrl(favoriteTeamName)
    : null;
  const [wallpaperFailed, setWallpaperFailed] = useState(false);
  useEffect(() => {
    setWallpaperFailed(false);
  }, [teamWallpaperUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          username,
          pseudo: username,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      await refreshProfile();
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la mise à jour :", err);
      alert("Erreur lors de la mise à jour du profil.");
    }
  };

  const handleSaveFavoriteTeam = async () => {
    if (!user || isLocked || !tempSelectedTeam) return;
    setSavingTeam(true);

    try {
      // 🌟 4. ON UTILISE LE HOOK POUR SAUVEGARDER
      // Le hook se charge d'alerter le reste du site !
      await saveFavoriteTeam(tempSelectedTeam);
      setIsEditingTeam(false);
    } catch (err) {
      console.error("Erreur équipe favorite :", err);
      alert("Impossible d'enregistrer l'équipe.");
    } finally {
      setSavingTeam(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 pb-32 p-4 md:p-6 text-slate-100 font-sans">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* ================= HERO PROFIL ================= */}
        <section className="relative isolate overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[#030914] shadow-[0_30px_100px_rgba(0,0,0,.52)]">
          {/* FOND 100% DU BLOC MON PROFIL */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-no-repeat bg-[length:100%_100%] bg-center transition-all duration-700"
            style={{
              backgroundImage: `url('${!wallpaperFailed && teamWallpaperUrl ? teamWallpaperUrl : "/profil-background-ligue1.png"}')`,
            }}
          />
          {/* Voile de lisibilité, lui aussi sur 100% du bloc */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(2,7,16,.88)_0%,rgba(2,7,16,.68)_42%,rgba(2,7,16,.30)_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_25%_35%,rgba(34,211,238,.10),transparent_30%),radial-gradient(circle_at_82%_50%,rgba(0,0,0,.12),transparent_40%)]"
          />

          {teamWallpaperUrl && !wallpaperFailed && (
            <img
              src={teamWallpaperUrl}
              alt=""
              className="hidden"
              onError={() => setWallpaperFailed(true)}
            />
          )}

          <div className="relative z-10 grid grid-cols-1 gap-8 p-6 md:p-8 lg:grid-cols-[260px_1fr] lg:p-10">
            {/* Avatar */}
            <div className="flex flex-col items-center justify-center border-b border-white/10 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-fuchsia-500 via-cyan-400 to-lime-300 opacity-25 blur-xl" />
                <div className="relative size-40 rounded-full bg-gradient-to-tr from-fuchsia-500 via-cyan-400 to-lime-300 p-[3px] shadow-[0_0_45px_rgba(34,211,238,.18)] md:size-44">
                  <div className="flex size-full items-center justify-center overflow-hidden rounded-full border-4 border-[#07101d] bg-[#060b16]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                    ) : (
                      <span className="font-display text-5xl font-black tracking-wider text-white">
                        {username ? username.substring(0, 2).toUpperCase() : "RE"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid w-full gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ccff00] py-3 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-[#ccff00]/10 transition hover:bg-[#b8eb00]"
                >
                  <Camera className="size-4" />
                  Modifier la photo
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition hover:border-red-400/30 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                  Supprimer
                </button>
              </div>
            </div>

            {/* Identité + résumé */}
            <div className="flex min-w-0 flex-col justify-between gap-8">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300">
                  <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" />
                  Mon profil
                </div>
                <h1 className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text font-display text-4xl font-black uppercase leading-none tracking-tight text-transparent md:text-6xl">
                  {username}
                </h1>
                <p className="mt-3 text-sm text-slate-300">
                  Joueur actif de la Prono Ligue 1 LM
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <Activity className="size-3.5" />
                  Saison 2026–2027
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#050b15]/75 p-4 backdrop-blur-sm">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Classement</span>
                  <div className="mt-1 font-display text-3xl font-black text-white">{userStats.rank}</div>
                </div>
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 backdrop-blur-sm">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Points</span>
                  <div className="mt-1 font-display text-3xl font-black text-cyan-300">{userStats.points}</div>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/[0.04] p-4 backdrop-blur-sm">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Meilleure journée</span>
                  <div className="mt-1 font-display text-3xl font-black text-fuchsia-300">{userStats.bestDay}</div>
                </div>
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 backdrop-blur-sm">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Équipe de cœur</span>
                  <div className="mt-2 truncate font-display text-sm font-bold text-white">
                    {favoriteTeamName || "Non renseignée"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ================= ÉQUIPE DE CŒUR ================= */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07101d] shadow-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-60 transition-all duration-700"
            style={{
              backgroundImage: `url('${!wallpaperFailed && teamWallpaperUrl ? teamWallpaperUrl : "/profil-background-ligue1.png"}')`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,20,.98)_0%,rgba(5,10,20,.78)_45%,rgba(5,10,20,.42)_100%)]" />

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[.24em] text-amber-300">Saison 2026–2027</span>
                <h2 className="mt-1 font-display text-2xl font-black uppercase text-white md:text-3xl">
                  ⭐ Mon équipe de cœur
                </h2>
              </div>
              {favoriteTeamName && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <Check className="mr-1 inline size-3.5" /> Choix enregistré
                </span>
              )}
            </div>

            {!favoriteTeamId || isEditingTeam ? (
              <div className="mt-6 max-w-3xl">
                <p className="mb-4 text-sm text-slate-400">Choisis ton équipe de cœur :</p>
                {!isLocked ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={tempSelectedTeam}
                      onChange={(e) => setTempSelectedTeam(e.target.value)}
                      className="w-full flex-1 rounded-xl border border-white/10 bg-[#050b15]/90 p-3.5 text-sm text-white outline-none"
                    >
                      <option value="" disabled>Sélectionne un club...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveFavoriteTeam}
                      disabled={!tempSelectedTeam || savingTeam}
                      className="rounded-xl bg-amber-400 px-6 py-3 font-display text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="mr-1 inline size-4" />
                      {savingTeam ? "Enregistrement..." : "Valider"}
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-bold text-red-300">
                    <Lock className="size-4" /> Choix verrouillé
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex size-20 items-center justify-center rounded-2xl border border-white/10 bg-[#050b15]/80 p-3 shadow-xl">
                    <TeamBadge
                      name={favoriteTeamName || "Aucune équipe"}
                      shortName={teams.find((t) => t.id === favoriteTeamId)?.short_name ?? ""}
                      logoUrl={teams.find((t) => t.id === favoriteTeamId)?.logo_url ?? null}
                    />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-black text-white">{favoriteTeamName}</h3>
                    <p className="mt-1 text-xs font-mono text-slate-400">Mon équipe favorite</p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 md:items-end">
                  <div className="text-xs font-mono text-slate-400">
                    Date limite : <strong className="text-slate-200">{deadlineStr || "Non définie"}</strong>
                  </div>
                  {isLocked ? (
                    <span className="flex items-center gap-2 text-xs font-bold text-red-300">
                      <Lock className="size-4" /> Choix verrouillé
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setTempSelectedTeam(favoriteTeamId ?? "");
                        setIsEditingTeam(true);
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-300"
                    >
                      Modifier mon choix
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================= BAS DE PAGE ================= */}
        {/* ================= IDENTITÉ — ULTIMATE PREMIUM ================= */}
        <section className="relative isolate overflow-hidden rounded-[30px] border border-white/[0.12] bg-[#07101d]/95 shadow-[0_25px_80px_rgba(0,0,0,.35)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
          >
            <div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-400/[0.07] blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-emerald-400/[0.05] blur-3xl" />
          </div>

          <div className="relative z-10 p-6 md:p-8 lg:p-9">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[.26em] text-cyan-300">
                  Profil joueur
                </span>
                <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                  Mon identité
                </h2>
                <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-cyan-300 to-emerald-300" />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-slate-400">
                <Shield className="size-3.5 text-emerald-300" />
                Compte sécurisé
              </div>
            </div>

            <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
              {/* Carte joueur */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  <div className="absolute -inset-3 rounded-full bg-cyan-400/[0.07] blur-2xl" />
                  <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#050b15]/80 shadow-[0_20px_50px_rgba(0,0,0,.35)]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="size-full object-cover"
                      />
                    ) : (
                      <User className="size-12 text-slate-500" />
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full border border-[#07101d] bg-emerald-400 text-slate-950">
                    <Check className="size-3.5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[.24em] text-slate-500">
                    PSEUDO ACTUEL
                  </div>
                  <div className="mt-1 truncate font-display text-3xl font-black tracking-tight text-white md:text-4xl">
                    {username || "Ton pseudo"}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,.7)]" />
                    Visible dans les classements et sur le site
                  </div>
                </div>
              </div>

              {/* Édition */}
              <form onSubmit={handleUpdateProfile} className="rounded-[24px] border border-white/10 bg-black/[0.18] p-5 backdrop-blur-sm">
                <div className="mb-4">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-[.22em] text-slate-500">
                    Modifier mon pseudo
                  </label>
                  <div className="mt-3 relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={username}
                      maxLength={24}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ton pseudo"
                      className="w-full rounded-2xl border border-white/10 bg-[#040a14]/90 py-4 pl-11 pr-14 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/45 focus:bg-[#050c17]"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600">
                      {username.length}/24
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="group w-full rounded-2xl bg-[#ccff00] px-5 py-4 font-display text-[11px] font-black uppercase tracking-[.14em] text-slate-950 shadow-[0_12px_30px_rgba(204,255,0,.12)] transition hover:bg-[#b8eb00] active:scale-[0.99]"
                >
                  {savedProfile ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="size-4" />
                      Pseudo mis à jour
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="size-4 transition-transform group-hover:rotate-12" />
                      Enregistrer les modifications
                    </span>
                  )}
                </button>

                <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-slate-600">
                  <Activity className="size-3.5" />
                  {user?.email || "Compte connecté"}
                </div>
              </form>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}