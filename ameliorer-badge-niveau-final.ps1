$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-badge-niveau-final-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# 1. Ajoute les 30 titres si absents.
if ($content -notmatch 'const careerTitle = \[') {
    $titles = @'
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
    $returnIndex = $content.IndexOf("  return (")
    if ($returnIndex -lt 0) {
        Copy-Item $backup $file -Force
        throw "return de la page introuvable. Fichier restaure."
    }
    $content = $content.Insert($returnIndex, $titles)
    Write-Host "OK : 30 titres ajoutes." -ForegroundColor Green
}

# 2. Remplace exactement l'ancien badge.
$oldPattern = '(?s)<span className="inline-flex items-center gap-1 mb-1\.5 px-2\.5 py-0\.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-\[10px\] font-bold tracking-widest">\s*<Star size=\{10\} className="fill-amber-400" /> NIVEAU \{careerLevel\}\s*</span>'

$newBadge = @'
<div className="group relative mb-2.5 inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/35 bg-[#060b16]/85 px-3.5 py-2.5 shadow-[0_0_24px_rgba(245,158,11,0.12)] backdrop-blur-md transition-all duration-300 hover:border-amber-300/55 hover:shadow-[0_0_30px_rgba(245,158,11,0.18)]">
  <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/[0.10] via-transparent to-amber-200/[0.05]" />
  <div className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/20 via-amber-500/10 to-transparent shadow-[inset_0_0_16px_rgba(245,158,11,0.12)]">
    <span className="font-display text-lg font-black leading-none text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]">
      {careerLevel}
    </span>
  </div>
  <div className="relative min-w-0 pr-1">
    <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-amber-400/80">
      Niveau
    </span>
    <span className="block truncate font-display text-sm font-extrabold uppercase tracking-wide text-white sm:text-base">
      {currentCareerTitle}
    </span>
  </div>
</div>
'@

$updated = [regex]::Replace($content, $oldPattern, $newBadge.Trim(), 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "Ancien badge exact introuvable. Fichier restaure."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host "OK : ancien badge remplace." -ForegroundColor Green

# 3. Verification.
$check = Get-Content $file -Raw
if ($check -notmatch 'currentCareerTitle') {
    Copy-Item $backup $file -Force
    throw "currentCareerTitle absent. Fichier restaure."
}
if ($check -notmatch 'shadow-\[0_0_24px_rgba\(245,158,11,0\.12\)\]') {
    Copy-Item $backup $file -Force
    throw "Nouveau bloc premium absent. Fichier restaure."
}
if ($check -match '<Star size=\{10\} className="fill-amber-400" /> NIVEAU \{careerLevel\}') {
    Copy-Item $backup $file -Force
    throw "Ancien badge encore present. Fichier restaure."
}

Write-Host "OK : verification du badge premium." -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build echoue. Fichier restaure depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " BADGE NIVEAU PREMIUM : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Niveau + titre : OUI"
Write-Host "Points : NON"
Write-Host "Etoiles : NON"
Write-Host "Progression : NON"
Write-Host "Seuils : NON"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
