$ErrorActionPreference = "Stop"

$file = ".\src\routes\profil.tsx"

if (!(Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
}

$backup = "$file.backup-notifications-profil-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $file -Destination $backup -Force

$content = [System.IO.File]::ReadAllText($file)

# 1. Import propre
if ($content -notmatch 'PushNotificationsButton') {
    $anchor = 'import { AppShell } from "@/components/prono/AppShell";'

    if ($content.Contains($anchor)) {
        $content = $content.Replace(
            $anchor,
            $anchor + "`r`n" + 'import PushNotificationsButton from "@/components/PushNotificationsButton";'
        )
    } else {
        throw "Import AppShell introuvable."
    }
}

# 2. Bloc Notifications.
# On l'insère à un emplacement JSX sûr : juste avant la section MON PROFIL.
if ($content -notmatch 'id="profile-push-notifications"') {

    $marker = '        {/* ================= MON PROFIL ================= */}'

    if (!$content.Contains($marker)) {
        throw "Repère MON PROFIL introuvable dans profil.tsx."
    }

    $block = @'
        {/* ================= NOTIFICATIONS ================= */}
        <section
          id="profile-push-notifications"
          className="rounded-3xl border border-emerald-400/20 bg-[#0d1322]/75 p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-6"
        >
          <div className="mb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Notifications
            </div>
            <h2 className="mt-1 text-lg font-black text-white">
              Rappels de pronostics
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
              Reçois une notification 1 h avant un match si tu n'as pas encore fait ton prono.
            </p>
          </div>

          <PushNotificationsButton />
        </section>

'@

    $content = $content.Replace($marker, $block + $marker)
}

[System.IO.File]::WriteAllText(
    $file,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NOTIFICATIONS AJOUTEES DANS PROFIL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""

Write-Host "=== BUILD ===" -ForegroundColor Cyan
& npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD ECHOUE." -ForegroundColor Red
    Write-Host "Pour revenir en arriere :" -ForegroundColor Yellow
    Write-Host "Copy-Item `"$backup`" `"$file`" -Force" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " BUILD OK - PROFIL PRET" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Le Floating reste supprime." -ForegroundColor Cyan
Write-Host "Les notifications sont maintenant dans Profil." -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaine commande :" -ForegroundColor Yellow
Write-Host "npx vercel --prod" -ForegroundColor White
