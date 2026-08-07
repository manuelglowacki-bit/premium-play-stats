import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// 🌟 VARIABLES GLOBALES (en dehors du hook) partagées par tout ton site
let globalTeamId: string | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

// Fonction pour rafraîchir toutes les pages qui utilisent ce hook
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function useFavoriteTeam() {
  // On initialise directement avec la variable globale
  const [favoriteTeamId, setFavoriteTeamId] = useState<string | null>(globalTeamId);
  const [loading, setLoading] = useState(!isLoaded);

  useEffect(() => {
    // 1. On définit comment cette page spécifique doit se mettre à jour
    const updateComponent = () => {
      setFavoriteTeamId(globalTeamId);
      setLoading(false);
    };

    // 2. On ajoute cette page à la liste de celles qui écoutent les changements
    listeners.add(updateComponent);

    // 3. Si l'équipe n'a jamais été chargée, on interroge Supabase (une seule fois pour tout le site !)
    if (!isLoaded) {
      loadFavoriteTeam();
    }

    // 4. Nettoyage important : on arrête d'écouter si on quitte la page
    return () => {
      listeners.delete(updateComponent);
    };
  }, []);

  async function loadFavoriteTeam() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      isLoaded = true;
      notifyListeners();
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("favorite_team_id")
      .eq("id", user.id)
      .single();

    if (data) {
      globalTeamId = data.favorite_team_id;
    }

    isLoaded = true;
    notifyListeners(); // Prévient l'interface que le chargement est fini
  }

  async function saveFavoriteTeam(teamId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_team_id: teamId,
      })
      .eq("id", user.id);

    if (!error) {
      // 🌟 LA MAGIE EST ICI : On change l'équipe dans la mémoire globale
      globalTeamId = teamId;
      // Et on force TOUTES les pages (Accueil, Profil, etc.) à afficher la nouvelle équipe immédiatement
      notifyListeners();
    }
  }

  return {
    favoriteTeamId,
    saveFavoriteTeam,
    loading,
  };
}