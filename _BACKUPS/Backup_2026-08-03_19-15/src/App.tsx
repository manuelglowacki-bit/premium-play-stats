import React, { useState } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Trophy } from 'lucide-react';

export function App() {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <header className="max-w-6xl mx-auto flex justify-between items-center py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold tracking-wider text-lg">PREMIUM PLAY STATS</span>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto mt-12 space-y-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 mb-4">
            Tableau de bord des Pronostics
          </h1>
          <p className="text-slate-400">
            Bienvenue sur ton application de pronostics de Ligue 1. Le chargement s'est effectué avec succès !
          </p>
        </div>
      </main>
    </div>
  );
}
