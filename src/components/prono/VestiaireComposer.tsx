import { useEffect, useRef, useState } from "react";
import {
  FileText,
  ImagePlus,
  Loader2,
  Music,
  Paperclip,
  Play,
  SendHorizonal,
  X,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Attachment } from "@/lib/vestiaire";
import { MAX_ATTACHMENTS, MAX_MESSAGE_CHARS, formatBytes } from "@/lib/vestiaire";

function DraftTile({ media, onRemove }: { media: Attachment; onRemove: (id: string) => void }) {
  const isVisual = media.kind === "image" || media.kind === "gif";

  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary/30">
      {isVisual ? (
        <img src={media.url} alt={media.name} className="size-full object-cover" />
      ) : media.kind === "video" ? (
        <video
          src={media.url}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          {media.kind === "audio" ? <Music className="size-5" /> : <FileText className="size-5" />}
        </span>
      )}

      {media.kind === "gif" ? (
        <span className="absolute bottom-1 left-1 rounded-full bg-background/85 px-1.5 font-mono text-[9px] text-accent">
          GIF
        </span>
      ) : media.kind === "video" ? (
        <span className="absolute bottom-1 left-1 grid size-4 place-items-center rounded-full bg-background/85 text-accent">
          <Play className="size-2.5" />
        </span>
      ) : (
        <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-background/85 px-1.5 text-center font-mono text-[9px] text-muted-foreground">
          {formatBytes(media.size)}
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(media.id)}
        aria-label={`Retirer ${media.name}`}
        className="tap absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/85 text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function VestiaireComposer({
  text,
  onTextChange,
  attachments,
  onPick,
  onRemove,
  onSend,
  busy,
  notice,
}: {
  text: string;
  onTextChange: (value: string) => void;
  attachments: Attachment[];
  onPick: (files: FileList | File[] | null) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  busy: boolean;
  notice: string | null;
}) {
  const isMobile = useIsMobile();
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const used = text.length;
  const full = used >= MAX_MESSAGE_CHARS;
  const near = used >= MAX_MESSAGE_CHARS * 0.9;
  const slotsLeft = MAX_ATTACHMENTS - attachments.length;
  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 260)}px`;
  }, [text]);

  return (
    <div
      className={`rounded-3xl border p-3 transition-colors ${
        focused ? "border-primary/50 bg-secondary/30" : "border-border bg-secondary/20"
      }`}
    >
      {notice ? (
        <p className="mb-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs text-accent">
          {notice}
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((media) => (
            <DraftTile key={media.id} media={media} onRemove={onRemove} />
          ))}
        </div>
      ) : null}

      <textarea
        ref={textarea}
        value={text}
        maxLength={MAX_MESSAGE_CHARS}
        rows={1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onTextChange(e.target.value)}
        onPaste={(e) => {
          if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            onPick(e.clipboardData.files);
          }
        }}
        onKeyDown={(e) => {
          const shortcut = e.key === "Enter" && (e.metaKey || e.ctrlKey);
          const plainEnter = e.key === "Enter" && !e.shiftKey && !isMobile;
          if ((shortcut || plainEnter) && canSend) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Ton message… (colle une image avec Ctrl+V, glisse un GIF ici)"
        aria-label="Message pour le vestiaire"
        className="w-full resize-none bg-transparent px-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />

      <div className="mt-2 h-px w-full overflow-hidden rounded-full bg-border">
        <span
          className="block h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, (used / MAX_MESSAGE_CHARS) * 100)}%`,
            background: full ? "var(--destructive)" : near ? "var(--gold)" : "var(--sky)",
          }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          disabled={slotsLeft <= 0}
          className="tap grid size-10 place-items-center rounded-full border border-border text-accent disabled:opacity-40"
          aria-label="Ajouter une photo ou un GIF"
          title="Photo / GIF"
        >
          <ImagePlus className="size-4 icon-lume" />
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={slotsLeft <= 0}
          className="tap grid size-10 place-items-center rounded-full border border-border text-muted-foreground disabled:opacity-40"
          aria-label="Joindre un fichier"
          title="Vidéo, audio, document…"
        >
          <Paperclip className="size-4" />
        </button>

        <span
          className={`ml-auto font-mono text-[11px] ${
            full ? "text-destructive" : near ? "text-[color:var(--gold)]" : "text-muted-foreground"
          }`}
        >
          {used} / {MAX_MESSAGE_CHARS}
        </span>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="tap glow-warm grid size-11 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 disabled:shadow-none"
          aria-label="Envoyer"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
