import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy, Calendar, Newspaper, User, Shield } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const navItems = [
    { label: "Accueil", to: "/", icon: Calendar },
    { label: "Pronos", to: "/pronostics", icon: Calendar },
    { label: "Classement", to: "/classement", icon: Trophy },
    { label: "Gazette", to: "/gazette", icon: Newspaper },
    { label: "Profil", to: "/profil", icon: User },
    { label: "Admin", to: "/admin", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative flex flex-col font-sans">
      
      {/* ================= ARRIÈRE-PLAN STADE FIXE GLOBAL ================= */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Remplace l'URL ci-dessous par ton image locale si tu en as une (ex: "/stade.jpg") */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15 filter brightness-75 scale-105"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1920&auto=format&fit=crop')` }}
        />
        {/* Assombrissement progressif pour garder un confort de lecture optimal */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/95 via-[#060b16]/90 to-[#030712]/95 backdrop-blur-[2px]" />
      </div>

      {/* ================= HEADER / NAVIGATION ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#060b16]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-display font-black text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform">
              L1
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

          <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#0d1322] px-3.5 py-1.5 shadow-inner">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-xs font-bold text-slate-300">J1 • 2026</span>
          </div>

        </div>
      </header>

      {/* ================= CONTENU DE LA PAGE (Z-10 pour passer au-dessus du fond) ================= */}
      <main className="relative z-10 flex-1 px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>

      {/* ================= NAVIGATION MOBILE ================= */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
        <nav className="flex items-center justify-around bg-[#060b16]/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
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