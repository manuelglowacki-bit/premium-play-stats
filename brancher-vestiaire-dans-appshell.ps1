$ErrorActionPreference = "Stop"

$projectRoot = Get-Location
$appShell = Join-Path $projectRoot "src\components\prono\AppShell.tsx"
$component = Join-Path $projectRoot "src\components\VestiaireFloatingButton.tsx"

Write-Host ""
Write-Host "=== BRANCHEMENT DU BOUTON FLOTTANT LE VESTIAIRE ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $appShell)) {
    throw "AppShell.tsx introuvable : $appShell"
}

if (-not (Test-Path $component)) {
    throw "VestiaireFloatingButton.tsx introuvable : $component"
}

$content = Get-Content -Raw -Encoding UTF8 $appShell

# Sauvegarde avant modification
$backup = "$appShell.backup-vestiaire-flottant"
Copy-Item $appShell $backup -Force
Write-Host "Sauvegarde créée : $backup" -ForegroundColor DarkGray

$importLine = 'import VestiaireFloatingButton from "@/components/VestiaireFloatingButton";'

if ($content -notmatch 'VestiaireFloatingButton') {
    # Ajoute l'import après le dernier import existant.
    $importMatches = [regex]::Matches($content, '(?m)^import .+;$')
    if ($importMatches.Count -eq 0) {
        throw "Impossible de trouver la zone des imports dans AppShell.tsx."
    }

    $lastImport = $importMatches[$importMatches.Count - 1]
    $insertAt = $lastImport.Index + $lastImport.Length

    $content = $content.Insert($insertAt, "`r`n$importLine")
    Write-Host "Import ajouté." -ForegroundColor Green
}
else {
    Write-Host "Import/composant déjà présent : pas de doublon." -ForegroundColor Yellow
}

# Ajoute le composant juste après {children}, dans le JSX de l'AppShell.
if ($content -notmatch '<VestiaireFloatingButton\s*/>') {
    $childrenMatch = [regex]::Match($content, '\{children\}')

    if (-not $childrenMatch.Success) {
        throw "Impossible de trouver {children} dans AppShell.tsx. Aucun changement supplémentaire effectué."
    }

    $button = @"
{children}
      <VestiaireFloatingButton />
"@

    $content = $content.Remove($childrenMatch.Index, $childrenMatch.Length)
    $content = $content.Insert($childrenMatch.Index, $button)

    Write-Host "Bouton flottant ajouté à l'AppShell." -ForegroundColor Green
}
else {
    Write-Host "Le bouton flottant est déjà présent dans AppShell.tsx." -ForegroundColor Yellow
}

Set-Content -Path $appShell -Value $content -Encoding UTF8

Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichier modifié :" -ForegroundColor White
Write-Host $appShell -ForegroundColor Green
Write-Host ""
Write-Host "Sauvegarde :" -ForegroundColor White
Write-Host $backup -ForegroundColor DarkGray
Write-Host ""
Write-Host "Lance maintenant :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvre http://localhost:5173/ et fais Ctrl + F5." -ForegroundColor Yellow
Write-Host ""
Write-Host "Le bouton Le Vestiaire sera visible en bas à droite sur les pages utilisant AppShell." -ForegroundColor Green
