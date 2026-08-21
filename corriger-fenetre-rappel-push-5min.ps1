$ErrorActionPreference = "Stop"

$file = ".\supabase\functions\send-prono-reminders\index.ts"

if (!(Test-Path $file)) {
    throw "Fichier introuvable : $file"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-window-5min-$stamp"

Copy-Item $file $backup -Force
Write-Host "Sauvegarde créée : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

$old1 = 'const from = new Date(target.getTime() - 90 * 1000);'
$old2 = 'const to = new Date(target.getTime() + 90 * 1000);'

if (!$content.Contains($old1) -or !$content.Contains($old2)) {
    throw "Les lignes 90 secondes attendues ne sont pas présentes. Aucun changement supplémentaire effectué."
}

$content = $content.Replace(
    $old1,
    'const from = new Date(target.getTime() - 5 * 60 * 1000);'
)

$content = $content.Replace(
    $old2,
    'const to = new Date(target.getTime() + 5 * 60 * 1000);'
)

$content = $content.Replace(
    'On accepte une fenêtre de ±90 secondes autour de T-1h',
    'On accepte une fenêtre de ±5 minutes autour de T-1h'
)

Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "OK : fenêtre T-1h passée de ±90 secondes à ±5 minutes." -ForegroundColor Green
Write-Host ""

Write-Host "Vérification :" -ForegroundColor Cyan
Select-String -Path $file -Pattern "5 \* 60 \* 1000|±5 minutes" -Context 0,0

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build échoué : restauration automatique du fichier."
}

Write-Host ""
Write-Host "=== DEPLOIEMENT SUPABASE ===" -ForegroundColor Cyan
npx --yes supabase@latest functions deploy send-prono-reminders --project-ref azgksiwcgvbertzzzhvq --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    throw "Déploiement Supabase échoué. Le fichier local reste modifié et la sauvegarde est disponible : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " CORRECTION DEPLOYEE !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fenêtre de rappel : ±5 minutes autour de T-1h" -ForegroundColor White
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
