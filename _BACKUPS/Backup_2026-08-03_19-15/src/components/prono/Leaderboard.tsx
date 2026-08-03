"use client";

import { Trophy, ChevronRight } from "lucide-react";

export function Leaderboard() {
  return (
    <div className="bg-[#0d1322] border border-slate-800/80 rounded-3xl p-6 md:p-10 w-full shadow-2xl overflow-visible">
      
      {/* En-tête */}
      <div className="flex justify-between items-start mb-20">
        <div>
          <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-2">À l'issue de la J5</p>
          <div className="flex items-center gap-3">
            <Trophy size={28} className="text-amber-400" />
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Classement général</h2>
          </div>
        </div>
        <button className="flex items-center gap-1 px-4 py-2 rounded-full border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors cursor-pointer">
          Complet <ChevronRight size={16} />
        </button>
      </div>

      {/* Podium 3D dynamique : 1er, 2ème, 3ème */}
      <div className="flex justify-center items-end gap-3 md:gap-8 h-[280px] px-2">

        {/* ÉRIC - 2ème (Argent - Gauche) */}
        <div className="flex flex-col items-center w-28 md:w-36 relative z-10 group">
          <div className="mb-8 flex flex-col items-center -translate-y-2 group-hover:-translate-y-4 transition-transform">
            <div className="w-8 h-8 rounded-lg bg-sky-500 text-white text-[10px] font-black flex items-center justify-center mb-2 shadow-lg">OM</div>
            <span className="font-black text-white text-lg">Éric</span>
            <span className="text-[10px] text-slate-400">5 scores exacts</span>
          </div>
          {/* Cylindre 3D Argent */}
          <div className="relative w-full h-40 bg-gradient-to-b from-[#a3a3a3] to-[#5c5c5c] shadow-[0_20px_30px_-10px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-5 left-0 w-full h-10 bg-gradient-to-tr from-[#e8e8e8] to-[#a3a3a3] rounded-[50%] border border-[#ffffff] z-20 shadow-inner"></div>
            <div className="absolute -bottom-5 left-0 w-full h-10 bg-gradient-to-b from-[#5c5c5c] to-[#262626] rounded-[50%] -z-10"></div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-5 z-10">
              <span className="text-5xl font-black text-[#404040] drop-shadow-sm mb-4">2</span>
              <span className="bg-[#0d1322] px-3 py-1.5 rounded-xl text-white font-bold text-sm border border-slate-400/50">150 pts</span>
            </div>
          </div>
        </div>

        {/* SAMUEL - 1er (Or - Centre) */}
        <div className="flex flex-col items-center w-32 md:w-40 relative z-20 group">
          <div className="mb-8 flex flex-col items-center -translate-y-2 group-hover:-translate-y-4 transition-transform">
            <div className="w-8 h-8 rounded-lg bg-blue-800 text-white text-[10px] font-black flex items-center justify-center mb-2 shadow-lg">PSG</div>
            <span className="font-black text-amber-500 text-xl">Samuel</span>
            <span className="text-[10px] text-slate-400">6 scores exacts</span>
          </div>
          {/* Cylindre 3D Or */}
          <div className="relative w-full h-48 bg-gradient-to-b from-[#cca122] to-[#8a680e] shadow-[0_20px_30px_-10px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-5 left-0 w-full h-10 bg-gradient-to-tr from-[#fad866] to-[#d6aa1e] rounded-[50%] border border-[#fceaa6] z-20 shadow-inner"></div>
            <div className="absolute -bottom-5 left-0 w-full h-10 bg-gradient-to-b from-[#8a680e] to-[#423105] rounded-[50%] -z-10"></div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-7 z-10">
              <span className="text-6xl font-black text-[#634a07] drop-shadow-sm mb-6">1</span>
              <span className="bg-[#0d1322] px-3 py-1.5 rounded-xl text-white font-bold text-sm border border-yellow-600/50">160 pts</span>
            </div>
          </div>
        </div>

        {/* JO B - 3ème (Bronze - Droite) */}
        <div className="flex flex-col items-center w-28 md:w-36 relative z-10 group">
          <div className="mb-8 flex flex-col items-center -translate-y-2 group-hover:-translate-y-4 transition-transform">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white text-[10px] font-black flex items-center justify-center mb-2 shadow-lg">LOSC</div>
            <span className="font-black text-white text-lg">Jo B</span>
            <span className="text-[10px] text-slate-400">4 scores exacts</span>
          </div>
          {/* Cylindre 3D Bronze */}
          <div className="relative w-full h-32 bg-gradient-to-b from-[#c4793d] to-[#82481b] shadow-[0_20px_30px_-10px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-5 left-0 w-full h-10 bg-gradient-to-tr from-[#f2a86d] to-[#c4793d] rounded-[50%] border border-[#ffcdad] z-20 shadow-inner"></div>
            <div className="absolute -bottom-5 left-0 w-full h-10 bg-gradient-to-b from-[#82481b] to-[#3d1f08] rounded-[50%] -z-10"></div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-4 z-10">
              <span className="text-5xl font-black text-[#522c0b] drop-shadow-sm mb-3">3</span>
              <span className="bg-[#0d1322] px-3 py-1.5 rounded-xl text-white font-bold text-sm border border-amber-700/50">145 pts</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Leaderboard;