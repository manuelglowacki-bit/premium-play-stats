import { createFileRoute } from "@tanstack/react-router";
import { Lock, Medal, Sparkles } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { trophies } from "@/lib/prono-data";

export const Route = createFileRoute("/trophees")({
  head: () => ({
    meta: [
      { title: "Trophées et défis — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Débloque les trophées de la ligue : premier prono, scores exacts, séries parfaites et roi de la journée.",
      },
      { property: "og:title", content: "Trophées et défis de la ligue" },
      {
        property: "og:description",
        content: "Débloque les trophées et suis ta progression sur chaque défi.",
      },
    ],
  }),
  component: TrophiesPage,
});

function TrophiesPage() {
  const unlocked = trophies.filter((t) => t.unlocked).length;

  return (
    <AppShell>
      <PageHead
        kicker="COLLECTION PERSONNELLE"
        title="Trophées"
        subtitle="Chaque défi relevé rapporte des points de prestige."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-gold">
            <Medal className="size-3 icon-lume" /> {unlocked}/{trophies.length} DÉBLOQUÉS
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trophies.map((trophy, i) => (
          <article
            key={trophy.id}
            className={`glass sheen animate-rise tap p-5 ${trophy.unlocked ? "glow-warm" : ""}`}
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-2xl"
                style={{
                  background: trophy.unlocked
                    ? `color-mix(in oklab, ${trophy.tone} 22%, transparent)`
                    : "color-mix(in oklab, var(--muted) 60%, transparent)",
                  color: trophy.unlocked ? trophy.tone : "var(--muted-foreground)",
                }}
              >
                {trophy.unlocked ? (
                  <Sparkles className="size-5 icon-lume" />
                ) : (
                  <Lock className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <b className="block font-display text-xl leading-tight tracking-wide">
                  {trophy.name}
                </b>
                <small className="block text-[11px] text-muted-foreground">{trophy.desc}</small>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{trophy.unlocked ? "Débloqué" : "Progression"}</span>
                <b className="text-foreground">
                  {trophy.progress} / {trophy.goal}
                </b>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-out"
                  style={{
                    width: `${(trophy.progress / trophy.goal) * 100}%`,
                    background: trophy.tone,
                  }}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
