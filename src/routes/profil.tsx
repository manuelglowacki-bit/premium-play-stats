import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { 
  User, Shield, LogOut, Check, Trophy, Target, Flame, 
  Award, Sparkles, Activity, Star, Camera, Trash2, ChevronDown 
} from "lucide-react";
import { AppShell } from "@/components/prono/AppShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/profil")({
  component: ProfilPage,
});

// Liste des équipes de Ligue 1 pour le menu déroulant
const LIGUE_1_TEAMS = [
  "RC Lens",
  "Paris Saint-Germain",
  "Olympique de Marseille",
  "AS Monaco",
  "OGC Nice",
  "Lille OSC",
  "Olympique Lyonnais",
  "Stade Brestois 29",
  "Stade Rennais FC",
  "Stade de Reims",
  "Toulouse FC",
  "Montpellier HSC",
  "FC Nantes",
  "RC Strasbourg Alsace",
  "Le Havre AC",
  "Angers SCO",
  "AJ Auxerre",
  "AS Saint-Étienne"
].sort();

function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  
  // Form fields & Avatar
  const [username, setUsername] = useState("Red evils");
  const [favoriteClub, setFavoriteClub] = useState("Toulouse FC");
  const [avatarUrl, setAvatarUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats (connectables à Supabase)
  const [userStats] = useState({
    rank: 5,
    points: 0,
    exactScores: 0,
    successRate: "0%",
    totalPronos: 0,
    bestDay: "-",
  });

  useEffect(() => {
    async function loadSessionAndProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          
          if (data) {
            setUsername(data.username || "Red evils");
            setFavoriteClub(data.favorite_club || "Toulouse FC");
            setAvatarUrl(data.avatar_url || "");
          }
        }
      } catch (err) {
        console.error("Erreur de chargement du profil :", err);
      } finally {
        setLoading(false);
      }
    }
    loadSessionAndProfile();
  }, []);

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
          favorite_club: favoriteClub,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la mise à jour :", err);
      alert("Erreur lors de la mise à jour du profil.");
    }
  };

  const handleReset = () => {
    setUsername("Red evils");
    setFavoriteClub("Toulouse FC");
    setAvatarUrl("");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-32 p-4 text-slate-100 font-sans">
        
        {/* Input fichier caché */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* SECTION PRINCIPALE DU PROFIL (AVATAR + INFOS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-3xl border border-slate-800 bg-[#0d1322] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Colonne Avatar */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-8">
            <div className="relative">
              <div className="size-36 md:size-40 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 p-1 shadow-2xl shadow-purple-500/20">
                <div className="flex size-full items-center justify-center rounded-full bg-[#060b16] overflow-hidden border-2 border-slate-900 relative">
                  <div className="absolute inset-0 bg-radial from-purple-500/20 to-transparent pointer-events-none" />
                  
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
          <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400 font-semibold">Mon Profil</span>
              <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight text-white font-bold">
                {username}
              </h1>
              <p className="text-xs text-slate-400 font-mono">Joueur actif de la Prono Ligue 1 LM</p>
            </div>

            {/* 3 Cartes d'info rapides */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Classement actuel</span>
                <div className="font-display text-2xl font-bold text-white">#{userStats.rank}</div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Club de cœur</span>
                <div className="font-display text-base font-bold text-white truncate">{favoriteClub || "Non renseigné"}</div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-[#060b16] p-4 space-y-1 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Compte</span>
                <div className="text-xs font-mono text-slate-300 truncate pt-1">{user?.email || "manuelglowacki@gmail.com"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* LIGNE DE STATISTIQUES GLOBALES (4 blocs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Points</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.points}</div>
            <p className="text-[11px] text-slate-500 font-mono">Total de la saison</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Scores exacts</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.exactScores}</div>
            <p className="text-[11px] text-slate-500 font-mono">Équipe de cœur + bonus</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Taux de réussite</span>
            <div className="font-display text-3xl font-bold text-white">{userStats.successRate}</div>
            <p className="text-[11px] text-slate-500 font-mono">{userStats.totalPronos} bons pronostics</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 space-y-2 shadow-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Meilleure journée récente</span>
            <div className="font-display text-3xl font-bold text-amber-400">{userStats.bestDay}</div>
            <p className="text-[11px] text-slate-500 font-mono">Aucun résultat</p>
          </div>
        </div>

        {/* SECTION INFÉRIEURE : 2 COLONNES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Colonne de gauche (Répartition + Distinctions) */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Répartition / Origine des points */}
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
                  <span className="text-[10px] font-mono text-slate-500 block">0% du total</span>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-[#060b16] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-pink-500" /> Équipe de cœur
                    </span>
                    <span className="text-white font-bold">0 pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="bg-pink-500 h-full w-0" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block">0% du total</span>
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
                  <span className="text-[10px] font-mono text-slate-500 block">0% du total</span>
                </div>
              </div>
            </div>

            {/* Distinctions / Badges de leader */}
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

          {/* Colonne de droite (Forme récente + Identité/Modification du profil) */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Forme récente / Dernières journées */}
            <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-blue-400 tracking-wider">Forme récente</span>
                  <h2 className="font-display text-lg text-white uppercase tracking-tight">Dernières journées</h2>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#060b16] p-12 text-center">
                <p className="text-xs text-slate-500 font-mono">Aucun résultat enregistré.</p>
              </div>
            </div>

            {/* Identité / Formulaire de modification */}
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

                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Équipe de cœur (Club)
                  </label>
                  <div className="relative">
                    <select
                      value={favoriteClub}
                      onChange={(e) => setFavoriteClub(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-[#060b16] p-3.5 pr-10 text-sm text-white focus:border-emerald-500 outline-none transition-colors font-mono appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="text-slate-500">Sélectionne ton équipe</option>
                      {LIGUE_1_TEAMS.map((team) => (
                        <option key={team} value={team} className="bg-[#060b16] text-white">
                          {team}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#ccff00] text-slate-950 font-display font-bold text-xs uppercase tracking-wider hover:bg-[#b8eb00] transition-colors shadow-lg shadow-[#ccff00]/15 cursor-pointer"
                  >
                    {saved ? <Check className="size-4" /> : null}
                    {saved ? "Enregistré !" : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-3.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 font-display font-bold text-xs uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
                  >
                    Réinitialiser
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