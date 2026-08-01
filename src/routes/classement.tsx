import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { Leaderboard } from "@/components/prono/Leaderboard";
import { ranking } from "@/lib/prono-data";

export const Route = createFileRoute("/classement")({
  head: () => ({
    meta: [
      { title: "Classement général — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Le classement complet des pronostiqueurs : podium, points, scores exacts et progression journée par journée.",
      },
      { property: "og:title", content: "Classement général des pronostiqueurs" },
      {
        property: "og:description",
        content: "Podium, points et progression de tous les joueurs de la ligue.",
      },
    ],
  }),
  component: ClassementPage,
});

function ClassementPage() {
  const leader = ranking[0];
  const me = ranking.find((p) => p.current);

  return (
    <AppShell>
      <PageHead
        kicker="À L'ISSUE DE LA J5"
        title="Classement général"
        subtitle="Podium, points et évolution de chaque pronostiqueur."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-accent">
            {ranking.length} JOUEURS
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Leader", value: leader?.name ?? "—", sub: `${leader?.score ?? 0} pts`, tone: "var(--gold)" },
          { label: "Ta position", value: `${me?.rank ?? "—"}e`, sub: `${me?.score ?? 0} pts`, tone: "var(--primary)" },
          {
            label: "Écart avec le leader",
            value: `−${(leader?.score ?? 0) - (me?.score ?? 0)}`,
            sub: "points à rattraper",
            tone: "var(--sky)",
          },
        ].map((card, i) => (
          <article
            key={card.label}
            className="glass sheen animate-rise p-5"
            style={{ animationDelay: `${80 + i * 80}ms` }}
          >
            <span
              className="block size-2.5 rounded-full"
              style={{ background: card.tone, boxShadow: `0 0 12px ${card.tone}` }}
            />
            <p className="mt-3 text-[11px] text-muted-foreground">{card.label}</p>
            <b className="mt-1 block font-display text-3xl leading-none">{card.value}</b>
            <small className="mt-1 block text-[10px] text-muted-foreground">{card.sub}</small>
          </article>
        ))}
      </div>

      <Leaderboard />
    </AppShell>
  );
}
