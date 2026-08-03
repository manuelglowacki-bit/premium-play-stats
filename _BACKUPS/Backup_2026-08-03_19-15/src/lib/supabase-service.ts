import { supabase } from "./supabase";

// ==========================================
// 1. PRONOSTICS
// ==========================================
export async function fetchPredictions(matchday: string) {
  const { data, error } = await supabase
    .from("predictions")
    .select("match_id, pick, home_score, away_score")
    .eq("matchday", matchday);

  if (error) {
    console.error("Erreur fetchPredictions:", error);
    return [];
  }
  return data;
}

export async function savePredictions(predictions: Array<{ match_id: string; matchday: string; pick: string }>) {
  const { error } = await supabase
    .from("predictions")
    .upsert(predictions, { onConflict: "user_id, match_id, matchday" });

  if (error) throw error;
}

// ==========================================
// 2. CLASSEMENT & UTILISATEURS
// ==========================================
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, favorite_club");

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
  const { data, error } = await supabase
    .from("user_trophies")
    .select("trophy_id, progress, unlocked")
    .eq("user_id", userId);

  if (error) {
    console.error("Erreur fetchUserTrophies:", error);
    return [];
  }
  return data;
}
