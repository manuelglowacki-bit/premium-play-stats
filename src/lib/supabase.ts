import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://azgksiwcgvbertzzzhvq.supabase.co";

const supabaseAnonKey =
  "sb_publishable_NwALJ8h6gzAlC-GgiqnFow_Ol45BzTj";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }
);