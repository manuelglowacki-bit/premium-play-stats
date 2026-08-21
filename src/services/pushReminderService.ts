import { supabase } from "@/lib/supabase";

/**
 * Phase 2 — Rappel Push manuel déclenché par l'Admin (onglet Suivi pronos,
 * voir admin.tsx / PronoFollowUpTab). Réutilise l'Edge Function existante
 * `send-prono-reminders` (mode "manual_reminder", ajouté à côté de son mode
 * cron automatique — voir supabase/functions/send-prono-reminders/index.ts)
 * plutôt que de créer un second système de notifications.
 *
 * `supabase.functions.invoke` attache automatiquement le JWT du joueur
 * actuellement connecté (l'admin) dans l'en-tête Authorization : c'est ce
 * qui permet à l'Edge Function de vérifier côté serveur qu'il s'agit bien
 * d'un administrateur avant d'envoyer quoi que ce soit. Aucune clé secrète
 * (VAPID privée, service_role) ne transite par le navigateur.
 */
export type ManualReminderResult = {
  ok: boolean;
  sent: number;
  failed: number;
  subscriptionsFound: number;
  error?: string;
};

export async function sendManualReminder(params: {
  userId: string;
  matchdayId?: string | null;
  title?: string;
  body: string;
}): Promise<ManualReminderResult> {
  const { data, error } = await supabase.functions.invoke("send-prono-reminders", {
    body: {
      type: "manual_reminder",
      user_id: params.userId,
      matchday_id: params.matchdayId ?? null,
      title: params.title,
      body: params.body,
    },
  });

  if (error) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      subscriptionsFound: 0,
      error: error.message || "Erreur lors de l'appel à la fonction de rappel.",
    };
  }

  const result = (data ?? {}) as Partial<ManualReminderResult> & { error?: string };

  if (result.ok === false) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      subscriptionsFound: 0,
      error: result.error || "Impossible d'envoyer le rappel.",
    };
  }

  return {
    ok: true,
    sent: result.sent ?? 0,
    failed: result.failed ?? 0,
    subscriptionsFound: result.subscriptionsFound ?? 0,
  };
}
