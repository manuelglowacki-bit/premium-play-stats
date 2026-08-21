import { supabase } from "@/lib/supabase";

export type MatchdayDeadlineMode = "manual" | "auto_minus_1";

export async function setMatchdayDeadline(
  matchdayId: string,
  deadline: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({ deadline, deadline_mode: "manual" satisfies MatchdayDeadlineMode })
    .eq("id", matchdayId);

  if (error) throw error;
}

export async function setMatchdayAutoMinusOne(
  matchdayId: string,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({
      deadline: null,
      deadline_mode: "auto_minus_1" satisfies MatchdayDeadlineMode,
    })
    .eq("id", matchdayId);

  if (error) throw error;
}

export async function clearMatchdayDeadline(
  matchdayId: string,
): Promise<void> {
  const { error } = await supabase
    .from("matchdays")
    .update({
      deadline: null,
      deadline_mode: "manual" satisfies MatchdayDeadlineMode,
    })
    .eq("id", matchdayId);

  if (error) throw error;
}
