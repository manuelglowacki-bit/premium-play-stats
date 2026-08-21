$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
while ($root -and -not (Test-Path (Join-Path $root "package.json"))) {
    $parent = Split-Path $root -Parent
    if ($parent -eq $root) { $root = $null; break }
    $root = $parent
}
if (-not $root) { throw "Projet React introuvable. Lance le script dans C:\Users\MANUE\Downloads\new site." }

$projectRef = "azgksiwcgvbertzzzhvq"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root "backup-push-vestiaire-$timestamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null

function Write-Utf8NoBom([string]$Path,[string]$Content) {
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " NOTIFICATIONS PUSH - VESTIAIRE" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1. VAPID
# ------------------------------------------------------------
$vapidPath = Join-Path $root ".push-vapid.local.json"
$vapid = $null

if (Test-Path $vapidPath) {
    try { $vapid = Get-Content $vapidPath -Raw | ConvertFrom-Json } catch { $vapid = $null }
}

if (-not $vapid -or -not $vapid.publicKey -or -not $vapid.privateKey) {
    Write-Host "Generation des cles VAPID..." -ForegroundColor Cyan
    $out = (& npx --yes web-push generate-vapid-keys --json 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Impossible de generer les cles VAPID." }

    $m = [regex]::Match($out, '\{[\s\S]*"publicKey"[\s\S]*"privateKey"[\s\S]*\}')
    if (-not $m.Success) { throw "Impossible de lire les cles VAPID generees." }
    $vapid = $m.Value | ConvertFrom-Json

    Write-Utf8NoBom $vapidPath (@{
        publicKey = [string]$vapid.publicKey
        privateKey = [string]$vapid.privateKey
        createdAt = (Get-Date).ToString("o")
    } | ConvertTo-Json)

    Write-Host "OK : nouvelles cles VAPID generees." -ForegroundColor Green
}

Write-Host "Enregistrement des secrets VAPID dans Supabase..." -ForegroundColor Cyan
& npx --yes supabase@latest secrets set `
  "VAPID_PUBLIC_KEY=$([string]$vapid.publicKey)" `
  "VAPID_PRIVATE_KEY=$([string]$vapid.privateKey)" `
  "VAPID_SUBJECT=mailto:manuelglowacki@gmail.com" `
  --project-ref $projectRef

if ($LASTEXITCODE -ne 0) { throw "Echec de l'enregistrement des secrets VAPID." }
Write-Host "OK : secrets VAPID enregistres." -ForegroundColor Green

# Public key seulement dans le frontend.
$envPath = Join-Path $root ".env.local"
$envContent = ""
if (Test-Path $envPath) { $envContent = [System.IO.File]::ReadAllText($envPath) }

if ($envContent -match '(?m)^VITE_VAPID_PUBLIC_KEY=') {
    $envContent = [regex]::Replace($envContent, '(?m)^VITE_VAPID_PUBLIC_KEY=.*$', "VITE_VAPID_PUBLIC_KEY=$($vapid.publicKey)")
} else {
    if ($envContent -and -not $envContent.EndsWith("`n")) { $envContent += "`r`n" }
    $envContent += "VITE_VAPID_PUBLIC_KEY=$($vapid.publicKey)`r`n"
}
Write-Utf8NoBom $envPath $envContent
Write-Host "OK : VITE_VAPID_PUBLIC_KEY ajoute dans .env.local." -ForegroundColor Green

# ------------------------------------------------------------
# 2. Service worker
# ------------------------------------------------------------
$sw = @'
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || "Prono Ligue 1 LM";
  const options = {
    body: data.body || "Tu as une nouvelle notification.",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/pwa-192x192.png",
    tag: data.tag || "prono-ligue1",
    data: data.data || { url: "/pronostics" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/pronostics";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
'@
Write-Utf8NoBom (Join-Path $root "public\push-sw.js") $sw
Write-Host "OK : public\push-sw.js" -ForegroundColor Green

# ------------------------------------------------------------
# 3. React component
# ------------------------------------------------------------
$component = @'
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function PushNotificationsButton() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      try {
        const registration = await navigator.serviceWorker.register("/push-sw.js");
        const subscription = await registration.pushManager.getSubscription();
        setEnabled(Boolean(subscription));
      } catch (error) {
        console.error("Push init:", error);
      }
    })();
  }, []);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Les notifications Push ne sont pas disponibles sur cet appareil.");
      }

      if (!VAPID_PUBLIC_KEY) {
        throw new Error("VITE_VAPID_PUBLIC_KEY est absent de .env.local.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté pour activer les notifications.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permission de notification refusée.");

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const json = subscription.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error("Abonnement Push incomplet.");
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) throw error;

      setEnabled(true);
      setMessage("Notifications activées ✓");
    } catch (error) {
      console.error("Activation Push:", error);
      setMessage(error instanceof Error ? error.message : "Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (user && subscription) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      if (subscription) await subscription.unsubscribe();

      setEnabled(false);
      setMessage("Notifications désactivées.");
    } catch (error) {
      console.error("Désactivation Push:", error);
      setMessage("Impossible de désactiver les notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-3 my-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">🔔 Rappels de pronostics</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-400">
            Reçois une notification 1 h avant un match si tu n'as pas encore fait ton prono.
          </div>
          {message && <div className="mt-2 text-xs text-emerald-300">{message}</div>}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void (enabled ? disablePush() : enablePush())}
          className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition ${
            enabled
              ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "bg-emerald-400 text-[#06101c] hover:bg-emerald-300"
          } disabled:opacity-50`}
        >
          {busy ? "..." : enabled ? "ACTIVÉ" : "ACTIVER"}
        </button>
      </div>
    </div>
  );
}
'@
$componentPath = Join-Path $root "src\components\PushNotificationsButton.tsx"
Write-Utf8NoBom $componentPath $component
Write-Host "OK : src\components\PushNotificationsButton.tsx" -ForegroundColor Green

# ------------------------------------------------------------
# 4. Branchage automatique dans la page Vestiaire
# ------------------------------------------------------------
$vestiaireFiles = Get-ChildItem (Join-Path $root "src") -Recurse -File -Include *.tsx,*.jsx |
    Where-Object { $_.Name -notmatch 'backup|\.back' }

$candidate = $null
foreach ($f in $vestiaireFiles) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    if ($txt -match 'chat_messages' -and $txt -match 'Vestiaire') {
        $candidate = $f
        break
    }
}

if (-not $candidate) {
    foreach ($f in $vestiaireFiles) {
        $txt = [System.IO.File]::ReadAllText($f.FullName)
        if ($txt -match 'chat_messages') {
            $candidate = $f
            break
        }
    }
}

if (-not $candidate) {
    Write-Host "ATTENTION : page Vestiaire non trouvee automatiquement." -ForegroundColor Yellow
    Write-Host "Le composant est cree, mais aucun fichier n'a ete modifie." -ForegroundColor Yellow
} else {
    $content = [System.IO.File]::ReadAllText($candidate.FullName)

    $importLine = 'import PushNotificationsButton from "@/components/PushNotificationsButton";'

    if ($content -notmatch 'PushNotificationsButton') {
        Copy-Item $candidate.FullName (Join-Path $backup $candidate.Name) -Force

        # Ajoute l'import avant le premier import existant.
        $content = $importLine + "`r`n" + $content

        # Place le bloc juste après l'ouverture du premier AppShell.
        if ($content -match '<AppShell>') {
            $content = [regex]::Replace(
                $content,
                '<AppShell>',
                "<AppShell>`r`n      <PushNotificationsButton />",
                1
            )
        } else {
            Write-Host "ATTENTION : <AppShell> introuvable dans $($candidate.Name)." -ForegroundColor Yellow
        }

        Write-Utf8NoBom $candidate.FullName $content
        Write-Host "OK : bouton branche dans $($candidate.FullName)" -ForegroundColor Green
        Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
    } else {
        Write-Host "OK : PushNotificationsButton est deja present dans $($candidate.Name)." -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# 5. Build
# ------------------------------------------------------------
Write-Host ""
Write-Host "Lancement du build..." -ForegroundColor Cyan
Push-Location $root
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Le build a echoue. La sauvegarde est disponible ici : $backup"
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NOTIFICATIONS PUSH BRANCHEES" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "VAPID : OK" -ForegroundColor Green
Write-Host "Table push_subscriptions : OK" -ForegroundColor Green
Write-Host "Service Worker : OK" -ForegroundColor Green
Write-Host "Bouton Vestiaire : OK si detecte" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT : redemarre Vite apres la modification de .env.local :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
