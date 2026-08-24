import { ranking } from "./prono-data";

/** Longueur maximale d'un message, en caractères (même unité que `textarea.maxLength`). */
export const MAX_MESSAGE_CHARS = 2000;
/** Nombre de pièces jointes autorisées dans un même message. */
export const MAX_ATTACHMENTS = 6;
/** Taille maximale acceptée pour un fichier, avant compression. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Au-delà, une photo est redimensionnée avant d'être envoyée. */
export const COMPRESS_OVER_BYTES = 900 * 1024;
/** Côté le plus long d'une photo après redimensionnement. */
export const IMAGE_MAX_EDGE = 1600;
/** Au-delà, la pièce jointe reste en mémoire et n'est pas conservée au rechargement. */
export const PERSIST_MAX_BYTES = 1.5 * 1024 * 1024;
/** Nombre de messages gardés dans l'historique local. */
export const MAX_HISTORY = 200;

const STORAGE_KEY = "prono-vestiaire-v1";

export type AttachmentKind = "image" | "gif" | "video" | "audio" | "file";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  /** Taille finale, après compression éventuelle. */
  size: number;
  /** `data:` (conservée au rechargement) ou `blob:` (le temps de la session). */
  url: string;
  width?: number;
  height?: number;
  /** `false` pour un média trop lourd pour l'historique local. */
  persisted: boolean;
};

export type ChatMessage = {
  id: string;
  author: string;
  initial: string;
  tone: string;
  club: string;
  /** Timestamp epoch — formaté côté client uniquement, pour ne pas casser l'hydratation. */
  at: number;
  text: string;
  attachments: Attachment[];
  mine: boolean;
  /** Médias retirés de l'historique local faute de place. */
  dropped?: number;
};

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "avif", "heic", "heif", "bmp", "svg"];
const VIDEO_EXT = ["mp4", "mov", "webm", "mkv", "m4v"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "m4a", "aac", "opus"];

/** Formats qu'on peut recompresser sans perdre d'animation ni de transparence utile. */
const COMPRESSIBLE = ["image/jpeg", "image/png", "image/bmp", "image/heic", "image/heif"];

export function kindOf(mime: string, name: string): AttachmentKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mime === "image/gif" || ext === "gif") return "gif";
  if (mime.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXT.includes(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXT.includes(ext)) return "audio";
  return "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Heure du message. Toujours appelé côté client : le fuseau du serveur diffère. */
export function formatTime(at: number): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return time;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return `Hier ${time}`;
  return `${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ${time}`;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(blob);
  });
}

function measure(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Redimensionne une photo trop lourde. Renvoie `null` si la compression n'apporte rien. */
async function shrinkImage(
  file: File,
): Promise<{ blob: Blob; mime: string; width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob || blob.size >= file.size) return null;
  return { blob, mime: "image/webp", width, height };
}

/**
 * Prépare un fichier choisi, collé ou déposé : compression des photos lourdes,
 * puis `data:` URL si la taille permet de la garder dans l'historique local.
 */
export async function prepareAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`« ${file.name} » dépasse ${formatBytes(MAX_FILE_BYTES)}`);
  }

  const kind = kindOf(file.type, file.name);
  const mimeIn = file.type || "application/octet-stream";

  let blob: Blob = file;
  let mime = mimeIn;
  let width: number | undefined;
  let height: number | undefined;

  if (kind === "image" && COMPRESSIBLE.includes(mimeIn) && file.size > COMPRESS_OVER_BYTES) {
    const shrunk = await shrinkImage(file);
    if (shrunk) {
      blob = shrunk.blob;
      mime = shrunk.mime;
      width = shrunk.width;
      height = shrunk.height;
    }
  }

  const persisted = blob.size <= PERSIST_MAX_BYTES;
  const url = persisted ? await readAsDataUrl(blob) : URL.createObjectURL(blob);

  if ((kind === "image" || kind === "gif") && width === undefined) {
    const size = await measure(url);
    if (size) {
      width = size.width;
      height = size.height;
    }
  }

  return {
    id: newId(),
    kind,
    name: file.name || "fichier",
    mime,
    size: blob.size,
    url,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    persisted,
  };
}

