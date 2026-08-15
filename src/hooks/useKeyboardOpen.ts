import { useEffect, useState } from "react";

// Écart (px) entre la hauteur "layout" (window.innerHeight, fixe) et la
// hauteur "visuelle" réelle (window.visualViewport.height, qui rétrécit
// quand le clavier virtuel apparaît) à partir duquel on considère qu'un
// clavier est ouvert. Volontairement généreux : le changement de hauteur
// d'une barre d'adresse mobile (Chrome/Safari) reste largement en dessous
// (quelques dizaines de px), un clavier virtuel en fait au moins 150-200.
const KEYBOARD_HEIGHT_THRESHOLD = 150;

/**
 * Détecte qu'un clavier virtuel est probablement ouvert, via l'API
 * VisualViewport — seule source fiable sur Android Chrome pour ça
 * (contrairement à 100vh/100dvh, qui ne réagissent pas de façon fiable à
 * l'ouverture du clavier, seulement aux barres de navigateur).
 *
 * Partagé entre AppShell (masque la nav flottante pendant la saisie) et le
 * Vestiaire (recalcule sa hauteur) : les deux dérivent le même état depuis
 * la même source, sans se coupler l'un à l'autre.
 */
export function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      const gap = window.innerHeight - (vv?.height ?? window.innerHeight);
      setKeyboardOpen(gap > KEYBOARD_HEIGHT_THRESHOLD);
    }

    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  return keyboardOpen;
}
