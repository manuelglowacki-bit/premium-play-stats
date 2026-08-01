import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Flame, Heart } from "lucide-react";

import { AppShell } from "@/components/prono/AppShell";
import { ClubCrest } from "@/components/prono/ClubCrest";
import { Countdown } from "@/components/prono/Countdown";
import { Leaderboard } from "@/components/prono/Leaderboard";
import { clubOf, matchday, seasonStats } from "@/lib/prono-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prono Ligue 1 — Tableau de bord des pronostics" },
      {
        name: "description",
        content:
          "Ton tableau de bord Prono Ligue 1 : prochaine journée, club de cœur, classement général et statistiques de la saison.",
      },
      { property: "og:title", content: "Prono Ligue 1 — Tableau de bord" },
      {
        property: "og:description",
        content: "Prochaine journée, club de cœur, classement live et stats de la saison.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const club = clubOf("tfc");

  return (
    <AppShell>
      {/* SECTION PRINCIPALE AVEC L'IMAGE HERO-PLAYER_2 AJUSTÉE */}
      <section className="glass sheen glow-sky animate-rise relative overflow-hidden p-6 sm:p-12">
        {/* Image hero-player_2 intégrée avec un positionnement et une taille parfaits */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img 
            src="/hero-player_2.jpg" 
            alt="Joueur Ligue 1" 
            className="w-full h-full object-cover object-right opacity-85"
          />
        </div>

        {/* Dégradé sombre à gauche pour garantir une lisibilité totale du texte */}
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        
        <div className="relative z-10 max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-accent">
            <Flame className="size-3 icon-lume" /> SAISON 2026—2027
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.88] tracking-tight">
            PRÉDIS LES RÉSULTATS DE
            <span className="block text-primary">LA LIGUE 1</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Affronte tes amis, fais les bons pronos et deviens le champion des pronostics.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/pronostics"
              className="tap glow-warm inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              Faire mes pronos <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/classement"
              className="tap inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-bold text-foreground"
            >
              Voir le classement
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass sheen animate-rise p-5 sm:p-7" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
              <CalendarDays className="size-5 icon-lume" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-wide">Prochaine journée</h2>
              <p className="truncate text-xs text-muted-foreground">{matchday.label}</p>
            </div>
            <span className="ml-auto hidden items-center gap-2 font-mono text-[10px] text-primary sm:flex">
              <Flame className="size-3 icon-lume" /> EN APPROCHE
            </span>
          </div>
          <div className="my-6 h-px bg-border" />
          <Countdown />
          <Link
            to="/pronostics"
            className="tap mt-6 flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-xs font-bold text-accent"
          >
            Voir les matchs <ArrowRight className="size-4 text-primary" />
          </Link>
        </section>

        <section
          className="glass sheen glow-warm animate-rise relative overflow-hidden p-5 sm:p-7"
          style={{ animationDelay: "220ms" }}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Heart className="size-5 icon-lume" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-wide">Équipe de cœur</h2>
              <p className="truncate text-xs text-muted-foreground">Ton club favori pour la saison</p>
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
                <span>
                  Forme <b className="text-mint">V V N</b>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Points gagnés avec ce club</span>
              <b className="text-foreground">112 / 250</b>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-[width] duration-1000 ease-out"
                style={{ width: "45%" }}
              />
            </div>
          </div>
          <Link
            to="/profil"
            className="tap mt-6 flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-xs font-bold text-accent"
          >
            Modifier mon club <ArrowRight className="size-4 text-primary" />
          </Link>
        </section>
      </div>

      <Leaderboard />

      <section className="glass sheen animate-rise p-5 sm:p-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              TES PERFORMANCES
            </p>
            <h2 className="mt-1 font-display text-2xl tracking-wide sm:text-3xl">
              Statistiques personnelles
            </h2>
          </div>
          <Link
            to="/statistiques"
            className="tap shrink-0 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] text-accent"
          >
            TOUT VOIR
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {seasonStats.map((stat, i) => (
            <article
              key={stat.label}
              className="animate-rise tap rounded-2xl border border-border bg-secondary/25 p-4"
              style={{ animationDelay: `${i * 80}ms` }}
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
      </section>
    </AppShell>
  );
}