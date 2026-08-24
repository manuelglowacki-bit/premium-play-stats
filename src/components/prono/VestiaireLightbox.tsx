import { useEffect } from "react";
import { Download, X } from "lucide-react";
import type { Attachment } from "@/lib/vestiaire";

export function VestiaireLightbox({ media, onClose }: { media: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={media.name}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass sheen animate-pop flex max-h-full w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <b className="min-w-0 flex-1 truncate text-sm">{media.name}</b>
          <a
            href={media.url}
            download={media.name}
            className="tap grid size-9 place-items-center rounded-full border border-border text-accent"
            aria-label="Télécharger"
          >
            <Download className="size-4" />
          </a>
          <button
            onClick={onClose}
            className="tap grid size-9 place-items-center rounded-full border border-border text-muted-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 items-center justify-center bg-background/40 p-3">
          {media.kind === "video" ? (
            <video
              src={media.url}
              controls
              playsInline
              className="max-h-[70vh] w-full rounded-xl"
            />
          ) : (
            <img
              src={media.url}
              alt={media.name}
              className="max-h-[70vh] w-auto rounded-xl object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
