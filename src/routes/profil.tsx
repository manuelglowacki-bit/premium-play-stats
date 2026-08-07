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
      <div className="mx-auto max-w-6xl space-y-6 pb-32 p-4 text-slate-100 font-sans">
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* ================= SECTION PRINCIPALE DU PROFIL ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-2xl relative overflow-hidden">

          {/* Fond d'écran dynamique : couleurs/ambiance de l'équipe favorite.
              Repli sur /stadium-bg.jpg (générique) si l'image du club n'a
              pas encore été fournie ou ne charge pas. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-35"
            style={{
              backgroundImage: `url('${!wallpaperFailed && teamWallpaperUrl ? teamWallpaperUrl : "/stadium-bg.jpg"}')`,
            }}
          />
          {teamWallpaperUrl && !wallpaperFailed && (
            // Image cachée servant uniquement à détecter un 404 et basculer
            // proprement sur le fond générique (onError ne marche pas sur
            // un background-image CSS).
            <img
              src={teamWallpaperUrl}
              alt=""
              className="hidden"
              onError={() => setWallpaperFailed(true)}
            />
          )}
          <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0d1322]/85 via-[#0d1322]/92 to-[#0d1322]/97" />

          {/* Colonne Avatar */}
          <div className="relative z-10 lg:col-span-4 flex flex-col items-center justify-center space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-8">
            <div className="relative">
              <div className="size-36 md:size-40 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 p-1 shadow-2xl shadow-purple-500/20">
                <div className="flex size-full items-center justify-center rounded-full bg-[#060b16] overflow-hidden border-2 border-slate-900 relative">
                  <div className="absolute pointer-events-none inset-0 bg-radial from-purple-500/20 to-transparent pointer-events-none" />
                  
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                  ) : (
                    <span className="font-display text-4xl font-bold text-white tracking-wider">
                      {username ? username.substring(0, 2).toUpperCase() : "RE"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ccff00] text-slate-950 font-display font-bold text-xs uppercase tracking-wider hover:bg-[#b8eb00] transition-colors shadow-lg shadow-[#ccff00]/10 cursor-pointer"
              >
                <Camera className="size-4" /> Changer la photo
              </button>
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 font-display text-xs uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" /> Supprimer
              </button>
            </div>
          </div>

          {/* Colonne Informations et Mini-cartes */}
          <div className="relative z-10 lg:col-span-8 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400 font-semibold">Mon Profil</span>
              <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight text-white font-bold">
                {username}
              </h1>
              <p className="text-xs text-slate-400 font-mono">Joueur actif de la Prono Ligue 1 LM</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Classement actuel</span>
                <div className="font-display text-2xl font-bold text-white">#{userStats.rank}</div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Club de cœur</span>
                <div className="font-display text-base font-bold text-white truncate">{favoriteTeamName || "Non renseigné"}</div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Compte</span>
                <div className="text-xs font-mono text-slate-300 truncate pt-1">{user?.email || "manuelglowacki@gmail.com"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= LIGNE DE STATISTIQUES ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Points</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.points}</div>
            <p className="text-[11px] text-slate-500 font-mono">Total de la saison</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Scores exacts</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.exactScores}</div>
            <p className="text-[11px] text-slate-500 font-mono">Équipe favorite + bonus</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Taux de réussite</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.successRate}</div>
            <p className="text-[11px] text-slate-500 font-mono">{userStats.totalPronos} bons pronostics</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Meilleure journée</span>
            <div className="font-display text-3xl font-bold text-amber-400">{userStats.bestDay}</div>
            <p className="text-[11px] text-slate-500 font-mono">Aucun résultat</p>
          </div>
        </div>

        {/* ================= SECTION INFÉRIEURE : 2 COLONNES ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Colonne de gauche */}
          <div className="lg:col-span-6 space-y-6">
            
            <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 tracking-wider">Répartition</span>
                  <h2 className="font-display text-lg text-white uppercase tracking-tight">Origine des points</h2>
                </div>
                <span className="font-mono text-xs text-slate-400 font-bold">{userStats.points} pts</span>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800/60 bg-[#060b16] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">1N2</span> Points 1N2
                    </span>
                    <span className="text-white font-bold">0 pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-0" />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-[#060b16] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-pink-500" /> Équipe favorite
                    </span>
                    <span className="text-white font-bold">0 pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-pink-500 h-full w-0" />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-[#060b16] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Star className="size-3 text-amber-400 fill-amber-400" /> Matchs bonus
                    </span>
                    <span className="text-white font-bold">0 pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full w-0" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 tracking-wider">Distinctions</span>
                  <h2 className="font-display text-lg text-white uppercase tracking-tight">Badges de leader</h2>
                </div>
                <span className="font-mono text-xs text-slate-400 font-bold">0</span>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#060b16] p-8 text-center">
                <p className="text-xs text-slate-500 font-mono">Aucun badge de leader pour le moment.</p>
              </div>
            </div>

          </div>

          {/* Colonne de droite */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* ================= PHASE 3 : CARTE ÉQUIPE FAVORITE ================= */}
            <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">Saison 2026-2027</span>
                  <h2 className="font-display text-lg text-white uppercase tracking-tight flex items-center gap-2">
                    ⭐ Mon équipe favorite
                  </h2>
                </div>
              </div>

              {!favoriteTeamId || isEditingTeam ? (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-slate-400">Choisis ton équipe de cœur :</p>
                  
                  {!isLocked ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1 w-full">
                        <select
                          value={tempSelectedTeam}
                          onChange={(e) => setTempSelectedTeam(e.target.value)}
                          className="relative z-50 block w-full rounded-xl border border-slate-800 bg-[#060b16] p-3 pr-10 text-base text-white font-mono appearance-auto cursor-pointer touch-manipulation"
                        >
                          <option value="" disabled>Sélectionne un club...</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                        
                      </div>
                      <button
                        onClick={handleSaveFavoriteTeam}
                        disabled={!tempSelectedTeam || savingTeam}
                        className="w-full sm:w-auto px-4 py-3 rounded-xl bg-amber-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider hover:bg-amber-500 transition-colors shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} /> {savingTeam ? "..." : "Valider"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm font-bold flex items-center gap-1.5 pt-2">
                      <Lock size={16} /> Choix verrouillé
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">

                    <TeamBadge
                      name={favoriteTeamName || "Aucune équipe"}
                      shortName={teams.find((t) => t.id === favoriteTeamId)?.short_name ?? ""}
                      logoUrl={teams.find((t) => t.id === favoriteTeamId)?.logo_url ?? null}
                    />

                    {!isLocked && (
                      <span className="text-xs font-mono text-blue-400 flex items-center gap-1">
                        <Check size={14} /> Choix enregistré.
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">
                    Date limite : <br />
                    <strong className="text-slate-200">{deadlineStr}</strong>
                  </p>

                  {isLocked ? (
                    <p className="text-red-400 text-sm font-bold flex items-center gap-1.5 pt-2">
                      <Lock size={16} /> Choix verrouillé
                    </p>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          setTempSelectedTeam(favoriteTeamId ?? "");
                          setIsEditingTeam(true);
                        }}
                        className="text-xs font-mono text-slate-500 hover:text-white transition-colors"
                      >
                        Modifier mon choix
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Identité / Modification Profil (Pseudo uniquement) */}
            <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 tracking-wider">Identité</span>
                  <h2 className="font-display text-lg text-white uppercase tracking-tight">Nom affiché</h2>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Pseudonyme visible sur le site
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ton pseudo"
                    className="w-full rounded-xl border border-slate-800 bg-[#060b16] p-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-colors font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#ccff00] text-slate-950 font-display font-bold text-xs uppercase tracking-wider hover:bg-[#b8eb00] transition-colors shadow-lg shadow-[#ccff00]/15 cursor-pointer"
                  >
                    {savedProfile ? <Check className="size-4" /> : null}
                    {savedProfile ? "Enregistré !" : "Enregistrer"}
                  </button>
                </div>
              </form>
            </div>

          </div>

        </div>
      </div>
    </AppShell>
  );
}


