import { useState } from "react";
import { SplashScreen } from "@/components/prono/SplashScreen";
import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../index.css";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const [showSplash, setShowSplash] = useState(true);
  // Rejoue une petite animation d'entrée (fondu + léger slide) à chaque
  // changement de route, pour une transition douce entre les pages.
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      {showSplash ? (
        <SplashScreen onDone={() => setShowSplash(false)} />
      ) : (
        <div key={pathname} className="page-transition">
          <Outlet />
        </div>
      )}
    </QueryClientProvider>
  );
}
