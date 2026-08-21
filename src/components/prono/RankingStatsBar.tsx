// @/components/prono/RankingStatsBar.tsx
//
// Bande de statistiques premium sous le podium — UNE seule bande vitrée avec
// séparateurs fins, plutôt que 5 cartes identiques répétées (composition
// volontairement plus originale/intégrée). Purement présentationnel : reçoit
// des items déjà calculés par classement.tsx à partir des vraies données
// Supabase (aucun calcul ici, aucune donnée inventée).

import type { LucideIcon } from "lucide-react";

export type RankingStatItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Accent ponctuel (le vert reste une exception, jamais la couleur dominante). */
  accent?: "mint" | "sky" | "gold";
};

const ACCENT_TEXT: Record<NonNullable<RankingStatItem["accent"]>, string> = {
  mint: "text-emerald-400",
  sky: "text-sky-300",
  gold: "text-amber-300",
};

export function RankingStatsBar({ items }: { items: RankingStatItem[] }) {
  return (
    <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#0b1220]/85 to-[#070c16]/85 shadow-[0_16px_40px_-20px_rgba(0,0,0,.8)] backdrop-blur-md">
      <div className="grid grid-cols-2 divide-y divide-white/[0.06] sm:grid-cols-5 sm:divide-y-0 sm:divide-x">
        {items.map(({ icon: Icon, label, value, accent = "sky" }, i) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 px-3.5 py-3 sm:flex-col sm:items-center sm:gap-1.5 sm:px-2 sm:py-4 sm:text-center ${
              i % 2 === 0 ? "border-r border-white/[0.06] sm:border-r-0" : ""
            }`}
          >
            <Icon size={14} className={`shrink-0 ${ACCENT_TEXT[accent]} sm:hidden`} strokeWidth={2.25} />
            <div className="hidden sm:block">
              <Icon size={16} className={ACCENT_TEXT[accent]} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-black text-white sm:mt-1 sm:text-xl">{value}</div>
              <div className="truncate font-mono text-[8px] font-bold uppercase tracking-widest text-slate-500 sm:text-[9px]">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
