/**
 * MESSAGES PRIVÉS — PANNEAU DU VESTIAIRE
 * ======================================
 * Deux écrans dans un seul panneau : la liste des joueurs (avec les
 * conversations en cours remontées en haut), et le fil avec l'un d'eux.
 *
 * Volontairement à part de trophees.tsx, qui dépasse déjà les trois mille
 * lignes : cette fonctionnalité se lit, se corrige et s'annule seule.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Search, Send, Trash2, X } from "lucide-react";
import {
  LONGUEUR_MAX,
  abonnerMessagesRecus,
  chargerMesMessages,
  compterNonLus,
  envoyerMessagePrive,
  filArrangeAvec,
  grouperEnConversations,
  marquerLu,
  supprimerMonMessage,
  type MessagePrive,
} from "@/lib/messagesPrives";

export type JoueurJoignable = {
  id: string;
  pseudo: string;
  avatar_url?: string | null;
};

type Props = {
  moi: string;
  joueurs: JoueurJoignable[];
  /** Ouvre directement le fil avec cette personne (depuis sa fiche). */
  ouvrirAvec?: string | null;
  onFermer: () => void;
  /** Remonte le nombre de messages non lus, pour la pastille de l'entête. */
  onNonLus?: (nombre: number) => void;
};

function initiales(nom: string) {
  return nom.trim().slice(0, 2).toUpperCase() || "??";
}

