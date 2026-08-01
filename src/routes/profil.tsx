import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Heart, ShieldCheck } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { ClubCrest } from "@/components/prono/ClubCrest";
import { clubOf, clubs, ranking, seasonStats } from "@/lib/prono-data";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Gère ton profil de pronostiqueur : club de cœur, notifications, statistiques et position au classement.",
      },
      { property: "og:title", content: "Mon profil de pronostiqueur" },
      {
        property: "og:description",
        content: "Club de cœur, notifications et bilan personnel de la saison.",
      },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const club = clubOf("tfc");
  const me = ranking.find((p) => p.current);

  return (
    <AppShell>
      <PageHead kicker="MON COMPTE" title="Red evils" subtitle="Membre depuis la saison 2024—2025." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="glass sheen glow-warm animate-rise p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Heart className="size-5 icon-lume" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-wide">Équipe de cœur</h2>
              <p className="truncate text-xs text-muted-foreground">Ton club favori de la saison</p>
            </div>
          </div>
          <div className="my-6 h-px bg-border" />
          <div className="flex items-center gap-5">
            <ClubCrest club={club} size={92} className="animate-pop shrink-0" />
            <div className="min-w-0">
              <b className="block font-display text-3xl leading-none tracking-wide">{club.name}</b>
              <small className="mt-1 block text-xs text-muted-foreground">
                Ligue 1 McDonald's · 9e
              </small>
              <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
                <span>
                  <b className="text-foreground">2V</b> · 1N · 2D
                </span>
                <span>
                  Buts <b className="text-foreground">7:6</b>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {Object.values(clubs).map((c) => (
              <button
                key={c.id}
                aria-label={`Choisir ${c.name}`}
                className={`tap rounded-2xl border p-2 ${
                  c.id === club.id ? "border-primary bg-primary/10" : "border-border bg-secondary/25"
                }`}
              >
                <ClubCrest club={c} size={28} />
              </button>
            ))}
          </div>
        </section>

        <section className="glass sheen animate-rise p-5 sm:p-7" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
              <ShieldCheck className="size-5 icon-lume" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-wide">Mon bilan</h2>
              <p className="truncate text-xs text-muted-foreground">Saison 2026—2027</p>
            </div>
          </div>
          <div className="my-6 h-px bg-border" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-secondary/25 p-4">
              <p className="text-[11px] text-muted-foreground">Position</p>
              <b className="mt-1 block font-display text-3xl leading-none">{me?.rank ?? "—"}e</b>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/25 p-4">
              <p className="text-[11px] text-muted-foreground">Points</p>
              <b className="mt-1 block font-display text-3xl leading-none">{me?.score ?? 0}</b>
            </div>
            {seasonStats.slice(0, 2).map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-secondary/25 p-4"
              >
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <b className="mt-1 block font-display text-3xl leading-none">{stat.value}</b>
              </div>
            ))}
          </div>
          <Link
            to="/statistiques"
            className="tap mt-6 flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-xs font-bold text-accent"
          >
            Voir toutes mes stats <ArrowRight className="size-4 text-primary" />
          </Link>
        </section>
      </div>

      <section className="glass sheen animate-rise p-5 sm:p-7" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary/50 text-foreground">
            <Bell className="size-5 icon-lume" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl tracking-wide">Notifications</h2>
            <p className="truncate text-xs text-muted-foreground">Ce que tu veux recevoir</p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {[
            { label: "Rappel avant la clôture des pronos", on: true },
            { label: "Résultats de la journée", on: true },
            { label: "Nouvel article de la Gazette", on: false },
            { label: "Changement de place au classement", on: true },
          ].map((row) => (
            <label
              key={row.label}
              className="tap flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/25 px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate">{row.label}</span>
              <input type="checkbox" defaultChecked={row.on} className="size-5 accent-[var(--primary)]" />
            </label>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
