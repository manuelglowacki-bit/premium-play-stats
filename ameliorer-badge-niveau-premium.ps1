$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-badge-niveau-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# Ajoute les titres de carrière juste avant le return de la page.
if ($content -notmatch 'const careerTitle = \[') {
    $anchor = '  return ('
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

  const currentCareerTitle = careerTitle[Math.max(0, Math.min(careerLevel - 1, careerTitle.length - 1))];

'@
    if (!$content.Contains($anchor)) {
        Copy-Item $backup $file -Force
        throw "Point d'insertion introuvable. Fichier restauré."
    }
    $content = $content.Replace($anchor, $titles + $anchor)
    Write-Host "OK : titres des 30 niveaux ajoutés." -ForegroundColor Green
}

# Remplace uniquement le petit badge actuel.
$old = @'
                  <span className="inline-flex items-center gap-1 mb-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold tracking-widest">
                    <Star size={10} className="fill-amber-400" /> NIVEAU {careerLevel}
                  </span>
'@

$new = @'
                  <div
                    className="group relative mb-2.5 inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/35 bg-[#060b16]/85 px-3.5 py-2.5 shadow-[0_0_24px_rgba(245,158,11,0.12)] backdrop-blur-md transition-all duration-300 hover:border-amber-300/55 hover:shadow-[0_0_30px_rgba(245,158,11,0.18)]"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/[0.10] via-transparent to-amber-200/[0.05]"
                    />
                    <div
                      className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/20 via-amber-500/10 to-transparent shadow-[inset_0_0_16px_rgba(245,158,11,0.12)]"
                    >
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

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    Write-Host "OK : badge Niveau remplacé par le nouveau bloc premium." -ForegroundColor Green
} elseif ($content -match 'currentCareerTitle') {
    Write-Host "OK : nouveau badge déjà présent." -ForegroundColor DarkGray
} else {
    Copy-Item $backup $file -Force
    throw "Ancien badge Niveau introuvable. Fichier restauré."
}

# Star n'est plus utilisé par ce bloc. On le laisse si utilisé ailleurs ; sinon aucune action nécessaire.

Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "=== VERIFICATION ===" -ForegroundColor Cyan

$check = Get-Content $file -Raw
@(
    'const careerTitle = [',
    'currentCareerTitle',
    'shadow-[0_0_24px_rgba(245,158,11,0.12)]',
    '{careerLevel}'
) | ForEach-Object {
    if ($check.Contains($_)) {
        Write-Host "OK : $_" -ForegroundColor Green
    } else {
        Copy-Item $backup $file -Force
        throw "Verification échouée : $_. Fichier restauré."
    }
}

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build échoué. Fichier restauré depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " BADGE NIVEAU PREMIUM : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "30 titres : OUI"
Write-Host "Points affichés : NON"
Write-Host "Étoiles affichées : NON"
Write-Host "Barre de progression : NON"
Write-Host "Seuils affichés : NON"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
