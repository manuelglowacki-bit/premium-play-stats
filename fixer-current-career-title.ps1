$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-fix-career-title-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# Supprime toutes les declarations careerTitle/currentCareerTitle actuellement placees
# au mauvais endroit.
$careerBlockPattern = '(?s)\s*const\s+careerTitle\s*=\s*\[.*?\]\s*as\s+const;\s*const\s+currentCareerTitle\s*=\s*careerTitle\[.*?\];\s*'
$content = [regex]::Replace($content, $careerBlockPattern, "`r`n", [System.Text.RegularExpressions.RegexOptions]::Singleline)

# Bloc correct, dans le scope du composant, juste avant le return principal AppShell.
$careerBlock = @'
  const careerTitle = [
    "Débutant",
    "Apprenti",
    "Novice",
    "Amateur",
    "Confirmé",
    "Régulier",
    "Compétiteur",
    "Averti",
    "Spécialiste",
    "Expert",
    "Stratège",
    "Tacticien",
    "Maître",
    "Élite",
    "Grand Maître",
    "Virtuose",
    "Maître Prono",
    "Champion",
    "Champion confirmé",
    "Champion d'élite",
    "Légendaire",
    "Icône",
    "Icône majeure",
    "Référence",
    "Grand Stratège",
    "Maître absolu",
    "Légende",
    "Légende ultime",
    "Immortel",
    "Icône de la Ligue",
  ] as const;

  const currentCareerTitle =
    careerTitle[Math.max(0, Math.min(careerLevel - 1, careerTitle.length - 1))];

'@

$mainReturn = '  return (' + "`r`n" + '      <AppShell>'

if (!$content.Contains($mainReturn)) {
    Copy-Item $backup $file -Force
    throw "Return principal AppShell introuvable. Fichier restaure."
}

$content = $content.Replace($mainReturn, $careerBlock + $mainReturn)

Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host "OK : currentCareerTitle replacé dans le scope du composant." -ForegroundColor Green

# Vérifications ciblées.
$check = Get-Content $file -Raw

if ($check -notmatch 'const currentCareerTitle') {
    Copy-Item $backup $file -Force
    throw "currentCareerTitle absent. Fichier restaure."
}

if ($check -notmatch 'const careerTitle = \[') {
    Copy-Item $backup $file -Force
    throw "careerTitle absent. Fichier restaure."
}

if ($check -match 'const isExactPrediction.*?const careerTitle') {
    Copy-Item $backup $file -Force
    throw "careerTitle est encore dans isExactPrediction. Fichier restaure."
}

Write-Host "OK : declarations dans le bon scope." -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build echoue. Fichier restaure depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " FIX CARRIERE TITLE : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "currentCareerTitle : scope composant OK"
Write-Host "Badge Niveau : OK"
Write-Host "Build : OK"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
