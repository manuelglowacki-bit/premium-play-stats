$ErrorActionPreference = "Stop"

$file = ".\src\components\prono\AppShell.tsx"

if (-not (Test-Path $file)) {
    Write-Host "AppShell introuvable : $file" -ForegroundColor Red
    exit 1
}

$content = Get-Content $file -Raw -Encoding UTF8

if ($content -match 'label:\s*"Vestiaire"\s*,\s*to:\s*"/vestiaire"') {
    Write-Host "Vestiaire est deja present dans la navigation." -ForegroundColor Yellow
    exit 0
}

$backup = "$file.backup-nav-vestiaire-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $file $backup -Force

if ($content -notmatch 'import\s*\{[\s\S]*MessageCircle[\s\S]*\}\s*from\s*"lucide-react"') {
    $content = $content -replace '(import\s*\{[\s\S]*?Award,)([\s\S]*?\}\s*from\s*"lucide-react";)', '$1`r`n  MessageCircle,$2'
}

$pattern = '(\{\s*label:\s*"Trophées"\s*,\s*to:\s*"/trophees"\s*,\s*icon:\s*Award\s*\},)'
$replacement = '$1' + "`r`n    { label: `"Vestiaire`", to: `"/vestiaire`", icon: MessageCircle },"

$newContent = [regex]::Replace($content, $pattern, $replacement, 1)

if ($newContent -eq $content) {
    Write-Host "Impossible d'ajouter Vestiaire automatiquement." -ForegroundColor Red
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $file), $newContent, $utf8)

Write-Host ""
Write-Host "✓ Vestiaire ajoute a la navigation." -ForegroundColor Green
Write-Host "✓ Trophées reste present." -ForegroundColor Green
Write-Host "✓ Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Lance : npm run dev" -ForegroundColor Yellow
