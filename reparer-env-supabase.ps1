$ErrorActionPreference = "Stop"

$root = Get-Location
$envPath = Join-Path $root ".env"

Write-Host ""
Write-Host "=== REPARATION DU .env POUR SUPABASE CLI ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $envPath)) {
    throw "Fichier .env introuvable."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root ".env.backup-$stamp"
Copy-Item $envPath $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$raw = [System.IO.File]::ReadAllText($envPath)
$raw = $raw -replace "^\uFEFF", ""
$raw = $raw -replace "`0", ""

$lines = $raw -split "\r?\n"
$clean = New-Object System.Collections.Generic.List[string]
$removed = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    $trim = $line.Trim()

    if ($trim -eq "") {
        continue
    }

    if ($trim.StartsWith("#")) {
        $clean.Add($trim)
        continue
    }

    # Format accepté : NOM_VARIABLE=valeur
    if ($trim -match '^[A-Za-z_][A-Za-z0-9_]*\s*=') {
        $left = ($trim -split "=", 2)[0].Trim()
        $right = ($trim -split "=", 2)[1]

        # Retire uniquement les caractères parasites autour du nom.
        $left = $left.Trim().Trim('"').Trim("'").Trim()

        if ($left -match '^[A-Za-z_][A-Za-z0-9_]*$') {
            $clean.Add("$left=$right")
        }
        else {
            $removed.Add($trim)
        }
    }
    else {
        $removed.Add($trim)
    }
}

# Écrit en UTF-8 sans BOM pour éviter les erreurs du parser dotenv.
[System.IO.File]::WriteAllText(
    $envPath,
    (($clean -join [Environment]::NewLine) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "OK : .env nettoyé en UTF-8 sans BOM." -ForegroundColor Green

if ($removed.Count -gt 0) {
    Write-Host ""
    Write-Host "Lignes retirées car invalides pour le format dotenv :" -ForegroundColor Yellow
    foreach ($bad in $removed) {
        Write-Host "  $bad" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "Test du parsing Supabase..." -ForegroundColor Cyan

# Le CLI doit maintenant pouvoir lire le projet.
& npx --yes supabase@latest --version
if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI indisponible."
}

Write-Host ""
Write-Host "=== REPARATION TERMINEE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Teste maintenant :" -ForegroundColor Cyan
Write-Host "npx --yes supabase@latest link --project-ref azgksiwcgvbertzzzhvq" -ForegroundColor White
Write-Host ""
Write-Host "Si cette commande passe, on relancera ensuite le branchement VAPID." -ForegroundColor Green
Write-Host ""
