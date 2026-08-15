import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Résout l'id de la saison active — PAS via `seasons.is_active` (vérifié
 * en base au Lot 4 : cette colonne est à `false` pour l'unique saison
 * existante, donc non maintenue/non fiable), mais via le mécanisme
 * RÉELLEMENT utilisé partout ailleurs dans l'app (classement.tsx,
 * index.tsx, profil.tsx) : `app_settings.season` (texte, ex. "2026-2027"),
 * mis en correspondance avec `seasons.code`/`seasons.name`.
 */
async function resolveActiveSeasonId(): Promise<string | null> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("season")
    .eq("id", 1)
    .maybeSingle();

  const seasonLabel = settings?.season;
  if (!seasonLabel) return null;

  const { data: byCode } = await supabase
    .from("seasons")
    .select("id")
    .eq("code", seasonLabel)
    .maybeSingle();
  if (byCode?.id) return byCode.id;

  const { data: byName } = await supabase
    .from("seasons")
    .select("id")
    .eq("name", seasonLabel)
    .maybeSingle();
  return byName?.id ?? null;
}

/**
 * Enregistre/à jour la ligne user_season_favorite_teams de la saison
 * ACTIVE pour ce joueur (upsert sur la contrainte unique (user_id,
 * season_id)) — jamais une saison passée, qui doit rester figée. Si la
 * saison active ne peut pas être résolue, ne rien écrire plutôt
 * qu'inventer une valeur (voir résolveActiveSeasonId).
 */
async function recordFavoriteTeamForActiveSeason(
  userId: string,
  teamId: string
): Promise<void> {
  const seasonId = await resolveActiveSeasonId();
  if (!seasonId) {
    console.warn(
      "Saison active introuvable — équipe favorite non historisée pour cette sélection."
    );
    return;
  }

  const { error } = await supabase
    .from("user_season_favorite_teams")
    .upsert(
      {
        user_id: userId,
        season_id: seasonId,
        favorite_team_id: teamId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, season_id" }
    );

  if (error) throw error;
}

export function useFavoriteTeam() {
  const [favoriteTeamId, setFavoriteTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadFavoriteTeam = async (userId: string | null) => {
      if (!mounted) return;

      setLoading(true);

      // Aucun utilisateur connecté = aucune équipe
      if (!userId) {
        setFavoriteTeamId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("favorite_team_id")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error(
          "Erreur lors du chargement de l'équipe de cœur :",
          error
        );
        setFavoriteTeamId(null);
      } else {
        setFavoriteTeamId(data?.favorite_team_id ?? null);
      }

      setLoading(false);
    };

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await loadFavoriteTeam(user?.id ?? null);
    };

    initialize();

    // 🔥 Très important :
    // recharge l'équipe dès qu'on change de compte.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        loadFavoriteTeam(session?.user?.id ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const saveFavoriteTeam = async (teamId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Aucun utilisateur connecté.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_team_id: teamId,
      })
      .eq("id", user.id);

    if (error) {
      console.error(
        "Erreur lors de l'enregistrement de l'équipe de cœur :",
        error
      );
      throw error;
    }

    // Mise à jour immédiate de la page pour le compte actuel
    setFavoriteTeamId(teamId);

    // Historisation par saison (Lot 4) — SECONDAIRE, ne doit JAMAIS
    // bloquer/annuler la sauvegarde principale ci-dessus (même principe
    // que le reste du projet : predictions.upsert reste la source de
    // vérité, ceci n'est qu'un enregistrement complémentaire). Permet de
    // ne plus jamais recalculer une saison passée avec le favori d'une
    // saison plus récente (voir user_season_favorite_teams, migration
    // 20260820090000).
    try {
      await recordFavoriteTeamForActiveSeason(user.id, teamId);
    } catch (historyError) {
      console.warn(
        "Historisation de l'équipe favorite ignorée :",
        historyError
      );
    }
  };

  return {
    favoriteTeamId,
    saveFavoriteTeam,
    loading,
  };
}