import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Clock, Flame, Save } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { ClubCrest } from "@/components/prono/ClubCrest";
import { Countdown } from "@/components/prono/Countdown";
import { clubOf, matchday, matches } from "@/lib/prono-data";

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Mes pronostics J1 — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Saisis tes pronostics de la journée de Ligue 1 : scores, cotes et compte à rebours avant le coup d'envoi.",
      },
      { property: "og:title", content: "Mes pronostics de la journée" },
      {
        property: "og:description",
        content: "Saisis tes scores avant le coup d'envoi et grimpe au classement.",
      },
    ],
  }),
  component: PronosticsPage,
});

type Scores = Record<string, { home: string; away: string }>;

function PronosticsPage() {
  const [scores, setScores] = useState<Scores>({});
  const [saved, setSaved] = useState(false);

  const filled = matches.filter((m) => scores[m.id]?.home && scores[m.id]?.away).length;

  const set = (id: string, side: "home" | "away", value: string) => {
    setSaved(false);
    setScores((prev) => ({
      ...prev,
      [id]: {
        home: prev[id]?.home ?? "",
        away: prev[id]?.away ?? "",
        [side]: value.replace(/[^0-9]/g, "").slice(0, 2),
      },
    }));
  };

  return (
    <AppShell>
      <PageHead
        kicker={`JOURNÉE ${matchday.number} · LIGUE 1`}
        title="Mes pronostics"
        subtitle={matchday.label}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-primary">
            <Flame className="size-3 icon-lume" /> {filled}/{matches.length} SAISIS
          </span>
        }
      />

      <section className="glass sheen animate-rise p-5 sm:p-7" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Clock className="size-5 icon-lume" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl tracking-wide">Clôture des pronos</h2>
            <p className="truncate text-xs text-muted-foreground">
              Avant le coup d'envoi du premier match
            </p>
          </div>
        </div>
        <div className="my-6 h-px bg-border" />
        <Countdown />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {matches.map((match, i) => {
          const home = clubOf(match.home);
          const away = clubOf(match.away);
          const value = scores[match.id];
          const done = Boolean(value?.home && value?.away);
          return (
            <section
              key={match.id}
              className={`glass sheen animate-rise p-5 ${done ? "glow-warm" : ""}`}
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{match.date}</span>
                <span className="text-accent">{match.time}</span>
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <ClubCrest club={home} size={44} />
                  <b className="truncate text-xs font-semibold">{home.short}</b>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    aria-label={`Score ${home.name}`}
                    value={value?.home ?? ""}
                    onChange={(e) => set(match.id, "home", e.target.value)}
                    className="size-12 rounded-2xl border border-border bg-secondary/40 text-center font-display text-2xl text-foreground outline-none focus:border-primary"
                  />
                  <span className="font-display text-lg text-muted-foreground">:</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Score ${away.name}`}
                    value={value?.away ?? ""}
                    onChange={(e) => set(match.id, "away", e.target.value)}
                    className="size-12 rounded-2xl border border-border bg-secondary/40 text-center font-display text-2xl text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <ClubCrest club={away} size={44} />
                  <b className="truncate text-xs font-semibold">{away.short}</b>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                {(["1", "N", "2"] as const).map((k, idx) => (
                  <span
                    key={k}
                    className="rounded-xl border border-border bg-secondary/25 py-2 text-center text-muted-foreground"
                  >
                    {k} · <b className="text-foreground">{match.odds[idx]}</b>
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <button
        onClick={() => setSaved(true)}
        className="tap glow-warm flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground"
      >
        {saved ? <Check className="size-4" /> : <Save className="size-4" />}
        {saved ? "Pronostics enregistrés" : "Enregistrer mes pronostics"}
      </button>
    </AppShell>
  );
}
