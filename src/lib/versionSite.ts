/**
 * DETECTION D'UNE NOUVELLE VERSION DU SITE
 *
 * Le probleme, cote joueur : un deploiement est pris en compte au prochain
 * CHARGEMENT de la page. Sur Android, rouvrir l'application recharge, donc la
 * nouvelle version arrive tout de suite. Sur iPhone, iOS gele l'application et
 * la restaure dans l'etat exact ou elle a ete quittee — sans rien redemander
 * au serveur. Un joueur qui n'a pas ferme l'application depuis trois jours
 * tourne encore sur le code de mardi, et il faut lui expliquer le balayage
 * vers le haut dans le selecteur d'applications.
 *
 * Le mecanisme : le build ecrit le meme identifiant a deux endroits — dans le
 * bundle (`__BUILD_ID__`) et dans /version.json. Au retour au premier plan, on
 * relit le fichier et on compare. Different = un deploiement est passe depuis
 * l'ouverture de l'onglet.
 *
 * Ce qu'on ne fait PAS : recharger tout seul. Un rechargement spontane pendant
 * qu'un joueur remplit ses pronostics lui ferait perdre sa saisie. On propose,
 * il decide.
 */

/** La version embarquee dans le code en train de tourner. */
export const VERSION_EMBARQUEE: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/** Au plus une verification par tranche de cinq minutes. */
export const INTERVALLE_MINIMUM = 5 * 60_000;

/** Fichier publie a cote du bundle par vite.config.ts. */
export const URL_VERSION = "/version.json";

/**
 * Faut-il relancer une verification ?
 *
 * Revenir sur l'application dix fois dans la minute ne doit pas declencher dix
 * requetes. `derniere = 0` signifie « jamais verifie » et passe toujours.
 */
export function doitVerifier(
  maintenant: number,
  derniere: number,
  intervalle: number = INTERVALLE_MINIMUM,
): boolean {
  if (derniere <= 0) return true;
  return maintenant - derniere >= intervalle;
}

/**
 * Une nouvelle version est-elle publiee ?
 *
 * Prudent par construction : au moindre doute on repond NON. Un faux positif
 * afficherait un bandeau « Recharger » qui ne sert a rien et qui reviendrait
 * en boucle — c'est bien pire qu'un bandeau manquant, la version suivante
 * etant de toute facon prise au prochain vrai chargement.
 *
 * En developpement la version embarquee vaut "dev" : jamais de bandeau.
 */
export function nouvelleVersion(embarquee: string, publiee: unknown): boolean {
  if (typeof publiee !== "string") return false;

  const a = embarquee.trim();
  const b = publiee.trim();

  if (a === "" || b === "") return false;
  if (a === "dev" || b === "dev") return false;

  return a !== b;
}

/**
 * Lit la version publiee. Ne leve jamais : hors ligne, 404, JSON casse ou
 * page de maintenance renvoyant du HTML donnent tous `null`, c'est-a-dire
 * « on ne sait pas », c'est-a-dire pas de bandeau.
 */
export async function lireVersionPubliee(
  charger: typeof fetch = fetch,
  url: string = URL_VERSION,
  maintenant: number = Date.now(),
): Promise<string | null> {
  try {
    // Le parametre casse tout cache intermediaire : sans lui, un CDN pourrait
    // resservir l'ancien fichier et le bandeau ne s'afficherait jamais.
    const reponse = await charger(`${url}?t=${maintenant}`, { cache: "no-store" });
    if (!reponse.ok) return null;

    const donnees = await reponse.json();
    const version = (donnees as { version?: unknown })?.version;

    return typeof version === "string" && version.trim() !== "" ? version.trim() : null;
  } catch {
    return null;
  }
}
