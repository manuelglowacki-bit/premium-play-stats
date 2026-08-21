$ErrorActionPreference = "Stop"

$componentDir = Join-Path $PSScriptRoot "src\components"
$componentPath = Join-Path $componentDir "VestiaireFloatingButton.tsx"

Write-Host ""
Write-Host "=== CREATION DU BOUTON FLOTTANT LE VESTIAIRE ===" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Force -Path $componentDir | Out-Null

$sourceFile = Join-Path $PSScriptRoot "VestiaireFloatingButton.tsx"

if (-not (Test-Path $sourceFile)) {
    throw "Le fichier VestiaireFloatingButton.tsx doit être dans le même dossier que ce script."
}

Copy-Item -Path $sourceFile -Destination $componentPath -Force

Write-Host "OK : $componentPath" -ForegroundColor Green
Write-Host ""
Write-Host "Le composant est maintenant créé dans src/components." -ForegroundColor Green
Write-Host ""
Write-Host "Ajoute ensuite dans ton AppShell / layout global :" -ForegroundColor Yellow
Write-Host 'import VestiaireFloatingButton from "@/components/VestiaireFloatingButton";' -ForegroundColor White
Write-Host ""
Write-Host "Puis dans le JSX :" -ForegroundColor Yellow
Write-Host "<VestiaireFloatingButton />" -ForegroundColor White
Write-Host ""
Write-Host "Le bouton apparaîtra en bas à droite sur les pages du site." -ForegroundColor Green
Write-Host ""
