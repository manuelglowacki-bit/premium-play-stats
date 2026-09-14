import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * ANCIENNE ADRESSE DE LA GAZETTE.
 *
 * La page s'appelle desormais « Le Debrief » et vit sur /debrief. Cette
 * route ne sert plus qu'a rattraper ceux qui arrivent par l'ancien chemin :
 * un joueur qui avait mis /gazette en favori, un lien partage dans le
 * Vestiaire avant le changement de nom, l'application installee sur un
 * telephone dont la page d'accueil pointait encore ici.
 *
 * `beforeLoad` redirige AVANT tout rendu : aucune page vide ne clignote, et
 * l'ancien chemin ne reste pas dans l'historique du navigateur — appuyer sur
 * « retour » ne renvoie donc pas dans une boucle de redirection.
 */
export const Route = createFileRoute("/gazette")({
  beforeLoad: () => {
    throw redirect({ to: "/debrief", replace: true });
  },
});
