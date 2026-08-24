import { createFileRoute } from "@tanstack/react-router";
import { FileVideo, ImagePlus, MessagesSquare, Type } from "lucide-react";
import { AppShell, PageHead } from "@/components/prono/AppShell";
import { VestiaireChat } from "@/components/prono/VestiaireChat";
import { ranking } from "@/lib/prono-data";
import { MAX_ATTACHMENTS, MAX_FILE_BYTES, MAX_MESSAGE_CHARS, formatBytes } from "@/lib/vestiaire";

export const Route = createFileRoute("/vestiaire")({
  head: () => ({
    meta: [
      { title: "Le Vestiaire — Prono Ligue 1" },
      {
        name: "description",
        content:
          "Le chat de la ligue : messages jusqu'à 2000 caractères, photos, GIF, vidéos et fichiers entre pronostiqueurs.",
      },
      { property: "og:title", content: "Le Vestiaire de la ligue" },
      {
        property: "og:description",
        content: "Chambre tes adversaires : messages longs, photos, GIF et vidéos.",
      },
    ],
  }),
  component: VestiairePage,
});

const rules = [
  {
    icon: Type,
    label: "Texte",
    value: `${MAX_MESSAGE_CHARS} caractères`,
    hint: "Compteur en direct sous le champ",
    tone: "var(--sky)",
  },
  {
    icon: ImagePlus,
    label: "Photos & GIF",
    value: "Tous formats",
    hint: "JPG, PNG, WebP, HEIC, GIF animés",
    tone: "var(--gold)",
  },
  {
    icon: FileVideo,
    label: "Vidéos & fichiers",
    value: formatBytes(MAX_FILE_BYTES),
    hint: `${MAX_ATTACHMENTS} pièces jointes par message`,
    tone: "var(--mint)",
  },
];

function VestiairePage() {
  return (
    <AppShell>
      <PageHead
        kicker="LE CHAT DE LA LIGUE"
        title="Le Vestiaire"
        subtitle="Chambrage, classements et GIF de célébration : tout se passe ici."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] text-accent">
            <MessagesSquare className="size-3 icon-lume" /> {ranking.length} MEMBRES
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {rules.map(({ icon: Icon, label, value, hint, tone }, i) => (
          <section
            key={label}
            className="glass sheen animate-rise flex items-center gap-3 p-4"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-2xl"
              style={{
                background: `color-mix(in oklab, ${tone} 16%, transparent)`,
                color: tone,
              }}
            >
              <Icon className="size-4 icon-lume" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                {label.toUpperCase()}
              </p>
              <b className="block font-display text-lg leading-tight tracking-wide">{value}</b>
              <small className="block truncate text-[11px] text-muted-foreground">{hint}</small>
            </div>
          </section>
        ))}
      </div>

      <VestiaireChat />

      <p className="px-2 text-[11px] text-muted-foreground">
        Les messages restent sur cet appareil : ils sont conservés dans le navigateur, pas sur un
        serveur. Les médias les plus lourds ne sont visibles que jusqu'au prochain rechargement.
      </p>
    </AppShell>
  );
}
