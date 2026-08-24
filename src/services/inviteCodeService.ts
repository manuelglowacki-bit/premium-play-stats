import { supabase } from "@/lib/supabase";

// Code d'invitation exigé à l'inscription (table app_invite, une seule
// ligne). Lisible et modifiable par l'admin uniquement : la politique RLS
// de la table refuse tout le monde d'autre, y compris les joueurs connectés.
// La vérification à l'inscription, elle, se fait côté serveur dans
// api/verifier-invitation.ts — le code ne transite jamais vers le navigateur
// d'un visiteur non-admin.

// Alphabet sans les caractères qui se confondent à l'oral ou à l'écrit
// (0/O, 1/I/L, 5/S, 8/B) : le code est destiné à être dicté ou recopié
// depuis un message.
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";
const LONGUEUR = 8;

export function genererCodeInvitation(): string {
  const valeurs = new Uint32Array(LONGUEUR);
  crypto.getRandomValues(valeurs);
  let code = "";
  for (let i = 0; i < LONGUEUR; i += 1) {
    code += ALPHABET[valeurs[i] % ALPHABET.length];
  }
  return code;
}

export type InvitationCourante = {
  code: string;
  updatedAt: string | null;
};

export async function lireCodeInvitation(): Promise<InvitationCourante | null> {
  const { data, error } = await supabase
    .from("app_invite")
    .select("code, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.code) return null;

  return { code: String(data.code), updatedAt: data.updated_at ?? null };
}

export async function enregistrerCodeInvitation(code: string): Promise<void> {
  const propre = code.trim();
  if (propre.length < 4) {
    throw new Error("Le code doit contenir au moins 4 caractères.");
  }

  const { error } = await supabase
    .from("app_invite")
    .upsert({ id: 1, code: propre, updated_at: new Date().toISOString() });

  if (error) throw error;
}
