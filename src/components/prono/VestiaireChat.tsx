import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { VestiaireComposer } from "./VestiaireComposer";
import { VestiaireLightbox } from "./VestiaireLightbox";
import { VestiaireMessage } from "./VestiaireMessage";
import type { Attachment, ChatMessage } from "@/lib/vestiaire";
import {
  MAX_ATTACHMENTS,
  clearMessages,
  createMessage,
  loadMessages,
  prepareAttachment,
  releaseAttachments,
  saveMessages,
  seedMessages,
} from "@/lib/vestiaire";

export function VestiaireChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    const stored = loadMessages();
    if (stored) setMessages(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveMessages(messages);
  }, [messages, ready]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, drafts.length]);

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;

      setBusy(true);
      setNotice(null);

      const problems: string[] = [];
      const prepared: Attachment[] = [];
      let slots = MAX_ATTACHMENTS - drafts.length;

      for (const file of list) {
        if (slots <= 0) {
          problems.push(`${MAX_ATTACHMENTS} pièces jointes maximum par message`);
          break;
        }
        try {
          prepared.push(await prepareAttachment(file));
          slots -= 1;
        } catch (error) {
          problems.push(error instanceof Error ? error.message : `« ${file.name} » a été refusé`);
        }
      }

      if (prepared.length > 0) setDrafts((prev) => [...prev, ...prepared]);
      const heavy = prepared.filter((a) => !a.persisted).length;
      if (heavy > 0) {
        problems.push(
          `${heavy} média${heavy > 1 ? "s" : ""} trop lourd${heavy > 1 ? "s" : ""} pour l'historique : visible${heavy > 1 ? "s" : ""} jusqu'au prochain rechargement`,
        );
      }
      setNotice(problems.length > 0 ? [...new Set(problems)].join(" · ") : null);
      setBusy(false);
    },
    [drafts.length],
  );

  const removeDraft = (id: string) => {
    setDrafts((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) releaseAttachments([target]);
      return prev.filter((a) => a.id !== id);
    });
  };

  const send = () => {
    const body = text.trim();
    if (!body && drafts.length === 0) return;
    setMessages((prev) => [...prev, createMessage(body, drafts)]);
    setText("");
    setDrafts([]);
    setNotice(null);
  };

  const reset = () => {
    clearMessages();
    setMessages(seedMessages);
    setNotice("Historique du vestiaire remis à zéro.");
  };

  return (
    <section
      className="glass sheen animate-rise relative flex flex-col p-3 sm:p-5"
      style={{ animationDelay: "120ms" }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-primary/60 bg-background/70">
          <p className="flex items-center gap-2 font-display text-xl tracking-wide text-primary">
            <ImageUp className="size-5 icon-lume" /> Lâche ton fichier ici
          </p>
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-3 px-2 pb-3">
        <h2 className="font-display text-xl tracking-wide">Discussion</h2>
        <button
          type="button"
          onClick={reset}
          className="tap inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground"
        >
          <Trash2 className="size-3" /> VIDER
        </button>
      </header>

      <div
        ref={scroller}
        className="flex max-h-[60vh] min-h-[18rem] flex-col gap-5 overflow-y-auto px-1 py-2"
      >
        {messages.map((message) => (
          <VestiaireMessage
            key={message.id}
            message={message}
            showTime={ready}
            onOpenMedia={setPreview}
          />
        ))}
      </div>

      <div className="pt-3">
        <VestiaireComposer
          text={text}
          onTextChange={setText}
          attachments={drafts}
          onPick={(files) => void addFiles(files)}
          onRemove={removeDraft}
          onSend={send}
          busy={busy}
          notice={notice}
        />
      </div>

      {preview ? <VestiaireLightbox media={preview} onClose={() => setPreview(null)} /> : null}
    </section>
  );
}