export function createMessage(text: string, attachments: Attachment[]): ChatMessage {
  const me = ranking.find((p) => p.current);
  return {
    id: newId(),
    author: me?.name ?? "Moi",
    initial: me?.initial ?? "M",
    tone: me?.tone ?? "var(--primary)",
    club: me?.club ?? "tfc",
    at: Date.now(),
    text: text.slice(0, MAX_MESSAGE_CHARS),
    attachments,
    mine: true,
  };
}

export function releaseAttachments(attachments: Attachment[]): void {
  for (const item of attachments) {
    if (!item.persisted && item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
  }
}

/** Ne garde que ce qui survit à un rechargement : les `data:` URL. */
function serialize(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_HISTORY).map((message) => {
    const kept = message.attachments.filter((a) => a.persisted);
    const dropped = (message.dropped ?? 0) + (message.attachments.length - kept.length);
    return { ...message, attachments: kept, ...(dropped > 0 ? { dropped } : {}) };
  });
}

/** Libère de la place : d'abord les médias les plus anciens, puis les messages. */
function shed(messages: ChatMessage[]): ChatMessage[] | null {
  const index = messages.findIndex((m) => m.attachments.length > 0);
  if (index >= 0) {
    const target = messages[index]!;
    const next = [...messages];
    next[index] = {
      ...target,
      attachments: [],
      dropped: (target.dropped ?? 0) + target.attachments.length,
    };
    return next;
  }
  return messages.length > 1 ? messages.slice(1) : null;
}

export function loadMessages(): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as ChatMessage[];
  } catch {
    return null;
  }
}

/** Écrit l'historique local, en allégeant tant que le quota du navigateur refuse. */
export function saveMessages(messages: ChatMessage[]): boolean {
  let working: ChatMessage[] | null = serialize(messages);
  while (working) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(working));
      return true;
    } catch {
      working = shed(working);
    }
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible (navigation privée) : le chat reste en mémoire */
  }
  return false;
}

export function clearMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* rien à nettoyer */
  }
}

/** Récapitulatif du classement, construit depuis les données de la ligue. */
export const rankingRecap = [
  "🏆 CLASSEMENT — JOURNÉE 1",
  "",
  ...ranking.map((p) => `${p.rank}. ${p.name} — ${p.score} pts`),
  "",
  "⚔️ Ça se tient en quelques points : une bonne journée et tout bascule.",
  "🔥 J2 : qui confirme, qui remonte ? À vous de jouer ⚽",
].join("\n");

/** Base fixe : des timestamps déterministes évitent tout écart serveur / client. */
const SEED_BASE = Date.UTC(2026, 7, 21, 18, 0);
const minutes = (n: number) => SEED_BASE - n * 60_000;

export const seedMessages: ChatMessage[] = [
  {
    id: "seed-1",
    author: "La Rédac",
    initial: "R",
    tone: "var(--gold)",
    club: "psg",
    at: minutes(180),
    text: "Bienvenue dans le vestiaire 🔥 Ici on chambre, on partage les captures du classement et les GIF de célébration. 2000 caractères par message, photos, GIF, vidéos et fichiers acceptés.",
    attachments: [],
    mine: false,
  },
  {
    id: "seed-2",
    author: "La Rédac",
    initial: "R",
    tone: "var(--gold)",
    club: "psg",
    at: minutes(174),
    text: rankingRecap,
    attachments: [],
    mine: false,
  },
  {
    id: "seed-3",
    author: "Eric",
    initial: "E",
    tone: "#167cb0",
    club: "om",
    at: minutes(96),
    text: "150 points partout avec Samuel… ça va se jouer sur les scores exacts 😤",
    attachments: [],
    mine: false,
  },
  {
    id: "seed-4",
    author: "Jo B",
    initial: "J",
    tone: "#bc5628",
    club: "losc",
    at: minutes(64),
    text: "Deux places reprises cette journée, je reviens 🚀",
    attachments: [],
    mine: false,
  },
  {
    id: "seed-5",
    author: "Red evils",
    initial: "R",
    tone: "#aa2c37",
    club: "tfc",
    at: minutes(12),
    text: "Rendez-vous en J2, je prépare la remontada 💪",
    attachments: [],
    mine: true,
  },
];
