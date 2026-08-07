import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { getOfficialClubId } from "@/lib/team-identity";
import { getTeamTheme, FALLBACK_BACKGROUND, type TeamTheme } from "@/lib/team-theme";

// Cache module-level id → nom d'équipe, sur le même principe que
// useFavoriteTeam.ts (une seule requête Supabase pour tout le site, partagée
// par toutes les pages qui utilisent useTeamTheme).
let teamNamesById: Record<string, string> | null = null;
let namesFetch: Promise<void> | null = null;
const nameListeners = new Set<() => void>();

async function fetchTeamNames() {
  const { data } = await supabase.from("teams").select("id, name");
  const map: Record<string, string> = {};
  (data ?? []).forEach((t: { id: string; name: string }) => {
    map[t.id] = t.name;
  });
  teamNamesById = map;
  nameListeners.forEach((listener) => listener());
}

async function ensureTeamNamesLoaded() {
  if (teamNamesById) return;
  if (!namesFetch) {
    namesFetch = fetchTeamNames();
  }
  await namesFetch;
}

export type UseTeamThemeResult = {
  /** Id "officiel" du club résolu (voir src/lib/team-identity.ts), ou `null` tant qu'aucun club n'est déterminé. */
  clubId: string | null;
  /** Couleurs, halo, dégradé et style de bouton du club — voir src/lib/team-theme.ts. */
  theme: TeamTheme;
  /** URL de fond à utiliser réellement (repli automatique sur FALLBACK_BACKGROUND si l'image dédiée est en 404). */
  backgroundUrl: string;
  backgroundFailed: boolean;
  /** À brancher sur l'`onError` d'une <img> cachée qui précharge `theme.background`, pour déclencher le repli. */
  onBackgroundError: () => void;
};

/**
 * Résout et applique automatiquement le thème visuel du club favori de
 * l'utilisateur (background, couleurs, glow, gradient, bouton — voir
 * src/lib/team-theme.ts), avec le même mécanisme de repli que sur la page
 * d'accueil : une image de fond manquante (404) fait retomber sur
 * FALLBACK_BACKGROUND (/stadium-bg.jpg).
 *
 * Par défaut, le club est déduit de `favorite_team_id` via useFavoriteTeam
 * (donc toujours à jour, y compris après un changement fait sur une autre
 * page ou après un rechargement — voir useFavoriteTeam.ts).
 *
 * `teamNameOverride` permet à une page qui a déjà sa propre notion du club
 * "actif" (ex. la page d'accueil, où l'utilisateur peut prévisualiser un
 * autre club dans le sélecteur avant de valider) de piloter le thème avec ce
 * nom plutôt qu'avec le club favori enregistré. Passer `undefined` (valeur
 * par défaut) pour se baser sur le club favori.
 */
export function useTeamTheme(teamNameOverride?: string | null): UseTeamThemeResult {
  const { favoriteTeamId } = useFavoriteTeam();
  const [, forceUpdate] = useState(0);
  const [backgroundFailed, setBackgroundFailed] = useState(false);

  useEffect(() => {
    // Pas besoin du cache de noms si l'appelant fournit déjà son propre nom.
    if (teamNameOverride !== undefined) return;
    const listener = () => forceUpdate((n) => n + 1);
    nameListeners.add(listener);
    ensureTeamNamesLoaded();
    return () => {
      nameListeners.delete(listener);
    };
  }, [teamNameOverride]);

  const resolvedName =
    teamNameOverride !== undefined
      ? teamNameOverride
      : favoriteTeamId
        ? teamNamesById?.[favoriteTeamId] ?? null
        : null;

  const clubId = getOfficialClubId(resolvedName);
  const theme = getTeamTheme(clubId);

  // Réinitialise la détection d'échec de chargement dès que le club change,
  // sinon on resterait bloqué sur le fond générique après un changement de club.
  useEffect(() => {
    setBackgroundFailed(false);
  }, [clubId]);

  return {
    clubId,
    theme,
    backgroundUrl: backgroundFailed ? FALLBACK_BACKGROUND : theme.background,
    backgroundFailed,
    onBackgroundError: () => setBackgroundFailed(true),
  };
}
