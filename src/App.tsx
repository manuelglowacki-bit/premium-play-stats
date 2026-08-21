import React, { useState } from "react";
import { SplashScreen } from "./components/prono/SplashScreen";
import { Trophy } from "lucide-react";

export function App() {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <SplashScreen onDone={() => setIsLoading(false)} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage:
          "linear-gradient(rgba(7,12,22,.78), rgba(7,12,22,.88)), url('/background-site.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      <main className="max-w-6xl mx-auto mt-12 space-y-8 p-6">
        <header className="flex items-center gap-3">
          <Trophy className="h-10 w-10 text-yellow-400" />
          <h1 className="text-4xl font-bold text-white">
            PREMIUM PLAY STATS
          </h1>
        </header>

        <section className="rounded-2xl bg-black/40 backdrop-blur-md p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">
            Tableau de bord des Pronostics
          </h2>

          <p className="text-gray-300">
            Bienvenue sur ton application de pronostics de Ligue 1. Le
            chargement s'est effectué avec succès !
          </p>
        </section>
      </main>
    </div>
  );
}