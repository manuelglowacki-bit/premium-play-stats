import { supabase } from "./supabase";

// ==========================================
// 1. PRONOSTICS
// ==========================================
// La table `predictions` n'a pas de colonne "matchday" : la journée d'un
// match se déduit de son match_id via le calendrier admin (localStorage
// "admin_journees"), comme dans src/routes/stats.tsx et gazette.tsx.
// NB : `pick`/`home_score`/`away_score` n'existent pas non plus — seuls
// `home_prediction`/`away_prediction` stockent le pronostic (confirmé via
// `supabase gen types typescript`). Fonction non utilisée actuellement
// ailleurs dans l'app (voir src/routes/pronostics.tsx pour le flux réel de
// sauvegarde), mais corrigée pour rester valide si jamais réutilisée.
export async function fetchPredictions() {
  const { data, error } = await supabase
    .from("predictions")
    .select("match_id, home_prediction, away_prediction");

  if (error) {
    console.error("Erreur fetchPredictions:", error);
    return [];
  }
  return data;
}

export async function savePredictions(
  predictions: Array<{ match_id: string; user_id: string; home_prediction: number; away_prediction: number }>,
) {
  const { error } = await supabase
    .from("predictions")
    .upsert(predictions, { onConflict: "user_id, match_id" });

  if (error) throw error;
}

// ==========================================
// 2. CLASSEMENT & UTILISATEURS
// ==========================================
// `profiles` n'a pas de colonne `username`/`favorite_club` — seulement
// `pseudo`/`favorite_team` (confirmé via `supabase gen types typescript`).
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, pseudo, favorite_team");

  if (error) {
    console.error("Erreur fetchLeaderboard:", error);
    return [];
  }
  return data;
}

// ==========================================
// 3. HISTORIQUE DES POINTS (Journey Points)
// ==========================================
export async function fetchJourneyPoints(userId: string) {
  const { data, error } = await supabase
    .from("user_journey_points")
    .select("journey, points")
    .eq("user_id", userId);

  if (error) {
    console.error("Erreur fetchJourneyPoints:", error);
    return [];
  }
  return data;
}

// ==========================================
// 4. TROPHÉES
// ==========================================
export async function fetchUserTrophies(userId: string) {
  // `updated_at` ajouté à la sélection (page Trophées) pour pouvoir afficher
  // une date d'obtention réelle sur un trophée débloqué, sans jamais en
  // inventer une — colonne déjà présente sur `user_trophies`, aucun nouveau
  // champ créé côté Supabase.
  const { data, error } = await supabase
    .from("user_trophies")
    .select("trophy_id, progress, unlocked, updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("Erreur fetchUserTrophies:", error);
    return [];
  }
  return data;
}
