$ErrorActionPreference = "Stop"

$admin = Join-Path (Get-Location) "src\routes\admin.tsx"

if (-not (Test-Path $admin)) {
    throw "Fichier introuvable : $admin"
}

$backup = "$admin.backup-encoding"
Copy-Item $admin $backup -Force

$content = Get-Content $admin -Raw

# Répare les principales séquences UTF-8 mal décodées visibles dans l'Admin.
$replacements = @{
    "Ã‰" = "É"
    "Ã©" = "é"
    "Ã¨" = "è"
    "Ãª" = "ê"
    "Ã«" = "ë"
    "Ã®" = "î"
    "Ã¯" = "ï"
    "Ã´" = "ô"
    "Ã¶" = "ö"
    "Ã¹" = "ù"
    "Ã»" = "û"
    "Ã¼" = "ü"
    "Ã§" = "ç"
    "Ã€" = "À"
    "Ã‚" = "Â"
    "Ã‡" = "Ç"
    "Ãˆ" = "È"
    "Ã‰" = "É"
    "ÃŠ" = "Ê"
    "Ã‹" = "Ë"
    "ÃŽ" = "Î"
    "Ã”" = "Ô"
    "Ã™" = "Ù"
    "Ã›" = "Û"
    "Ãœ" = "Ü"
    "Ã "  = "à"
    "â€”" = "—"
    "â€“" = "–"
    "â€¦" = "…"
    "â€™" = "’"
    "â€œ" = "“"
    "â€" = "”"
    "â€¢" = "•"
    "Â "  = " "
}

foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

Set-Content -Path $admin -Value $content -Encoding UTF8

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " CORRECTION ENCODAGE ADMIN TERMINEE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "La sauvegarde est ici :" -ForegroundColor Cyan
Write-Host $backup
Write-Host ""
Write-Host "Relance ensuite :" -ForegroundColor Yellow
Write-Host "npm run build"
Write-Host ""
