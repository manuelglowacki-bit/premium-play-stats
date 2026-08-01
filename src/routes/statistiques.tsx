import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { journeyPoints, seasonStats } from "@/lib/prono-data";

export const Route = createFileRoute("/statistiques")({
  head: () => ({
    meta: [
      { title: "Mes statistiques — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Réussite, scores exacts, points par journée : analyse détaillée de tes performances de pronostiqueur.",
      },
      { property: "og:title", content: "Mes statistiques de pronostiqueur" },
      {
        property: "og:description",
        content: "Réussite, scores exacts et points par journée sur la saison.",
      },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const max = Math.max(...journeyPoints.map((j) => j.points));

  return (
    <AppShell>
      <PageHead
        kicker="SAISON EN COURS"
        title="Mes statistiques"
        subtitle="Tes performances journée par journée, sans filtre."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-accent">
            <BarChart3 className="size-3 icon-lume" /> 5 JOURNÉES
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {seasonStats.map((stat, i) => (
          <article
            key={stat.label}
            className="glass sheen animate-rise tap p-5"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <span
              className="block size-2.5 rounded-full"
              style={{ background: stat.accent, boxShadow: `0 0 12px ${stat.accent}` }}
            />
            <p className="mt-3 text-[11px] text-muted-foreground">{stat.label}</p>
            <b className="mt-1 block font-display text-3xl leading-none">{stat.value}</b>
            <small className="mt-1 block text-[10px] text-muted-foreground">{stat.sub}</small>
          </article>
        ))}
      </div>

      <section className="glass sheen glow-sky animate-rise p-5 sm:p-8" style={{ animationDelay: "180ms" }}>
        <h2 className="font-display text-2xl tracking-wide sm:text-3xl">Points par journée</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Ta meilleure journée reste la J3 avec 41 points.
        </p>
        <div className="mt-8 flex items-end justify-between gap-3 sm:gap-6">
          {journeyPoints.map((entry, i) => (
            <div key={entry.journey} className="flex flex-1 flex-col items-center gap-3">
              <b className="font-display text-lg leading-none">{entry.points}</b>
              <div className="flex h-40 w-full items-end rounded-2xl bg-secondary/30 p-1.5">
                <div
                  className="animate-rise w-full rounded-xl bg-gradient-to-t from-primary to-accent"
                  style={{
                    height: `${(entry.points / max) * 100}%`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{entry.journey}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass sheen animate-rise p-5 sm:p-8" style={{ animationDelay: "260ms" }}>
        <h2 className="font-display text-2xl tracking-wide">Répartition de tes pronos</h2>
        <div className="mt-6 space-y-5">
          {[
            { label: "Bon vainqueur", value: 68, tone: "var(--mint)" },
            { label: "Score exact", value: 4, tone: "var(--sky)" },
            { label: "Pronos ratés", value: 32, tone: "var(--primary)" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{row.label}</span>
                <b className="text-foreground">{row.value}%</b>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-out"
                  style={{ width: `${row.value}%`, background: row.tone }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
