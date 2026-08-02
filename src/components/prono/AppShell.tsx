import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown } from "lucide-react";
import stadium from "@/assets/stadium-night.jpg";
import { BottomNav } from "./BottomNav";
import { ClubCrest } from "./ClubCrest";
import { navItems } from "./nav-items";
import { clubOf } from "@/lib/prono-data";

export function AppShell({ children }: { children: ReactNode }) {
  const club = clubOf("tfc");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <img
          src={stadium}
          alt=""
          className="size-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/70 to-background/85" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-24 size-[36rem] rounded-full bg-accent/20 blur-[120px] animate-drift"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-52 top-[46rem] size-[34rem] rounded-full bg-primary/15 blur-[130px] animate-drift"
      />

      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center gap-8 px-5 py-4 sm:px-7">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary font-display text-sm font-extrabold text-primary icon-lume">
            L1
          </span>
          <span className="min-w-0 leading-none">
            <b className="block font-display text-lg tracking-wide">PRONO</b>
            <strong className="block font-display text-base tracking-wide text-accent">
              LIGUE <i className="not-italic text-primary">1</i>
            </strong>
          </span>
        </Link>

        <nav className="mx-auto hidden items-center gap-7 lg:flex" aria-label="Navigation">
          {navItems.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className: "text-foreground [text-shadow:0_0_18px_var(--sky)]",
              }}
              activeOptions={{ exact: to === "/" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button className="tap relative grid size-10 place-items-center rounded-full border border-border text-accent">
            <Bell className="size-4 icon-lume" />
            <b className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">
              3
            </b>
          </button>
          <Link
            to="/profil"
            className="tap flex items-center gap-2 rounded-full border border-border px-2 py-1.5 text-left"
          >
            <ClubCrest club={club} size={22} />
            <span className="hidden sm:block">
              <strong className="block text-xs">Red evils</strong>
              <small className="block text-[10px] text-muted-foreground">Mon profil</small>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1240px] space-y-5 px-4 pb-32 pt-3 sm:space-y-6 sm:px-7 lg:pb-16">
        {children}

        <footer className="flex flex-wrap items-center gap-2 px-1 pb-2 text-xs text-muted-foreground">
          <span className="font-display text-base tracking-wide text-foreground">PRONO LIGUE</span>
          Le football se joue aussi dans les pronostics.
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}

export function PageHead({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className="glass sheen glow-sky animate-rise grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 p-5 sm:flex sm:justify-between sm:p-8">
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.18em] text-accent">{kicker}</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.2rem)] leading-none tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
