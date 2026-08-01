import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Newspaper } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { articles } from "@/lib/prono-data";

export const Route = createFileRoute("/gazette")({
  head: () => ({
    meta: [
      { title: "La Gazette — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Édito, analyses et duels de la ligue de pronostics : toute l'actualité du championnat entre amis.",
      },
      { property: "og:title", content: "La Gazette de la ligue" },
      {
        property: "og:description",
        content: "Édito, analyses et duels : l'actualité de ta ligue de pronostics.",
      },
    ],
  }),
  component: GazettePage,
});

function GazettePage() {
  const [lead, ...rest] = articles;

  return (
    <AppShell>
      <PageHead
        kicker="NUMÉRO 5 · SAISON 2026—2027"
        title="La Gazette"
        subtitle="Ce qu'il faut retenir de la journée, vu depuis la ligue."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-accent">
            <Newspaper className="size-3 icon-lume" /> {articles.length} ARTICLES
          </span>
        }
      />

      {lead ? (
        <article
          className="glass sheen glow-warm animate-rise p-6 sm:p-9"
          style={{ animationDelay: "80ms" }}
        >
          <span
            className="inline-block rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em]"
            style={{ background: "color-mix(in oklab, var(--gold) 18%, transparent)", color: "var(--gold)" }}
          >
            {lead.tag}
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.8rem,4.4vw,2.8rem)] leading-tight tracking-tight">
            {lead.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">{lead.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="text-foreground">{lead.author}</span>
            <span>{lead.date}</span>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {rest.map((article, i) => (
          <article
            key={article.id}
            className="glass sheen animate-rise tap flex flex-col p-5"
            style={{ animationDelay: `${160 + i * 90}ms` }}
          >
            <span
              className="inline-block w-fit rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em]"
              style={{
                background: `color-mix(in oklab, ${article.tone} 16%, transparent)`,
                color: article.tone,
              }}
            >
              {article.tag}
            </span>
            <h3 className="mt-4 font-display text-xl leading-tight tracking-wide">
              {article.title}
            </h3>
            <p className="mt-3 flex-1 text-xs text-muted-foreground">{article.excerpt}</p>
            <div className="mt-5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{article.date}</span>
              <ArrowRight className="size-4 text-primary" />
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
