import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
};

type ChatMessage = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  profile?: Profile | null;
};

type VestiaireFloatingButtonProps = {
  href?: string;
  currentPath?: string;
};

function displayName(profile?: Profile | null) {
  return profile?.pseudo?.trim() || "Joueur";
}

function initials(profile?: Profile | null) {
  const name = displayName(profile);
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function preview(content: string) {
  if (!content) return "Message";
  if (content.startsWith("media:")) return "📷 Photo";
  return content.replace(/\s+/g, " ").trim().slice(0, 72);
}

/**
 * Onglet flottant global du Vestiaire.
 *
 * À placer dans AppShell / le layout global pour l'avoir sur toutes les pages.
 * Le bouton disparaît automatiquement sur la page du Vestiaire.
 */
export function VestiaireFloatingButton({
  href = "/vestiaire",
  currentPath,
}: VestiaireFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  const isVestiairePage =
    currentPath === href ||
    (typeof window !== "undefined" && window.location.pathname === href);

  useEffect(() => {
    if (isVestiairePage) return;

    let mounted = true;

    async function loadPreview() {
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id,user_id,content,created_at")
        .order("created_at", { ascending: false })
        .limit(4);

      if (!mounted || !rows?.length) return;

      const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];

      let profiles: Profile[] = [];
      if (userIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id,pseudo,avatar_url")
          .in("id", userIds);

        profiles = data ?? [];
      }

      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

      setMessages(
        rows.map((row) => ({
          ...row,
          profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
        })),
      );
    }

    async function loadOnlineCount() {
      // La présence détaillée reste gérée par la page Vestiaire.
      // Ici on affiche uniquement le nombre de messages récents comme fallback visuel.
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if (mounted) setOnlineCount(count ?? 0);
    }

    void loadPreview();
    void loadOnlineCount();

    const channel = supabase
      .channel("vestiaire-floating-preview")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          void loadPreview();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [isVestiairePage]);

  if (isVestiairePage) return null;

  return (
    <>
      {/* Petit aperçu quand on clique sur l'onglet */}
      {open && (
        <div
          className="
            fixed bottom-24 right-5 z-[100]
            w-[330px] max-w-[calc(100vw-32px)]
            overflow-hidden rounded-3xl
            border border-purple-400/25
            bg-[#06101c]/95
            shadow-[0_25px_80px_rgba(0,0,0,.55),0_0_45px_rgba(168,85,247,.14)]
            backdrop-blur-2xl
          "
        >
          <div className="flex items-center justify-between border-b border-white/[.07] bg-gradient-to-r from-purple-500/15 via-transparent to-emerald-400/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,.18)]">
                <MessageCircle size={19} />
              </div>

              <div>
                <div className="font-display text-sm font-black uppercase text-white">
                  Le Vestiaire
                </div>
                <div className="text-[10px] text-slate-500">
                  Le chat privé du groupe
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-xl border border-white/10 text-slate-500 transition hover:bg-white/5 hover:text-white"
              aria-label="Fermer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-2 p-3">
            {messages.length ? (
              messages.slice(0, 3).map((message) => (
                <div
                  key={message.id}
                  className="flex gap-2.5 rounded-2xl border border-white/[.06] bg-white/[.025] p-2.5"
                >
                  <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-emerald-400/25 bg-gradient-to-br from-purple-500/30 to-emerald-400/20 text-[9px] font-black text-white">
                    {message.profile?.avatar_url ? (
                      <img
                        src={message.profile.avatar_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      initials(message.profile)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-emerald-300">
                      {displayName(message.profile)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-300">
                      {preview(message.content)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4 text-center">
                <MessageCircle className="mx-auto size-7 text-slate-600" />
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Le Vestiaire est calme...
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  Sois le premier à lancer la discussion !
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[.07] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              <Users size={13} />
              {onlineCount > 0 ? `${onlineCount} joueurs` : "Communauté"}
            </div>

            <Link
              to={href as never}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-400 px-3 py-2 text-[10px] font-black uppercase text-white shadow-[0_0_22px_rgba(16,185,129,.18)] transition hover:scale-[1.02]"
            >
              Ouvrir le Vestiaire
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Onglet flottant */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Ouvrir Le Vestiaire"
        aria-expanded={open}
        className="
          group fixed bottom-5 right-5 z-[101]
          flex items-center gap-3
          rounded-[22px]
          border border-purple-400/35
          bg-gradient-to-r from-[#4c1d95]/95 via-[#312e81]/95 to-[#059669]/95
          px-3 py-2.5
          shadow-[0_18px_55px_rgba(0,0,0,.45),0_0_30px_rgba(168,85,247,.20),0_0_40px_rgba(16,185,129,.12)]
          backdrop-blur-xl
          transition-all duration-300
          hover:-translate-y-1
          hover:scale-[1.02]
          hover:border-emerald-300/60
        "
      >
        <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-purple-400 via-violet-300 to-emerald-300 text-white shadow-[0_0_25px_rgba(168,85,247,.30)]">
          <MessageCircle size={23} strokeWidth={2.4} />

          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border-2 border-[#07101b] bg-emerald-400">
            <span className="size-1.5 rounded-full bg-white" />
          </span>
        </span>

        <span className="pr-1 text-left">
          <span className="block font-display text-sm font-black uppercase tracking-tight text-white">
            Le Vestiaire
          </span>
          <span className="mt-0.5 block text-[9px] font-semibold text-white/60">
            Le chat privé du groupe
          </span>
        </span>
      </button>
    </>
  );
}

export default VestiaireFloatingButton;
