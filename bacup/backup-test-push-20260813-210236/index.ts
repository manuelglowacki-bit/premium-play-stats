import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-push-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("TEST_PUSH_SECRET") ?? "";
    const receivedSecret = req.headers.get("x-test-push-secret") ?? "";

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const publicKey =
      Deno.env.get("VAPID_PUBLIC_KEY") ??
      Deno.env.get("VAPID_PUBLIC") ??
      Deno.env.get("VITE_VAPID_PUBLIC_KEY") ??
      "";

    const privateKey =
      Deno.env.get("VAPID_PRIVATE_KEY") ??
      Deno.env.get("VAPID_PRIVATE") ??
      "";

    const subject =
      Deno.env.get("VAPID_SUBJECT") ??
      "mailto:admin@example.com";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Secrets Supabase manquants dans Edge Function.");
    }

    if (!publicKey || !privateKey) {
      throw new Error("Secrets VAPID manquants dans Edge Function.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth");

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        sent: 0,
        message: "Aucun abonnement Push.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title: "âš½ Prono Ligue 1 LM",
      body: "ðŸ”” Test rÃ©ussi ! Les notifications Push de ton tÃ©lÃ©phone fonctionnent.",
      url: "/",
      tag: "prono-push-test",
    });

    let sent = 0;
    const errorDetails: Array<{
      id: string;
      statusCode: number;
      message: string;
    }> = [];
    let failed = 0;
    const invalidIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const statusCode = Number((err as any)?.statusCode ?? 0);
        const message = err instanceof Error ? err.message : String(err);

        errorDetails.push({
          id: String(sub.id),
          statusCode,
          message: message.slice(0, 500),
        });

        if (statusCode === 404 || statusCode === 410) {
          invalidIds.push(sub.id);
        }

        console.error("Push error:", sub.id, statusCode, message);
      }
    }

    if (invalidIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", invalidIds);
    }

    return new Response(JSON.stringify({
      ok: true,
      sent,
      failed,
      removed_invalid: invalidIds.length,
      errors: errorDetails,
      message: sent > 0
        ? "Notification Push envoyÃ©e."
        : "Aucune notification envoyÃ©e.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);

    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});