$ErrorActionPreference = "Stop"

$file = ".\supabase\functions\send-prono-reminders\index.ts"

if (!(Test-Path $file)) {
    throw "Fichier introuvable : $file"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-notification-text-$stamp"

Copy-Item $file $backup -Force
Write-Host "Sauvegarde créée : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# Remplace uniquement le texte du payload de notification.
# On utilise uniquement des caractères UTF-8 simples pour éviter les problèmes
# d'encodage observés sur Android/Chrome.
$pattern = '(?s)const payload = JSON\.stringify\(\{.*?\n\s*\}\);'

$replacement = @'
const payload = JSON.stringify({
        title: "Prono Ligue 1 LM",
        body: `${home} - ${away} commence dans 1 heure. Tu n'as pas encore fait ton pronostic.`,
        url: "/pronostics",
        icon: "/prono-icon-192.png",
        badge: "/prono-icon-192.png",
        tag: `prono-reminder-${matchId}`,
        data: {
          url: "/pronostics",
          matchId,
          type: "prono-reminder",
        },
      });
'@

$updated = [regex]::Replace($content, $pattern, $replacement, 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "Bloc payload introuvable. Aucun changement conservé."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host "OK : texte de notification corrigé." -ForegroundColor Green
Write-Host "Titre : Prono Ligue 1 LM" -ForegroundColor Cyan
Write-Host "Message : Equipe - Equipe commence dans 1 heure. Tu n'as pas encore fait ton pronostic." -ForegroundColor Cyan

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
Write-Host " TEXTE NOTIFICATION CORRIGE ET DEPLOYE !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
