$ErrorActionPreference = "Stop"

$root = Get-Location
$path = Join-Path $root "src\components\PushNotificationsButton.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    throw "Fichier introuvable : $path"
}

$backup = "$path.backup-supabase-import-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $path -Destination $backup -Force

$content = [System.IO.File]::ReadAllText($path)

# Le projet utilise src/lib/supabase.ts et non src/lib/supabaseClient.ts.
$content = $content.Replace(
    'from "@/lib/supabaseClient";',
    'from "@/lib/supabase";'
)

[System.IO.File]::WriteAllText(
    $path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " CORRECTION IMPORT SUPABASE PUSH" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK : import corrige vers @/lib/supabase" -ForegroundColor Green
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Verification..." -ForegroundColor Cyan

$check = [System.IO.File]::ReadAllText($path)

if ($check -match '@/lib/supabaseClient') {
    throw "L'ancien import supabaseClient est encore present."
}

if ($check -notmatch '@/lib/supabase') {
    throw "Le nouvel import @/lib/supabase est absent."
}

Write-Host "OK : import valide." -ForegroundColor Green
Write-Host ""
Write-Host "Lance maintenant :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis Ctrl + F5 sur http://localhost:5173/" -ForegroundColor Cyan
