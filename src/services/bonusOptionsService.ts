import { supabase } from "@/lib/supabase";
import type { BonusCandidate, BonusCompetitionCode } from "./bonusSelectionService";

export type BonusOption = {
  id: string;
  matchday_id: string;
  competition_code: BonusCompetitionCode;
  match_id: string;
  selection_score: number;
  /** ÉQUILIBRE — écart de position au classement actuel (voir
   * bonusSelectionService.ts, critère dominant depuis le barème dynamique).
   * Colonne ajoutée par la migration 20260815120000 — peut être absente
   * tant qu'elle n'est pas appliquée, d'où le `?? 0` à la lecture. */
  standings_balance_score?: number;
  prestige_score: number;
  /** ÉCART AU CLASSEMENT — écart de points / différence de buts (renommé en
   * interne "levelGap" ; conserve la colonne historique `balance_score`). */
  balance_score: number;
  /** FORME — forme récente des deux équipes. Colonne ajoutée par la
   * migration 20260815120000, même remarque que standings_balance_score. */
  form_score?: number;
  rivalry_score: number;
  schedule_score: number;
  reasons: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getBonusOptions(
  matchdayId: string,
): Promise<BonusOption[]> {
  const { data, error } = await supabase
    .from("bonus_options")
    .select("*")
    .eq("matchday_id", matchdayId)
    .eq("is_active", true)
    .order("competition_code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BonusOption[];
}

/** Construit la ligne à insérer pour une sélection. `balance_score` porte
 * l'écart de classement (levelGap) — nom de colonne historique conservé
 * pour ne pas casser les lignes déjà en base. */
function toBonusOptionRow(matchdayId: string, selection: BonusCandidate) {
  return {
    matchday_id: matchdayId,
    competition_code: selection.competitionCode,
    match_id: selection.match.id,
    selection_score: selection.score.total,
    standings_balance_score: selection.score.standingsBalance,
    prestige_score: selection.score.prestige,
    balance_score: selection.score.levelGap,
    form_score: selection.score.form,
    rivalry_score: selection.score.rivalry,
    schedule_score: selection.score.schedule,
    reasons: selection.reasons,
    is_active: true,
  };
}

/** true si l'erreur Supabase vient d'une colonne encore absente (migration
 * 20260815120000 pas encore appliquée) — permet de retomber sur les 4
 * anciennes colonnes plutôt que de casser toute la génération bonus tant
 * que la migration n'a pas été jouée manuellement (voir bonusOptionsService
 * README / message de fin de tâche). */
function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? "";
  return message.includes("does not exist") && (message.includes("standings_balance_score") || message.includes("form_score"));
}

/** Retire les 2 colonnes ajoutées par la migration 20260815120000 d'une
 * ligne — repli utilisé uniquement si l'insert avec ces colonnes échoue
 * parce que la migration n'a pas encore été appliquée en base. */
function withoutNewScoreColumns<T extends { standings_balance_score?: number; form_score?: number }>(
  row: T,
): Omit<T, "standings_balance_score" | "form_score"> {
  const { standings_balance_score, form_score, ...rest } = row;
  return rest;
}

/**
 * Sauvegarde les 4 sélections.
 * Avant l'insert, on désactive les anciennes sélections de la journée.
 * La contrainte SQL garantit qu'il n'y a jamais deux sélections actives
 * pour le même championnat et la même journée.
 */
export async function saveBonusSelections(
  matchdayId: string,
  selections: Array<BonusCandidate | null>,
): Promise<void> {
  const valid = selections.filter(
    (selection): selection is BonusCandidate =>
      Boolean(selection?.match?.id && selection.competitionCode),
  );

  const { error: deactivateError } = await supabase
    .from("bonus_options")
    .update({ is_active: false })
    .eq("matchday_id", matchdayId)
    .eq("is_active", true);

  if (deactivateError) throw deactivateError;

  if (!valid.length) return;

  const rows = valid.map((selection) => toBonusOptionRow(matchdayId, selection));

  const { error } = await supabase.from("bonus_options").insert(rows);
  if (error) {
    if (!isMissingColumnError(error)) throw error;
    console.warn(
      "bonus_options.standings_balance_score/form_score absentes (migration 20260815120000 non appliquée) — sauvegarde sans ces 2 colonnes.",
      error,
    );
    const { error: fallbackError } = await supabase.from("bonus_options").insert(rows.map(withoutNewScoreColumns));
    if (fallbackError) throw fallbackError;
  }
}

/**
 * Remplace uniquement le choix d'un championnat.
 */
export async function replaceBonusSelection(
  matchdayId: string,
  selection: BonusCandidate,
): Promise<void> {
  const { error: deactivateError } = await supabase
    .from("bonus_options")
    .update({ is_active: false })
    .eq("matchday_id", matchdayId)
    .eq("competition_code", selection.competitionCode)
    .eq("is_active", true);

  if (deactivateError) throw deactivateError;

  const row = toBonusOptionRow(matchdayId, selection);
  const { error } = await supabase.from("bonus_options").insert(row);
  if (error) {
    if (!isMissingColumnError(error)) throw error;
    console.warn(
      "bonus_options.standings_balance_score/form_score absentes (migration 20260815120000 non appliquée) — sauvegarde sans ces 2 colonnes.",
      error,
    );
    const { error: fallbackError } = await supabase.from("bonus_options").insert(withoutNewScoreColumns(row));
    if (fallbackError) throw fallbackError;
  }
}

/**
 * Retire complètement le tirage bonus de la journée.
 */
export async function clearBonusSelections(
  matchdayId: string,
): Promise<void> {
  const { error } = await supabase
    .from("bonus_options")
    .update({ is_active: false })
    .eq("matchday_id", matchdayId)
    .eq("is_active", true);

  if (error) throw error;
}
