/**
 * L'ONGLET EST-IL SOUS LES YEUX DU JOUEUR ?
 * =========================================
 * Six pages du site se rechargent toutes les 15 secondes, pour suivre les
 * scores en direct. C'est justifié quand quelqu'un regarde. Ça ne l'est pas
 * quand l'onglet est caché, l'application en arrière-plan, ou le téléphone
 * posé sur la table de nuit — et le navigateur, lui, continue.
 *
 * Mesure sur la vraie base : 190 Mo consommés en une nuit, sans un seul
 * joueur connecté. 240 rechargements par heure et par onglet ouvert.
 *
 * Cette fonction est volontairement minuscule et partagee : la regle doit
 * etre la meme partout, et se lire d'un coup d'oeil sur chaque page qui
 * l'applique.
 */
export function ongletVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}
