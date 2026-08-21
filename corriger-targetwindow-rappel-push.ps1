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

# Remplace toute la fonction targetWindow(), quelle que soit sa mise en forme actuelle.
$pattern = '(?s)function\s+targetWindow\s*\(\s*now\s*:\s*Date\s*\)\s*\{.*?\n\}'

$replacement = @'
function targetWindow(now: Date) {
  // Fonction appelée toutes les minutes.
  // On accepte une fenêtre de ±5 minutes autour de T-1h
  // pour éviter de rater le rappel si le cron prend quelques minutes de retard.
  const target = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    from: new Date(target.getTime() - 5 * 60 * 1000),
    to: new Date(target.getTime() + 5 * 60 * 1000),
  };
}
'@

$updated = [regex]::Replace($content, $pattern, $replacement, 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "La fonction targetWindow() n'a pas été trouvée. Aucun changement conservé."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host ""
Write-Host "OK : targetWindow() remplacée par une fenêtre de ±5 minutes." -ForegroundColor Green

# Vérification
$check = Get-Content $file -Raw

if ($check -notmatch '5 \* 60 \* 1000') {
    Copy-Item $backup $file -Force
    throw "Vérification échouée. Fichier restauré."
}

Write-Host "OK : vérification réussie." -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build échoué. Fichier restauré depuis la sauvegarde."
}

Write-Host ""
Write-Host "=== DEPLOIEMENT SUPABASE ===" -ForegroundColor Cyan

npx --yes supabase@latest functions deploy send-prono-reminders --project-ref azgksiwcgvbertzzzhvq --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    throw "Déploiement Supabase échoué. Sauvegarde disponible : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " RAPPELS PUSH CORRIGES ET DEPLOYES !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fenêtre : ±5 minutes autour de T-1h" -ForegroundColor White
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
