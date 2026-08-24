import { Download, FileText, Music, Play } from "lucide-react";
import type { Attachment, ChatMessage } from "@/lib/vestiaire";
import { formatBytes, formatTime } from "@/lib/vestiaire";

function MediaTile({
  media,
  onOpen,
  full,
}: {
  media: Attachment;
  onOpen: (media: Attachment) => void;
  full: boolean;
}) {
  if (media.kind === "image" || media.kind === "gif") {
    return (
      <button
        type="button"
        onClick={() => onOpen(media)}
        className={`tap group relative overflow-hidden rounded-2xl border border-border ${
          full ? "block w-fit" : "block"
        }`}
      >
        <img
          src={media.url}
          alt={media.name}
          loading="lazy"
          className={
            full
              ? "max-h-96 w-auto max-w-full object-contain"
              : "aspect-square size-full object-cover"
          }
        />
        {media.kind === "gif" ? (
          <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] tracking-widest text-accent">
            GIF
          </span>
        ) : null}
      </button>
    );
  }

  if (media.kind === "video") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <video
          src={media.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-96 w-full bg-background/60"
        />
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] text-accent">
          <Play className="size-3" /> VIDÉO
        </span>
      </div>
    );
  }

  if (media.kind === "audio") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/25 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Music className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-xs">{media.name}</b>
          <audio src={media.url} controls className="mt-2 w-full" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={media.url}
      download={media.name}
      className="tap flex items-center gap-3 rounded-2xl border border-border bg-secondary/25 p-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-xs">{media.name}</b>
        <small className="block font-mono text-[10px] text-muted-foreground">
          {formatBytes(media.size)}
        </small>
      </span>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function VestiaireMessage({
  message,
  showTime,
  onOpenMedia,
}: {
  message: ChatMessage;
  /** Les heures ne sont rendues qu'après montage : le fuseau du serveur diffère. */
  showTime: boolean;
  onOpenMedia: (media: Attachment) => void;
}) {
  const visuals = message.attachments.filter(
    (a) => a.kind === "image" || a.kind === "gif" || a.kind === "video",
  );
  const others = message.attachments.filter((a) => !visuals.includes(a));
  const single = visuals.length === 1;

  return (
    <article className={`flex gap-3 ${message.mine ? "flex-row-reverse" : ""}`}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold"
        style={{
          background: `color-mix(in oklab, ${message.tone} 28%, transparent)`,
          color: message.tone,
          boxShadow: `0 0 18px color-mix(in oklab, ${message.tone} 28%, transparent)`,
        }}
      >
        {message.initial}
      </span>

      <div className={`min-w-0 max-w-[min(42rem,86%)] ${message.mine ? "items-end" : ""}`}>
        <div
          className={`flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground ${
            message.mine ? "justify-end" : ""
          }`}
        >
          <b className="text-foreground">{message.author}</b>
          <span>{showTime ? formatTime(message.at) : ""}</span>
        </div>

        <div
          className={`mt-1.5 rounded-2xl border p-3 ${
            message.mine ? "border-primary/35 bg-primary/12" : "border-border bg-secondary/25"
          }`}
        >
          {message.text ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.text}
            </p>
          ) : null}

          {visuals.length > 0 ? (
            <div
              className={`grid gap-2 ${message.text ? "mt-3" : ""} ${
                single ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {visuals.map((media) => (
                <MediaTile key={media.id} media={media} onOpen={onOpenMedia} full={single} />
              ))}
            </div>
          ) : null}

          {others.length > 0 ? (
            <div className={`grid gap-2 ${message.text || visuals.length ? "mt-3" : ""}`}>
              {others.map((media) => (
                <MediaTile key={media.id} media={media} onOpen={onOpenMedia} full={false} />
              ))}
            </div>
          ) : null}

          {message.dropped ? (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {message.dropped} média{message.dropped > 1 ? "s" : ""} trop lourd
              {message.dropped > 1 ? "s" : ""} pour l'historique local
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
