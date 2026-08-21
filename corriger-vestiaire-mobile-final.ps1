$ErrorActionPreference = "Stop"

$file = ".\src\components\VestiaireFloatingButton.tsx"

Write-Host ""
Write-Host "=== CORRECTION DEFINITIVE DU BOUTON VESTIAIRE MOBILE ===" -ForegroundColor Cyan

if (!(Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
}

$backup = "$file.backup-vestiaire-mobile-final-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "OK : sauvegarde -> $backup" -ForegroundColor Green

$content = [System.IO.File]::ReadAllText($file)

# Remplacements EXACTS du fichier actuel.
$content = $content.Replace(
'fixed bottom-24 right-5 z-[100]',
'fixed bottom-[155px] right-3 z-[99998] md:bottom-24 md:right-5'
)

$content = $content.Replace(
'group fixed bottom-5 right-5 z-[101]',
'group fixed bottom-[82px] right-3 z-[99999] md:bottom-5 md:right-5'
)

# Fallback si le formatage du fichier a changé.
$content = $content.Replace(
'fixed bottom-5 right-5 z-[101]',
'fixed bottom-[82px] right-3 z-[99999] md:bottom-5 md:right-5'
)

$content = $content.Replace(
'fixed bottom-24 right-5 z-[100]',
'fixed bottom-[155px] right-3 z-[99998] md:bottom-24 md:right-5'
)

[System.IO.File]::WriteAllText(
    $file,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

$check = [System.IO.File]::ReadAllText($file)

if ($check -notmatch 'bottom-\[82px\].*z-\[99999\]') {
    throw "La position du bouton n'a pas ete modifiee."
}

Write-Host "OK : bouton mobile -> bottom 82px / z-index 99999" -ForegroundColor Green
Write-Host "OK : popup mobile -> bottom 155px / z-index 99998" -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
& npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Le build a echoue. Sauvegarde : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " BOUTON VESTIAIRE CORRIGE ET BUILD OK" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT : deploye maintenant cette version :" -ForegroundColor Yellow
Write-Host "npx vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Puis sur le telephone : ferme/reouvre le site Vercel et recharge la page." -ForegroundColor Cyan
Write-Host ""
