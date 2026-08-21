$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-fix-career-scope-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# ============================================================
# 1. Retirer careerTitle/currentCareerTitle de isExactPrediction
# ============================================================
$badBlock = '(?s)(const\s+isExactPrediction\s*=\s*\(p:\s*any\)\s*=>\s*\{.*?if\s*\(!m\s*\|\|\s*m\.home_score\s*==\s*null\s*\|\|\s*m\.away_score\s*==\s*null\)\s*return\s+false;\s*)const\s+careerTitle\s*=\s*\[.*?\]\s*as\s+const;\s*const\s+currentCareerTitle\s*=\s*careerTitle\[.*?\];\s*return\s*\('

if ($content -notmatch $badBlock) {
    Copy-Item $backup $file -Force
    throw "Bloc mal place careerTitle introuvable dans isExactPrediction. Fichier restaure."
}

$content = [regex]::Replace(
    $content,
    $badBlock,
    '${1}return (',
    1
)

Write-Host "OK : declarations retirees de isExactPrediction." -ForegroundColor Green

# ============================================================
# 2. Nettoyer toute declaration careerTitle restante
# ============================================================
$remaining = '(?s)\s*const\s+careerTitle\s*=\s*\[.*?\]\s*as\s+const;\s*const\s+currentCareerTitle\s*=\s*careerTitle\[.*?\];\s*'
$content = [regex]::Replace($content, $remaining, "`r`n", 10)

# ============================================================
# 3. Inserer les titres dans le composant, juste avant
#    le return AppShell.
# ============================================================
$careerBlock = @'
  const careerTitle = [
    "D\u00E9butant",
    "Apprenti",
    "Novice",
    "Amateur",
    "Confirm\u00E9",
    "R\u00E9gulier",
    "Comp\u00E9titeur",
    "Averti",
    "Sp\u00E9cialiste",
    "Expert",
    "Strat\u00E8ge",
    "Tacticien",
    "Ma\u00EEtre",
    "\u00C9lite",
    "Grand Ma\u00EEtre",
    "Virtuose",
    "Ma\u00EEtre Prono",
    "Champion",
    "Champion confirm\u00E9",
    "Champion d'\u00E9lite",
    "L\u00E9gendaire",
    "Ic\u00F4ne",
    "Ic\u00F4ne majeure",
    "R\u00E9f\u00E9rence",
    "Grand Strat\u00E8ge",
    "Ma\u00EEtre absolu",
    "L\u00E9gende",
    "L\u00E9gende ultime",
    "Immortel",
    "Ic\u00F4ne de la Ligue",
  ] as const;

  const currentCareerTitle =
    careerTitle[Math.max(0, Math.min(careerLevel - 1, careerTitle.length - 1))];

'@

$appShellReturn = '    return (' + "`r`n" + '      <AppShell>'

if ($content.Contains($appShellReturn)) {
    $content = $content.Replace($appShellReturn, $careerBlock + $appShellReturn)
} elseif ($content -match '(?m)^\s*return\s*\(\s*$[\r\n]+\s*<AppShell>') {
    $content = [regex]::Replace(
        $content,
        '(?m)^(\s*)return\s*\(\s*$[\r\n]+\s*<AppShell>',
        '${1}' + $careerBlock + '${1}return (' + "`r`n" + '${1}<AppShell>',
        1
    )
} else {
    Copy-Item $backup $file -Force
    throw "Return AppShell introuvable. Fichier restaure."
}

Set-Content -Path $file -Value $content -Encoding UTF8
Write-Host "OK : careerTitle place dans le scope du composant." -ForegroundColor Green

# ============================================================
# 4. Verification precise
# ============================================================
$check = Get-Content $file -Raw

$careerCount = ([regex]::Matches($check, 'const\s+careerTitle\s*=\s*\[')).Count
$currentCount = ([regex]::Matches($check, 'const\s+currentCareerTitle\s*=')).Count

if ($careerCount -ne 1 -or $currentCount -ne 1) {
    Copy-Item $backup $file -Force
    throw "Nombre de declarations incorrect : careerTitle=$careerCount / currentCareerTitle=$currentCount. Fichier restaure."
}

# Verifie que le bloc est apres la fin de isExactPrediction.
$isExactPos = $check.IndexOf('const isExactPrediction')
$titlePos = $check.IndexOf('const careerTitle')

if ($isExactPos -lt 0 -or $titlePos -lt 0 -or $titlePos -lt $isExactPos) {
    Copy-Item $backup $file -Force
    throw "careerTitle est encore avant/dans isExactPrediction. Fichier restaure."
}

if ($check -notmatch '\{currentCareerTitle\}') {
    Copy-Item $backup $file -Force
    throw "Badge currentCareerTitle introuvable. Fichier restaure."
}

Write-Host "OK : 1 seule declaration, dans le bon scope." -ForegroundColor Green

# ============================================================
# 5. BUILD
# ============================================================
Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build echoue. Fichier restaure depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " FIX CARRIERE SCOPE : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "careerTitle : 1 declaration"
Write-Host "currentCareerTitle : 1 declaration"
Write-Host "Scope composant : OK"
Write-Host "Badge : OK"
Write-Host "Build : OK"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
