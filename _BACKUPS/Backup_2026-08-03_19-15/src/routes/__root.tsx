import { useState } from "react";
import { SplashScreen } from "@/components/prono/SplashScreen";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../index.css";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      {showSplash ? (
        <SplashScreen onDone={() => setShowSplash(false)} />
      ) : (
        <Outlet />
      )}
    </QueryClientProvider>
  );
}
