/**
 * MESSAGES PRIVÉS DU VESTIAIRE
 * ============================
 * Le salon commun est lu par les 23 joueurs. Ici, une conversation à deux.
 *
 * Tout l'accès aux données passe par ce fichier : le composant ne parle jamais
 * directement à la base. Ça garde un seul endroit où vérifier ce qui est lu et
 * écrit — pour des messages privés, c'est ce qui compte le plus.
 *
 * La confidentialité elle-même n'est PAS assurée ici. Elle l'est en base, par
 * les règles de supabase/migrations/20260825120000_messages_prives.sql : même
 * une requête mal écrite depuis ce fichier ne peut pas rapporter la
 * conversation de quelqu'un d'autre. Ce qui suit n'est que du confort.
 */

import { supabase } from "@/lib/supabase";

export type MessagePrive = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

/** Une conversation, telle qu'affichée dans la liste. */
export type Conversation = {
  /** L'autre personne. */
  autreId: string;
  dernier: MessagePrive | null;
  nonLus: number;
};

/** Au-delà, on ne charge plus : une ligue de 23 n'y arrivera pas de sitôt. */
const MAX_MESSAGES = 500;

export const LONGUEUR_MAX = 2000;

/**
 * Tous mes messages privés, les envoyés comme les reçus, du plus récent au
 * plus ancien.
 */
export async function chargerMesMessages(moi: string): Promise<MessagePrive[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, content, created_at, read_at")
    // Redondant avec les regles de la base, qui filtrent deja. On l'ecrit
    // quand meme : la requete dit alors ce qu'elle veut, au lieu de dependre
    // d'un filtre invisible pour qui relit ce fichier.
    .or(`sender_id.eq.${moi},recipient_id.eq.${moi}`)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (error) throw error;
  return (data ?? []) as MessagePrive[];
}

/**
 * Regroupe une liste de messages par interlocuteur. Le tri met en tête ce qui
 * demande une réponse : d'abord les conversations avec des non-lus, puis les
 * plus récentes.
 */
export function grouperEnConversations(messages: MessagePrive[], moi: string): Conversation[] {
  const par = new Map<string, Conversation>();

  messages.forEach((message) => {
    const autreId = message.sender_id === moi ? message.recipient_id : message.sender_id;
    const existante = par.get(autreId);
    const estUnNonLu = message.recipient_id === moi && message.read_at === null;

    if (!existante) {
      par.set(autreId, { autreId, dernier: message, nonLus: estUnNonLu ? 1 : 0 });
      return;
    }

    if (estUnNonLu) existante.nonLus += 1;
    // `messages` arrive du plus recent au plus ancien : le premier vu est donc
    // le dernier echange. On ne le remplace que si l'ordre nous surprend.
    if (existante.dernier && message.created_at > existante.dernier.created_at) {
      existante.dernier = message;
    }
  });

  return [...par.values()].sort((a, b) => {
    if ((a.nonLus > 0) !== (b.nonLus > 0)) return a.nonLus > 0 ? -1 : 1;
    const da = a.dernier?.created_at ?? "";
    const db = b.dernier?.created_at ?? "";
    return db.localeCompare(da);
  });
}

/** Les messages échangés avec une personne, du plus ancien au plus récent. */
export function filArrangeAvec(messages: MessagePrive[], moi: string, autre: string): MessagePrive[] {
  return messages
    .filter(
      (message) =>
        (message.sender_id === moi && message.recipient_id === autre) ||
        (message.sender_id === autre && message.recipient_id === moi),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function compterNonLus(messages: MessagePrive[], moi: string): number {
  return messages.filter((message) => message.recipient_id === moi && message.read_at === null).length;
}

/**
 * Combien de messages reçus ne sont pas encore lus.
 *
 * Sert la pastille de l'entête du Vestiaire, qui doit s'afficher AVANT qu'on
 * ouvre les messages privés — c'est tout son intérêt. On ne rapatrie donc pas
 * les messages, seulement leur nombre (`head`), ce qui ne coûte presque rien
 * et n'expose aucun contenu à un écran qui n'en affichera pas.
 */
export async function compterNonLusEnBase(moi: string): Promise<number> {
  // On lit les identifiants et on les compte, plutot que de demander a
  // PostgREST un total dans un en-tete HTTP : ce total est arrive vide dans les
  // essais, et un compteur faux qui ne leve aucune erreur est pire qu'absent.
  // Ce que ca coute : quelques identifiants. Aucun contenu ne transite pour un
  // ecran qui n'affichera qu'un nombre.
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id")
    .eq("recipient_id", moi)
    .is("read_at", null)
    .limit(200);

  if (error) throw error;
  return (data ?? []).length;
}

/**
 * Envoie un message. Renvoie la ligne créée, pour que l'appelant l'affiche
 * sans attendre le tour du temps réel.
 */
export async function envoyerMessagePrive(
  moi: string,
  destinataire: string,
  texte: string,
): Promise<MessagePrive> {
  const contenu = texte.trim();
  if (!contenu) throw new Error("Le message est vide.");
  if (contenu.length > LONGUEUR_MAX) {
    throw new Error(`Le message dépasse ${LONGUEUR_MAX} caractères.`);
  }
  if (destinataire === moi) throw new Error("On ne s'écrit pas à soi-même.");

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: moi, recipient_id: destinataire, content: contenu })
    .select("id, sender_id, recipient_id, content, created_at, read_at")
    .single();

  if (error) throw error;
  return data as MessagePrive;
}

/**
 * Marque comme lus les messages reçus d'une personne. Sans effet sur ceux
 * qu'on lui a envoyés : la base n'autorise que le destinataire à le faire.
 */
export async function marquerLu(moi: string, autre: string): Promise<void> {
  const { error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", moi)
    .eq("sender_id", autre)
    .is("read_at", null);

  if (error) throw error;
}

/** Retire un message qu'on a soi-même envoyé. */
export async function supprimerMonMessage(id: string): Promise<void> {
  const { error } = await supabase.from("direct_messages").delete().eq("id", id);
  if (error) throw error;
}

/**
 * S'abonne aux messages qui M'ARRIVENT. On ne s'abonne pas à ses propres
 * envois : ils sont déjà affichés au moment du clic, et un doublon en temps
 * réel les ferait clignoter.
 */
export function abonnerMessagesRecus(moi: string, quandRecu: (message: MessagePrive) => void) {
  const canal = supabase
    .channel(`messages-prives-${moi}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${moi}`,
      },
      (charge) => quandRecu(charge.new as MessagePrive),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
