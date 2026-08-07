import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Target,
  Trophy,
  Newspaper,
  BarChart3,
  User,
  Shield,
  LogIn,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function AppShell({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Vérifier la session active au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Écouter les changements de connexion (connexion/déconnexion en temps réel)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const navItems = [
    { label: "Accueil", to: "/", icon: Home },
    { label: "Pronos", to: "/pronostics", icon: Target },
    { label: "Classement", to: "/classement", icon: Trophy },
    { label: "Gazette", to: "/gazette", icon: Newspaper },
    { label: "Stats", to: "/stats", icon: BarChart3 },
    { label: "Profil", to: "/profil", icon: User },
    { label: "Admin", to: "/admin", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative flex flex-col font-sans">
      
      {/* ================= ARRIÈRE-PLAN GLOBAL PREMIUM ================= */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050b14]">
        
        {/* Calque 1 : L'image de fond brute */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
          style={{
            backgroundImage: "url('/background-l1.png')",
            backgroundAttachment: "fixed",
          }}
        />
        
        {/* Calque 2 : Effet EA Sports / Vignette (Lumière au centre, sombre sur les bords) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,11,22,0)_0%,rgba(3,7,18,0.85)_100%)]" />
        
        {/* Calque 3 : Reflets subtils aux couleurs de la Ligue 1 (émeraude/bleu) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-transparent to-emerald-500/10 mix-blend-overlay" />
      </div>

      {/* ================= HEADER / NAVIGATION ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#060b16]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-10 rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
              <div
                aria-hidden
                className="size-full"
                style={{
                  backgroundImage: "url('/hero-l1.jpg')",
                  backgroundSize: "119px 64px",
                  backgroundPosition: "-73px -4px",
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold uppercase tracking-wider text-white">
                  Prono Ligue 1
                </span>
                <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block">
                Saison 2026-2027
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1.5 bg-[#0d1322]/90 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-display text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* SECTION DROITE : BADGE + BOUTON CONNEXION / DÉCONNEXION */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#0d1322] px-3.5 py-1.5 shadow-inner">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-slate-300">J1 • 2026</span>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-mono text-xs font-bold transition-all shadow-inner"
                title="Se déconnecter"
              >
                <LogOut size={14} />
                <span>Quitter</span>
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-mono text-xs font-bold transition-all shadow-inner"
              >
                <LogIn size={14} />
                <span>Connexion</span>
              </Link>
            )}
          </div>

        </div>
      </header>

      {/* ================= CONTENU DE LA PAGE ================= */}
      <main className="relative z-10 flex-1 px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>

      {/* ================= NAVIGATION MOBILE ================= */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
        <nav className="flex items-center justify-around bg-[#060b16]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isActive ? "text-emerald-400 bg-emerald-500/10" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="text-[10px] font-mono font-bold">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}