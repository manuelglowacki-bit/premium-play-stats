$ErrorActionPreference = "Stop"

$file = ".\src\components\VestiaireFloatingButton.tsx"

Write-Host ""
Write-Host "=== REGLAGE POSITION DU FLOATING VESTIAIRE ===" -ForegroundColor Cyan

if (!(Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
}

$backup = "$file.backup-floating-position-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$content = [System.IO.File]::ReadAllText($file)

# On cible les className contenant "fixed" dans le composant.
$pattern = 'className=(["''])(?<classes>[^"'']*\bfixed\b[^"'']*)\1'
$matches = [regex]::Matches($content, $pattern)

if ($matches.Count -eq 0) {
    throw "Aucune classe 'fixed' trouvee dans VestiaireFloatingButton.tsx. Je prefere ne rien modifier plutot que de toucher au mauvais element."
}

$changed = $false

$content = [regex]::Replace($content, $pattern, {
    param($m)

    $classes = $m.Groups["classes"].Value

    # Remplace toute position bottom Tailwind existante par une position
    # mobile clairement au-dessus de la barre de navigation.
    $newClasses = [regex]::Replace(
        $classes,
        '\bbottom-(?:\[[^\]]+\]|\d+|auto)\b',
        'bottom-[110px]'
    )

    # Si aucune classe bottom n'existait, on l'ajoute.
    if ($newClasses -eq $classes -and $newClasses -notmatch '\bbottom-') {
        $newClasses = "$newClasses bottom-[110px]"
    }

    # Force le floating au-dessus de la navigation et des overlays.
    if ($newClasses -match '\bz-\[[^\]]+\]') {
        $newClasses = [regex]::Replace($newClasses, '\bz-\[[^\]]+\]', 'z-[99999]')
    } elseif ($newClasses -match '\bz-\d+') {
        $newClasses = [regex]::Replace($newClasses, '\bz-\d+', 'z-[99999]')
    } else {
        $newClasses = "$newClasses z-[99999]"
    }

    if ($newClasses -ne $classes) {
        $script:changed = $true
    }

    return $m.Value.Replace($classes, $newClasses)
}, 1)

if (-not $changed) {
    throw "Aucune modification de position n'a ete necessaire."
}

[System.IO.File]::WriteAllText(
    $file,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "OK : floating place a 110px du bas." -ForegroundColor Green
Write-Host "OK : z-index force a 99999." -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
& npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Le build a echoue. Ta sauvegarde est ici : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " FLOATING VESTIAIRE CORRIGE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deploye ensuite :" -ForegroundColor Yellow
Write-Host "npx vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Sur le telephone : ferme/reouvre le site puis recharge." -ForegroundColor Cyan
