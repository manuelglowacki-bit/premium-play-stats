import { useState } from "react";
import { SplashScreen } from "@/components/prono/SplashScreen";
import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AuthPage } from "./auth";
import "../index.css";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
});

// Parcours d'accès : Intro (SplashScreen) → Login (si pas de session
// Supabase valide) → App (Outlet, toutes les routes). Centralisé ici plutôt
// que route par route : aucune page (accueil, pronostics, admin, ...) n'est
// jamais montée tant qu'une session authentifiée n'est pas confirmée — donc
// aucun accès direct possible à l'app via une URL tapée à la main pendant
// qu'on est déconnecté. Réutilise exactement l'auth Supabase existante
// (AuthContext + AuthPage), aucun nouveau système créé.
function RootComponent() {
  const [showSplash, setShowSplash] = useState(true);
  // Rejoue une petite animation d'entrée (fondu + léger slide) à chaque
  // changement de route, pour une transition douce entre les pages.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();

  // Routes publiques d'authentification : accessibles SANS session, car
  // elles gèrent leur propre rendu (login, mot de passe oublié, nouveau
  // mot de passe). Sans cette exception, un utilisateur déconnecté qui
  // clique sur le lien de récupération Supabase arrivait sur /reset-password
  // mais __root.tsx affichait le login à la place — la page reset n'était
  // jamais montée, d'où le parcours "mot de passe oublié" cassé.
  const isPublicAuthRoute =
    pathname === "/forgot-password" || pathname === "/reset-password";

  return (
    <QueryClientProvider client={queryClient}>
      {showSplash ? (
        <SplashScreen onDone={() => setShowSplash(false)} />
      ) : loading ? (
        // `loading` reste vrai le temps que Supabase restaure une éventuelle
        // session existante (localStorage) — indispensable pour ne jamais
        // flasher le login à un utilisateur déjà connecté, ni l'app à un
        // utilisateur qui ne l'est pas. Dans la pratique l'intro (~4s)
        // laisse largement le temps à `getSession()` de résoudre ; ce
        // garde-fou couvre le cas où ce ne serait pas encore le cas.
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a] text-slate-300 font-mono text-xs uppercase tracking-widest">
          Chargement...
        </div>
      ) : !user && !isPublicAuthRoute ? (
        <AuthPage />
      ) : (
        <div key={pathname} className="page-transition">
          <Outlet />
        </div>
      )}
    </QueryClientProvider>
  );
}
