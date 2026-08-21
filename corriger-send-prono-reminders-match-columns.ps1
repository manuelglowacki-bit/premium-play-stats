$ErrorActionPreference = "Stop"

$root = Get-Location
$file = Join-Path $root "supabase\functions\send-prono-reminders\index.ts"

Write-Host ""
Write-Host "=== CORRECTION SEND-PRONO-REMINDERS ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $file)) {
    throw "Fichier introuvable : $file"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$text = [System.IO.File]::ReadAllText($file)

# Le log Supabase confirme que matches.home_name n'existe pas.
# Le projet utilise les colonnes matches.home_team / away_team / kickoff.
$text = $text.Replace(
    'select("id,home_team,away_team,home_name,away_name,kickoff")',
    'select("id,home_team,away_team,kickoff")'
)

# On simplifie aussi les types/replis : aucune référence aux colonnes absentes.
$text = $text.Replace(
    '  home_name?: string | null;' + [Environment]::NewLine,
    ''
)
$text = $text.Replace(
    '  away_name?: string | null;' + [Environment]::NewLine,
    ''
)

$text = $text.Replace(
    '    ? match.home_team ?? match.home_name ?? "Équipe domicile"',
    '    ? match.home_team ?? "Équipe domicile"'
)
$text = $text.Replace(
    '    : match.away_team ?? match.away_name ?? "Équipe extérieure"',
    '    : match.away_team ?? "Équipe extérieure"'
)

[System.IO.File]::WriteAllText(
    $file,
    $text,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "OK : requête matches corrigée." -ForegroundColor Green
Write-Host "   matches.home_name / away_name supprimés." -ForegroundColor Green
Write-Host "   Utilisation : home_team / away_team / kickoff." -ForegroundColor Green

Write-Host ""
Write-Host "Déploiement de la fonction..." -ForegroundColor Cyan

& npx --yes supabase@latest functions deploy send-prono-reminders --project-ref azgksiwcgvbertzzzhvq --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    throw "Le déploiement de send-prono-reminders a échoué."
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " FONCTION CORRIGÉE ET REDEPLOYEE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tu peux maintenant refaire le test HTTP." -ForegroundColor Cyan
Write-Host ""
