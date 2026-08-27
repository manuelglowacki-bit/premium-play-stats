import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ongletVisible } from "@/lib/ongletVisible";
import { doitCompter, normaliserChemin } from "@/lib/suiviPages";

/**
 * Enregistre une visite au changement de page.
 *
 * Silencieux par construction : une statistique ne doit jamais faire échouer
 * quoi que ce soit pour le joueur. Erreur réseau, table absente, joueur
 * déconnecté — on n'affiche rien et on continue.
 *
 * Les règles de comptage (normalisation, anti-doublon) sont dans
 * src/lib/suiviPages.ts, vérifiées par npm run verif-audience.
 */
export function useSuiviPages(chemin: string, connecte: boolean) {
  // En mémoire seulement : la fenêtre anti-doublon n'a pas besoin de survivre
  // à un rechargement, et on évite d'écrire dans le stockage du navigateur
  // pour une statistique.
  const vues = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!connecte) return;
    // Onglet caché : rien. Même règle que les rafraîchissements — une
    // application laissée ouverte en arrière-plan ne produit pas de trafic.
    if (!ongletVisible()) return;

    const page = normaliserChemin(chemin);
    if (!page) return;

    const maintenant = Date.now();
    if (!doitCompter(page, maintenant, vues.current)) return;
    vues.current[page] = maintenant;

    void supabase.rpc("enregistrer_vue_page", { p_page: page }).then(
      () => undefined,
      () => undefined,
    );
  }, [chemin, connecte]);
}
