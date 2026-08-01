import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Flame,
  Heart,
  Sparkles,
} from "lucide-react";
import stadium from "@/assets/stadium-night.jpg";
import { BottomNav } from "@/components/prono/BottomNav";
import { ClubCrest } from "@/components/prono/ClubCrest";
import { Leaderboard } from "@/components/prono/Leaderboard";
import { clubOf, seasonStats } from "@/lib/prono-data";

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

const navItems = ["Accueil", "Pronos", "Classement", "Gazette", "Stats", "Trophées"];

function getCountdown() {
  const finish = new Date("2026-08-21T20:45:00+02:00").getTime();
  const remaining = Math.max(0, finish - Date.now());
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    { value: pad(Math.floor(remaining / 86400000)), label: "jours" },
    { value: pad(Math.floor(remaining / 3600000) % 24), label: "heures" },
    { value: pad(Math.floor(remaining / 60000) % 60), label: "min" },
    { value: pad(Math.floor(remaining / 1000) % 60), label: "sec" },
  ];
}

function Index() {
  const [countdown, setCountdown] = useState(getCountdown);
  const club = clubOf("tfc");

  useEffect(() => {
    const t = window.setInterval(() => setCountdown(getCountdown()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-24 size-[36rem] rounded-full bg-accent/20 blur-[120px] animate-drift"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-52 top-[46rem] size-[34rem] rounded-full bg-primary/15 blur-[130px] animate-drift"
      />

      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center gap-8 px-5 py-4 sm:px-7">
        <a href="#accueil" className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary font-display text-sm font-extrabold text-primary icon-lume">
            L1
          </span>
          <span className="min-w-0 leading-none">
            <b className="block font-display text-lg tracking-wide">PRONO</b>
            <strong className="block font-display text-base tracking-wide text-accent">
              LIGUE <i className="not-italic text-primary">1</i>
            </strong>
          </span>
        </a>

        <nav className="mx-auto hidden items-center gap-7 lg:flex" aria-label="Navigation">
          {navItems.map((item, i) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className={`text-sm font-semibold transition-colors ${
                i === 0
                  ? "text-foreground [text-shadow:0_0_18px_var(--sky)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button className="tap relative grid size-10 place-items-center rounded-full border border-border text-accent">
            <Bell className="size-4 icon-lume" />
            <b className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">
              3
            </b>
          </button>
          <button className="tap flex items-center gap-2 rounded-full border border-border px-2 py-1.5 text-left">
            <ClubCrest club={club} size={22} />
            <span className="hidden sm:block">
              <strong className="block text-xs">Red evils</strong>
              <small className="block text-[10px] text-muted-foreground">Mon profil</small>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      <main
        id="accueil"
        className="relative z-10 mx-auto max-w-[1240px] space-y-5 px-4 pb-32 pt-3 sm:space-y-6 sm:px-7 lg:pb-16"
      >
        <section className="glass sheen glow-sky animate-rise relative overflow-hidden p-6 sm:p-12">
          <img
            src={stadium}
            alt="Stade de Ligue 1 sous les projecteurs"
            width={1600}
            height={1008}
            className="pointer-events-none absolute inset-0 size-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
          <div className="relative max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-accent">
              <Sparkles className="size-3 icon-lume" /> SAISON 2026—2027
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.88] tracking-tight">
              PRÉDIS LES RÉSULTATS DE
              <span className="block text-primary">LA LIGUE 1</span>
            </h1>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              Affronte tes amis, fais les bons pronos et deviens le champion des pronostics.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#pronostics"
                className="tap glow-warm inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
              >
                Faire mes pronos <ArrowRight className="size-4" />
              </a>
              <a
                href="#classement"
                className="tap inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-bold text-foreground"
              >
                Voir le classement
              </a>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            id="pronostics"
            className="glass sheen animate-rise p-5 sm:p-7"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
                <CalendarDays className="size-5 icon-lume" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-2xl tracking-wide">Prochaine journée</h2>
                <p className="truncate text-xs text-muted-foreground">
                  J1 · Vendredi 21 août 2026
                </p>
              </div>
              <span className="ml-auto hidden items-center gap-2 font-mono text-[10px] text-primary sm:flex">
                <Flame className="size-3 icon-lume" /> EN APPROCHE
              </span>
            </div>
            <div className="my-6 h-px bg-border" />
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {countdown.map((unit) => (
                <div
                  key={unit.label}
                  className="rounded-2xl border border-border bg-secondary/30 px-2 py-4 text-center"
                >
                  <b className="block font-display text-3xl leading-none sm:text-4xl">
                    {unit.value}
                  </b>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
            <a
              href="#pronostics"
              className="tap mt-6 flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-xs font-bold text-accent"
            >
              Voir les matchs <ArrowRight className="size-4 text-primary" />
            </a>
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
                <p className="truncate text-xs text-muted-foreground">
                  Ton club favori pour la saison
                </p>
              </div>
            </div>
            <div className="my-6 h-px bg-border" />
            <div className="flex items-center gap-5">
              <ClubCrest club={club} size={92} className="animate-pop shrink-0" />
              <div className="min-w-0">
                <b className="block font-display text-3xl leading-none tracking-wide">
                  {club.name}
                </b>
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
            <button className="tap mt-6 flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-xs font-bold text-accent">
              Modifier mon club <ArrowRight className="size-4 text-primary" />
            </button>
          </section>
        </div>

        <Leaderboard />

        <section id="stats" className="glass sheen animate-rise p-5 sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                TES PERFORMANCES
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-wide sm:text-3xl">
                Statistiques personnelles
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] text-accent">
              SAISON EN COURS
            </span>
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

        <footer className="flex flex-wrap items-center gap-2 px-1 pb-2 text-xs text-muted-foreground">
          <span className="font-display text-base tracking-wide text-foreground">PRONO LIGUE</span>
          Le football se joue aussi dans les pronostics.
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}
