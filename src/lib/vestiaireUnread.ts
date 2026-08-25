import { supabase } from "./supabase";

/**
 * Compteur de messages non lus du Vestiaire.
 *
 * Le repère de dernière lecture vit dans le localStorage du navigateur : il
 * survit donc à un rechargement et à la fermeture de l'onglet, contrairement
 * à un simple état React. C'est ce qui permet d'avertir un joueur qui ouvre
 * l'application APRÈS que les messages ont été écrits.
 *
 * Limite assumée : le repère est propre à un appareil. Un joueur qui lit sur
 * son téléphone verra encore le badge sur son ordinateur. Le rendre commun
 * demanderait une colonne côté Supabase (ex. profiles.vestiaire_last_read_at).
 */

export const VESTIAIRE_UNREAD_KEY = "prono-ligue1-vestiaire-last-read";

export async function getVestiaireUnreadCount(userId: string | null): Promise<number> {
  if (!userId || typeof window === "undefined") return 0;

  const lastRead = window.localStorage.getItem(VESTIAIRE_UNREAD_KEY);

  // Aucun repère : le joueur n'a jamais ouvert le Vestiaire sur cet appareil.
  //
  // On ne lui annonce pas tout l'historique comme "non lu" — ce serait un
  // badge à 200 dès la première ouverture, que personne ne lirait. Mais on ne
  // peut pas non plus se contenter de renvoyer 0 sans rien faire : le repère
  // resterait absent indéfiniment, et ce joueur ne verrait JAMAIS de pastille,
  // même pour des messages écrits après son arrivée. Or c'est précisément lui
  // qu'il faut attirer dans le salon.
  //
  // On pose donc le repère à maintenant : rien n'est signalé cette fois, et
  // tout ce qui arrive ensuite est compté normalement.
  if (!lastRead) {
    window.localStorage.setItem(VESTIAIRE_UNREAD_KEY, new Date().toISOString());
    return 0;
  }

  const { count, error } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .gt("created_at", lastRead)
    .neq("user_id", userId);

  if (error) {
    console.error("Vestiaire — compteur non lus :", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Marque le Vestiaire comme lu. L'événement `storage` synthétique permet aux
 * composants de la même page (la barre de navigation, notamment) de remettre
 * leur badge à zéro sans attendre un rechargement — un vrai événement
 * `storage` n'est émis que vers les AUTRES onglets.
 */
export function markVestiaireRead() {
  if (typeof window === "undefined") return;

  const now = new Date().toISOString();
  window.localStorage.setItem(VESTIAIRE_UNREAD_KEY, now);
  window.dispatchEvent(
    new StorageEvent("storage", { key: VESTIAIRE_UNREAD_KEY, newValue: now }),
  );
}
