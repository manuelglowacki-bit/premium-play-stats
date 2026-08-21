$ErrorActionPreference = "Stop"

$root = Get-Location
$projectRef = "azgksiwcgvbertzzzhvq"
$functionName = "test-push-phone"
$functionDir = Join-Path $root "supabase\functions\$functionName"
$indexPath = Join-Path $functionDir "index.ts"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " TEST NOTIFICATION PUSH - TELEPHONE" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Secret de test compatible Windows PowerShell 5.1.
$testSecret = ([guid]::NewGuid().ToString("N")) + ([guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $functionDir | Out-Null

$backupDir = Join-Path $root ("backup-test-push-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Sauvegarde locale si une ancienne fonction de test existe.
if (Test-Path -LiteralPath $indexPath) {
    Copy-Item -LiteralPath $indexPath -Destination (Join-Path $backupDir "index.ts") -Force
}

$edgeCode = @'
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
      title: "⚽ Prono Ligue 1 LM",
      body: "🔔 Test réussi ! Les notifications Push de ton téléphone fonctionnent.",
      url: "/",
      tag: "prono-push-test",
    });

    let sent = 0;
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
        if (statusCode === 404 || statusCode === 410) {
          invalidIds.push(sub.id);
        }
        console.error("Push error:", sub.id, statusCode, err);
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
      message: sent > 0
        ? "Notification Push envoyée."
        : "Aucune notification envoyée.",
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
'@

[System.IO.File]::WriteAllText(
    $indexPath,
    $edgeCode,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "OK : fonction de test créée." -ForegroundColor Green

Write-Host "Enregistrement du secret de test..." -ForegroundColor Cyan
& npx --yes supabase@latest secrets set "TEST_PUSH_SECRET=$testSecret" --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
    throw "Impossible d'enregistrer TEST_PUSH_SECRET."
}

Write-Host "Déploiement de $functionName..." -ForegroundColor Cyan
& npx --yes supabase@latest functions deploy $functionName --project-ref $projectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) {
    throw "Déploiement de $functionName impossible."
}

Write-Host ""
Write-Host "Envoi du Push de test..." -ForegroundColor Cyan

$body = @{ source = "manual-phone-test" } | ConvertTo-Json

try {
    $result = Invoke-RestMethod `
      -Uri "https://$projectRef.supabase.co/functions/v1/$functionName" `
      -Method POST `
      -Headers @{
        "x-test-push-secret" = $testSecret
        "Content-Type" = "application/json"
      } `
      -Body $body

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " RESULTAT DU TEST" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host ""
    $result | ConvertTo-Json -Depth 5
    Write-Host ""
    Write-Host "Sauvegarde : $backupDir" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "REGARDE TON TELEPHONE : une notification doit arriver maintenant." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "La fonction de test reste déployée pour le moment." -ForegroundColor DarkGray
    Write-Host "On la supprimera après validation." -ForegroundColor DarkGray
}
catch {
    Write-Host ""
    Write-Host "ERREUR pendant l'envoi du Push." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "La fonction reste déployée afin de pouvoir consulter ses logs." -ForegroundColor Yellow
    exit 1
}
