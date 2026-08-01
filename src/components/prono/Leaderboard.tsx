import { useEffect, useState } from "react";
import { ChevronRight, Crown, Minus, MoveUpRight, Trophy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { clubOf, ranking, type Player } from "@/lib/prono-data";
import { ClubCrest } from "./ClubCrest";

function Movement({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="size-3" /> 0
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-semibold text-mint icon-lume">
      <MoveUpRight className="size-3" /> {value}
    </span>
  );
}

function Podium({ players }: { players: Player[] }) {
  const order = [players[1], players[0], players[2]].filter(
    (p): p is Player => Boolean(p),
  );
  const heights = ["h-44", "h-56", "h-36"];
  const accents = [
    "from-sky/25 to-transparent border-sky/40",
    "from-gold/30 to-transparent border-gold/60 glow-warm",
    "from-primary/25 to-transparent border-primary/40",
  ];
  return (
    <div className="flex items-end gap-3 pt-10">
      {order.map((player, i) => (
        <div
          key={player.name}
          className={`relative flex flex-1 flex-col items-center justify-end rounded-2xl border bg-gradient-to-b px-2 pb-4 ${i === 1 ? "pt-24" : "pt-16"} ${heights[i]} ${accents[i]} animate-rise`}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          {i === 1 && (
            <Crown className="animate-pop absolute top-2 size-7 text-gold icon-lume" />
          )}
          <span
            className={`absolute ${i === 1 ? "top-11" : "top-3"} grid size-9 place-items-center rounded-full border border-border bg-popover font-mono text-xs font-bold text-foreground`}
          >
            {player.rank}
          </span>
          <ClubCrest club={clubOf(player.club)} size={i === 1 ? 44 : 36} className="mb-2" />
          <b className="font-display text-lg leading-none tracking-wide">{player.name}</b>
          <small className="mt-1 text-[10px] text-muted-foreground">
            {player.exact} scores exacts
          </small>
          <strong className="mt-2 font-display text-3xl leading-none text-foreground">
            {player.score}
            <i className="ml-1 font-sans text-[10px] not-italic text-muted-foreground">pts</i>
          </strong>
        </div>
      ))}
    </div>
  );
}

export function Leaderboard() {
  const [updatedAt, setUpdatedAt] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setUpdatedAt(1), 900);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <section className="glass sheen glow-sky animate-rise p-5 sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
            À L'ISSUE DE LA J5
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl tracking-wide sm:text-3xl">
            <Trophy className="size-6 text-gold icon-lume" /> Classement général
          </h2>
        </div>
        <Link
          to="/classement"
          className="tap inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-semibold text-accent"
        >
          Complet <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-7">
        <Podium players={ranking} />
      </div>

      <div className="mt-7 space-y-2">
        {ranking.map((player, i) => (
          <div
            key={player.name}
            className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 sm:grid-cols-[28px_minmax(0,1fr)_auto_auto_auto] sm:gap-4 ${
              player.current
                ? "border-primary/45 bg-primary/10"
                : "border-border bg-secondary/25"
            } animate-rise tap`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <b className="font-display text-lg text-muted-foreground">{player.rank}</b>
            <span className="flex min-w-0 items-center gap-3">
              <ClubCrest club={clubOf(player.club)} size={26} className="shrink-0" />
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-[11px] font-bold"
                style={{ background: player.tone }}
              >
                {player.initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{player.name}</span>
                <small className="block truncate text-[10px] text-muted-foreground">
                  {player.current ? "TOI · en course" : clubOf(player.club).name}
                </small>
              </span>
            </span>
            <strong
              key={`${player.name}-${updatedAt}`}
              className="animate-flash rounded-lg px-2 font-display text-xl"
            >
              {player.score}
              <i className="ml-1 font-sans text-[10px] not-italic text-muted-foreground">pts</i>
            </strong>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {player.score === 150 ? "Leader" : `−${150 - player.score}`}
            </span>
            <span className="hidden sm:block">
              <Movement value={player.movement} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}