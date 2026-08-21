$ErrorActionPreference = "Stop"

$root = Get-Location
$path = Join-Path $root "src\components\VestiaireFloatingButton.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    throw "Fichier introuvable : $path"
}

$backup = "$path.backup-push-floating-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $path -Destination $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$content = [System.IO.File]::ReadAllText($path)

$import = 'import PushNotificationsButton from "@/components/PushNotificationsButton";'

if ($content -notmatch 'PushNotificationsButton') {
    $marker = 'import { supabase } from "@/lib/supabase";'
    if ($content.Contains($marker)) {
        $content = $content.Replace($marker, "$marker`r`n$import")
    } else {
        $content = "$import`r`n$content"
    }
    Write-Host "OK : import PushNotificationsButton ajoute." -ForegroundColor Green
}

if ($content -notmatch '<PushNotificationsButton\s*/>') {
    $zone = '<div className="space-y-2 p-3">'
    if (-not $content.Contains($zone)) {
        throw "Zone du panneau flottant introuvable."
    }

    $replacement = @"
<div className="border-b border-white/[.06] px-3 py-2">
  <PushNotificationsButton />
</div>

$zone
"@

    $content = $content.Replace($zone, $replacement)
    Write-Host "OK : bouton notifications ajoute dans le Floating." -ForegroundColor Green
} else {
    Write-Host "Le composant PushNotificationsButton est deja dans le fichier." -ForegroundColor Yellow

    # Si l'import existe mais pas le JSX, ajoute quand meme le JSX.
    if ($content -notmatch '<PushNotificationsButton\s*/>') {
        throw "Etat inattendu du fichier."
    }
}

[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Verification..." -ForegroundColor Cyan

$check = [System.IO.File]::ReadAllText($path)

if ($check -match 'PushNotificationsButton' -and $check -match '<PushNotificationsButton\s*/>') {
    Write-Host "OK : bouton present dans VestiaireFloatingButton.tsx" -ForegroundColor Green
} else {
    throw "Le bouton n'a pas ete branche correctement."
}

Write-Host ""
Write-Host "Build..." -ForegroundColor Cyan
& npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Le build a echoue. Sauvegarde disponible : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " PUSH BRANCHE DANS LE FLOATING" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Lance ensuite : npm run dev" -ForegroundColor Cyan
Write-Host "Puis Ctrl + F5 sur http://localhost:5173/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ouvre le Floating : le bloc ACTIVATION DES NOTIFICATIONS doit maintenant apparaitre." -ForegroundColor White
