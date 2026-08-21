$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   RESTAURATION TROPHÉES - PRONO LIGUE 1" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Trouve la racine du projet à partir du dossier où se trouve ce script.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $null
$current = Get-Item $scriptDir

while ($current) {
    if (
        (Test-Path (Join-Path $current.FullName "package.json")) -and
        (Test-Path (Join-Path $current.FullName "src"))
    ) {
        $projectRoot = $current.FullName
        break
    }

    if ($current.Parent -eq $current) { break }
    $current = $current.Parent
}

if (-not $projectRoot) {
    Write-Host "Projet non trouvé automatiquement." -ForegroundColor Yellow
    $projectRoot = Read-Host "Colle le chemin du dossier qui contient package.json"
    $projectRoot = $projectRoot.Trim('"').Trim()
}

$package = Join-Path $projectRoot "package.json"
$destination = Join-Path $projectRoot "src\routes\trophees.tsx"

if (-not (Test-Path $package)) {
    Write-Host "ERREUR : package.json introuvable." -ForegroundColor Red
    Write-Host "Projet utilisé : $projectRoot" -ForegroundColor Red
    Read-Host "Entrée pour fermer"
    exit 1
}

$dir = Split-Path $destination -Parent
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# Sauvegarde de l'actuel trophees.tsx, s'il existe.
if (Test-Path $destination) {
    $backup = "$destination.backup-before-restore-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item $destination $backup -Force
    Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
}

# Contenu Trophées original embarqué directement dans ce script.
$base64 = @'
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
'@

$raw = [Convert]::FromBase64String(($base64 -replace "\s",""))
$inputStream = New-Object System.IO.MemoryStream(,$raw)
$gzip = New-Object System.IO.Compression.GZipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
$outputStream = New-Object System.IO.MemoryStream
$gzip.CopyTo($outputStream)
$gzip.Dispose()
$inputStream.Dispose()

$content = [System.Text.Encoding]::UTF8.GetString($outputStream.ToArray())
$outputStream.Dispose()

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($destination, $content, $utf8NoBom)

# Vérification réelle du fichier écrit.
$written = Get-Content $destination -Raw -Encoding UTF8

$ok = (
    $written -match 'createFileRoute\("/trophees"\)' -and
    $written -match 'component:\s*TropheesPage' -and
    $written -match 'fetchUserTrophies' -and
    $written -match 'function TropheesPage' -and
    $written -match 'ALL_TROPHIES'
)

Write-Host ""

if (-not $ok) {
    Write-Host "ERREUR : le fichier a été écrit mais la vérification a échoué." -ForegroundColor Red
    Read-Host "Entrée pour fermer"
    exit 1
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host "       ✓ TROPHÉES RESTAURÉE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fichier :" -ForegroundColor White
Write-Host $destination -ForegroundColor Cyan
Write-Host ""
Write-Host "Route : /trophees" -ForegroundColor Cyan
Write-Host ""
Write-Host "AppShell et les autres pages n'ont pas été modifiés." -ForegroundColor Green
Write-Host ""
Write-Host "Lance maintenant :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvre /trophees et fais Ctrl + Shift + R." -ForegroundColor Yellow
Write-Host ""
Read-Host "Appuie sur Entrée pour fermer"