function heure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function quand(iso: string) {
  const date = new Date(iso);
  const maintenant = new Date();
  const memeJour = date.toDateString() === maintenant.toDateString();
  if (memeJour) return heure(iso);
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (date.toDateString() === hier.toDateString()) return "hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function MessagesPrives({ moi, joueurs, ouvrirAvec, onFermer, onNonLus }: Props) {
  const [messages, setMessages] = useState<MessagePrive[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(ouvrirAvec ?? null);
  const [recherche, setRecherche] = useState("");
  const [brouillon, setBrouillon] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const basDuFil = useRef<HTMLDivElement | null>(null);
  const champ = useRef<HTMLTextAreaElement | null>(null);

  const parId = useMemo(() => new Map(joueurs.map((j) => [j.id, j])), [joueurs]);

  // ---------- Chargement ----------
  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        const lignes = await chargerMesMessages(moi);
        if (annule) return;
        setMessages(lignes);
      } catch (e) {
        if (annule) return;
        // On montre le message brut de la base : une traduction approximative
        // cacherait la vraie cause (table absente, regle refusee...).
        setErreur((e as { message?: string })?.message || "Les messages n'ont pas pu être chargés.");
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [moi]);

  // ---------- Temps réel ----------
  useEffect(() => {
    return abonnerMessagesRecus(moi, (recu) => {
      setMessages((actuels) => (actuels.some((m) => m.id === recu.id) ? actuels : [recu, ...actuels]));
    });
  }, [moi]);

  // ---------- Pastille ----------
  const nonLus = useMemo(() => compterNonLus(messages, moi), [messages, moi]);
  useEffect(() => {
    onNonLus?.(nonLus);
  }, [nonLus, onNonLus]);

  // ---------- Passage en « lu » à l'ouverture d'un fil ----------
  useEffect(() => {
    if (!ouvert) return;
    const aMarquer = messages.some(
      (m) => m.sender_id === ouvert && m.recipient_id === moi && m.read_at === null,
    );
    if (!aMarquer) return;

    const quandLu = new Date().toISOString();
    // On l'applique tout de suite a l'ecran : la pastille doit disparaitre au
    // moment ou l'on ouvre, pas au retour du serveur.
    setMessages((actuels) =>
      actuels.map((m) =>
        m.sender_id === ouvert && m.recipient_id === moi && m.read_at === null
          ? { ...m, read_at: quandLu }
          : m,
      ),
    );
    void marquerLu(moi, ouvert).catch(() => {
      // Sans consequence visible : la prochaine ouverture reessaiera.
    });
  }, [ouvert, messages, moi]);

  const conversations = useMemo(() => grouperEnConversations(messages, moi), [messages, moi]);
  const fil = useMemo(
    () => (ouvert ? filArrangeAvec(messages, moi, ouvert) : []),
    [messages, moi, ouvert],
  );

  useEffect(() => {
    if (ouvert) basDuFil.current?.scrollIntoView({ block: "end" });
  }, [ouvert, fil.length]);

  // ---------- Liste : conversations d'abord, puis le reste de la ligue ----------
  const liste = useMemo(() => {
    const rang = new Map(conversations.map((c, index) => [c.autreId, index]));
    const terme = recherche.trim().toLowerCase();

    return joueurs
      .filter((joueur) => joueur.id !== moi)
      .filter((joueur) => !terme || joueur.pseudo.toLowerCase().includes(terme))
      .map((joueur) => ({
        joueur,
        conversation: conversations.find((c) => c.autreId === joueur.id) ?? null,
        rang: rang.has(joueur.id) ? (rang.get(joueur.id) as number) : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => {
        if (a.rang !== b.rang) return a.rang - b.rang;
        return a.joueur.pseudo.localeCompare(b.joueur.pseudo, "fr");
      });
  }, [joueurs, conversations, recherche, moi]);

  const envoyer = useCallback(async () => {
    const texte = brouillon.trim();
    if (!texte || !ouvert || envoiEnCours) return;

    setEnvoiEnCours(true);
    setErreur("");
    try {
      const cree = await envoyerMessagePrive(moi, ouvert, texte);
      setMessages((actuels) => [cree, ...actuels]);
      setBrouillon("");
      champ.current?.focus();
    } catch (e) {
      setErreur((e as { message?: string })?.message || "Le message n'a pas pu être envoyé.");
    } finally {
      setEnvoiEnCours(false);
    }
  }, [brouillon, ouvert, envoiEnCours, moi]);

  const retirer = useCallback(async (id: string) => {
    const avant = messages;
    setMessages((actuels) => actuels.filter((m) => m.id !== id));
    try {
      await supprimerMonMessage(id);
    } catch (e) {
      // Remis en place : mieux vaut un message qui revient qu'un message qu'on
      // croit efface alors qu'il est toujours chez l'autre.
      setMessages(avant);
      setErreur((e as { message?: string })?.message || "Le message n'a pas pu être supprimé.");
    }
  }, [messages]);

  const autre = ouvert ? parId.get(ouvert) : undefined;

  return (
    // Fond OPAQUE, et non translucide : le salon commun transparaissait
    // derriere une conversation privee. Pour tout le reste du site ce serait un
    // detail d'esthetique ; ici c'est le sujet meme de la fonctionnalite.
    <div className="absolute inset-0 z-40 flex min-h-0 flex-col bg-[#050c16]">
      {/* ---------- Entête ---------- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/[.07] px-3 py-3 sm:gap-3 sm:px-5">
        {ouvert ? (
          <button
            type="button"
            onClick={() => setOuvert(null)}
            className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-slate-300 transition hover:text-white"
            aria-label="Revenir aux conversations"
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-purple-400/25 bg-purple-400/10 text-purple-300">
            <Lock size={15} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-black uppercase tracking-tighter text-white sm:text-lg sm:tracking-tight">
            {autre ? autre.pseudo : "Messages privés"}
          </div>
          <div className="truncate text-[10px] text-slate-500">
            {autre ? "Vous deux seulement" : "Personne d'autre ne les voit"}
          </div>
        </div>

        <button
          type="button"
          onClick={onFermer}
          className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-slate-300 transition hover:text-white"
          aria-label="Fermer les messages privés"
        >
          <X size={16} />
        </button>
      </header>

      {erreur && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-200">
          {erreur}
        </div>
      )}

      {/* ---------- Liste des joueurs ---------- */}
      {!ouvert && (
        <>
          <div className="shrink-0 px-3 py-2.5 sm:px-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2">
              <Search size={14} className="shrink-0 text-slate-500" />
              <input
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Chercher un joueur..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 sm:px-4">
            {chargement && <p className="px-3 py-6 text-center text-sm text-slate-500">Chargement...</p>}

            {!chargement && liste.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Aucun joueur à ce nom.</p>
            )}

            {liste.map(({ joueur, conversation }) => (
              <button
                key={joueur.id}
                type="button"
                onClick={() => setOuvert(joueur.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/[.05]"
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-emerald-400/25 to-slate-900 text-[10px] font-black text-white">
                  {joueur.avatar_url ? (
                    <img src={joueur.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    initiales(joueur.pseudo)
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold text-white">{joueur.pseudo}</span>
                    {conversation?.dernier && (
                      <span className="shrink-0 font-mono text-[9px] text-slate-500">
                        {quand(conversation.dernier.created_at)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {conversation?.dernier
                      ? `${conversation.dernier.sender_id === moi ? "Toi : " : ""}${conversation.dernier.content}`
                      : "Démarrer une conversation"}
                  </span>
                </span>

                {conversation && conversation.nonLus > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-black text-slate-950">
                    {conversation.nonLus}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------- Le fil ---------- */}
      {ouvert && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
            {fil.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-slate-500">
                Rien encore. Écris le premier message.
              </p>
            )}

            {fil.map((message) => {
              const deMoi = message.sender_id === moi;
              return (
                <div key={message.id} className={`group mb-2.5 flex ${deMoi ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[82%] items-end gap-1.5 ${deMoi ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        deMoi
                          ? "rounded-br-md bg-emerald-400/90 text-slate-950"
                          : "rounded-bl-md border border-white/[.08] bg-white/[.05] text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      <p
                        className={`mt-1 text-right font-mono text-[9px] ${
                          deMoi ? "text-slate-900/60" : "text-slate-500"
                        }`}
                      >
                        {heure(message.created_at)}
                        {deMoi && message.read_at ? " · lu" : ""}
                      </p>
                    </div>

                    {deMoi && (
                      <button
                        type="button"
                        onClick={() => void retirer(message.id)}
                        className="shrink-0 p-1 text-slate-600 opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                        aria-label="Supprimer ce message"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={basDuFil} />
          </div>

          <div className="shrink-0 border-t border-white/[.07] px-3 py-3 sm:px-5">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-3 py-2">
              <textarea
                ref={champ}
                rows={1}
                value={brouillon}
                maxLength={LONGUEUR_MAX}
                onChange={(event) => setBrouillon(event.target.value)}
                onKeyDown={(event) => {
                  // Meme reflexe que le salon commun : Entree envoie,
                  // Maj+Entree passe a la ligne.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void envoyer();
                  }
                }}
                placeholder={`Message à ${autre?.pseudo ?? ""}...`}
                className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm text-white outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => void envoyer()}
                disabled={!brouillon.trim() || envoiEnCours}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400 text-slate-950 transition disabled:opacity-35"
                aria-label="Envoyer"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-1 pr-1 text-right font-mono text-[9px] text-slate-600">
              {brouillon.length}/{LONGUEUR_MAX}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
