$ErrorActionPreference = "Stop"

$projectRoot = Get-Location
$appShell = Join-Path $projectRoot "src\components\prono\AppShell.tsx"
$component = Join-Path $projectRoot "src\components\VestiaireFloatingButton.tsx"

Write-Host ""
Write-Host "=== BRANCHEMENT DU VESTIAIRE FLOTTANT ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $appShell)) {
    throw "Fichier introuvable : $appShell"
}

if (-not (Test-Path $component)) {
    throw "Composant introuvable : $component"
}

$content = Get-Content -Raw -Encoding UTF8 $appShell

# Sauvegarde
$backup = "$appShell.backup-vestiaire-flottant-2"
Copy-Item $appShell $backup -Force
Write-Host "Sauvegarde créée :" -ForegroundColor DarkGray
Write-Host $backup -ForegroundColor DarkGray
Write-Host ""

$importLine = 'import VestiaireFloatingButton from "@/components/VestiaireFloatingButton";'

# Ajout de l'import.
if ($content -notmatch 'VestiaireFloatingButton') {
    # On ajoute l'import tout en haut : TypeScript/React accepte parfaitement
    # les imports en tête de fichier, quel que soit le format des imports existants.
    $content = $importLine + "`r`n" + $content
    Write-Host "OK : import ajouté." -ForegroundColor Green
}
else {
    Write-Host "OK : import déjà présent." -ForegroundColor Yellow
}

# Ajout du composant dans le JSX.
if ($content -notmatch '<VestiaireFloatingButton\s*/>') {

    # Cas classique : {children}
    $match = [regex]::Match($content, '\{children\}')

    if ($match.Success) {
        $replacement = "{children}`r`n      <VestiaireFloatingButton />"
        $content = $content.Remove($match.Index, $match.Length)
        $content = $content.Insert($match.Index, $replacement)
        Write-Host "OK : bouton ajouté juste après {children}." -ForegroundColor Green
    }
    else {
        # Fallback : cherche une variable children utilisée en JSX.
        $match = [regex]::Match($content, '(?m)^(\s*)children\s*$')

        if ($match.Success) {
            $indent = $match.Groups[1].Value
            $replacement = $match.Value + "`r`n${indent}<VestiaireFloatingButton />"
            $content = $content.Remove($match.Index, $match.Length)
            $content = $content.Insert($match.Index, $replacement)
            Write-Host "OK : bouton ajouté après children." -ForegroundColor Green
        }
        else {
            throw "Je n'ai pas trouvé {children} dans AppShell.tsx. Le fichier a été sauvegardé, mais aucune modification finale n'a été appliquée."
        }
    }
}
else {
    Write-Host "OK : bouton déjà présent dans AppShell.tsx." -ForegroundColor Yellow
}

Set-Content -Path $appShell -Value $content -Encoding UTF8

Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "AppShell modifié :" -ForegroundColor White
Write-Host $appShell -ForegroundColor Green
Write-Host ""
Write-Host "Lance maintenant :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvre http://localhost:5173/ et fais Ctrl + F5." -ForegroundColor Yellow
Write-Host ""
