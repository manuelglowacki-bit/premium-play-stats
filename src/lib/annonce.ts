/**
 * ANNONCE À TOUS LES JOUEURS
 *
 * Le bouton « Rappeler » de l'onglet Suivi n'envoie qu'un texte figé sur les
 * pronostics, et seulement aux retardataires. Il manquait le message libre :
 * « la J2 est ouverte », « pensez aux 10 € », « classement mis à jour ».
 *
 * Aucune Edge Function à redéployer : le mode `manual_reminder` existant
 * accepte déjà un titre et un corps libres pour UN joueur. L'annonce est donc
 * le même appel, répété. C'est plus de requêtes qu'un envoi groupé, mais cela
 * évite de redéployer 500 lignes de fonction — arbitrage assumé, à revoir le
 * jour où le groupe dépassera la centaine de joueurs.
 */

export const LONGUEUR_MAX = 180;
export const TITRE_PAR_DEFAUT = "Prono Ligue 1 LM";

export type AnnoncePreparee =
  { ok: true; titre: string; corps: string } | { ok: false; erreur: string };

/**
 * Une notification Push n'est pas un message : elle s'affiche sur l'écran
 * verrouillé, tronquée, sans mise en forme. D'où les contraintes :
 * pas de message vide, pas de roman, pas de retours à la ligne.
 */
export function preparerAnnonce(texte: unknown, titre?: string): AnnoncePreparee {
  if (typeof texte !== "string") {
    return { ok: false, erreur: "Écris un message avant d'envoyer." };
  }

  // Retours à la ligne et espaces multiples ramenés à une espace : Android et
  // iOS les affichent différemment, autant que tout le monde voie la même
  // chose.
  const corps = texte.replace(/\s+/g, " ").trim();

  if (corps === "") {
    return { ok: false, erreur: "Écris un message avant d'envoyer." };
  }

  if (corps.length > LONGUEUR_MAX) {
    return {
      ok: false,
      erreur: `Message trop long : ${corps.length} caractères pour ${LONGUEUR_MAX} maximum. Une notification tronquée ne se lit pas.`,
    };
  }

  const titreNettoye = (titre ?? "").replace(/\s+/g, " ").trim();

  return {
    ok: true,
    titre: titreNettoye === "" ? TITRE_PAR_DEFAUT : titreNettoye.slice(0, 40),
    corps,
  };
}

/**
 * Résumé d'un envoi, tel qu'il sera lu par l'admin. Le nombre qui compte est
 * celui des joueurs REELLEMENT touchés : annoncer « envoyé à 23 joueurs »
 * quand huit n'ont pas activé les notifications serait un mensonge utile à
 * personne.
 */
export function resumerEnvoi(params: {
  demandes: number;
  reussis: number;
  echoues: number;
}): string {
  const { demandes, reussis, echoues } = params;

  if (reussis === 0) {
    return demandes === 0
      ? "Personne à qui envoyer."
      : "Aucune notification n'est partie. Vérifie que ces joueurs ont activé les notifications.";
  }

  const base = `Annonce envoyée à ${reussis} joueur${reussis > 1 ? "s" : ""}`;
  if (echoues === 0) return `${base}.`;
  return `${base} — ${echoues} n'${echoues > 1 ? "ont" : "a"} rien reçu (notifications désactivées).`;
}
