$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-premium-career-$stamp"
$cardBackup = "$cardFile.backup-premium-career-$stamp"

Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor Green
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor Green

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# ============================================================
# 1. PLAYER CARD : POINTS EN VEDETTE / REGULARITE DISCRETE
# ============================================================

# Points : plus grand et plus lumineux.
$pointsOld = @'
className="block font-display text-lg font-black leading-none text-white sm:text-3xl"
'@
$pointsNew = @'
className="block font-display text-xl font-black leading-none text-white drop-shadow-[0_0_14px_rgba(52,211,153,0.28)] sm:text-4xl"
'@

if ($card.Contains($pointsOld)) {
    $card = $card.Replace($pointsOld, $pointsNew)
    Write-Host "OK : points renforces visuellement." -ForegroundColor Green
}

# Regularite : beaucoup plus discrète.
$regOld = @'
<div className="w-11 text-center sm:w-16">
          <span className="block font-display text-xs font-bold leading-none text-teal-300 sm:text-base">
            {player.regularitySuccess}/{player.regularityPlayed}
          </span>
          <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-widest text-teal-600/80 sm:mt-1 sm:text-[8px]">
            {regularityPct !== null ? `RÃ©g. ${regularityPct}%` : "RÃ©g."}
          </span>
        </div>
'@

$regNew = @'
<div className="w-11 text-center opacity-55 sm:w-16">
          <span className="block font-mono text-[10px] font-semibold leading-none text-slate-400 sm:text-xs">
            {player.regularitySuccess}/{player.regularityPlayed}
          </span>
          <span className="mt-0.5 block font-mono text-[6px] uppercase tracking-widest text-slate-600 sm:mt-1 sm:text-[7px]">
            {regularityPct !== null ? `RÃ©g. ${regularityPct}%` : "RÃ©g."}
          </span>
        </div>
'@

if ($card.Contains($regOld)) {
    $card = $card.Replace($regOld, $regNew)
    Write-Host "OK : regularite rendue secondaire." -ForegroundColor Green
}

Set-Content -Path $cardFile -Value $card -Encoding UTF8

# ============================================================
# 2. CLASSEMENT : TITRE + BARRE DE COLONNES AVANT #4
# ============================================================

$headerAnchor = @'
            {others.length > 0 && (
              <section className="space-y-3 sm:space-y-4">
'@

$headerReplacement = @'
            {others.length > 0 && (
              <section className="space-y-3 sm:space-y-4">
                <div className="hidden grid-cols-[48px_minmax(0,1fr)_70px_70px_82px_48px] items-center gap-3 px-4 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:grid">
                  <span>#</span>
                  <span>Joueur</span>
                  <span className="text-center text-emerald-400/70">Pts</span>
                  <span className="text-center">Exacts</span>
                  <span className="text-center">Régularité</span>
                  <span className="text-right">Évol.</span>
                </div>
'@

if ($ranking.Contains($headerAnchor)) {
    $ranking = $ranking.Replace($headerAnchor, $headerReplacement)
    Write-Host "OK : en-tetes de colonnes ajoutes." -ForegroundColor Green
} elseif ($ranking -notmatch 'text-emerald-400/70">Pts') {
    throw "Bloc de liste #4+ introuvable."
}

# Ferme la section sans toucher au rendu des PlayerCard.
# On ajoute seulement le header au-dessus.

# ============================================================
# 3. BADGE CARRIERE SUR LE PODIUM + LISTE
# ============================================================

$badgeOld = @'
  if (bestExactScorePlayerId === p.id) badges.push({ kind: "exactKing", label: "Roi exact" });
  return badges;
'@

$badgeNew = @'
  if (bestExactScorePlayerId === p.id) badges.push({ kind: "exactKing", label: "Roi exact" });

  // Niveau de carrière : visible sur le podium et dans la liste.
  // Le niveau reste une information visuelle, sans afficher les points carrière.
  if (p.careerLevel > 0) {
    badges.push({
      kind: "exactKing",
      label: `${p.careerLevel} · ${p.careerTitle}`,
    });
  }

  return badges;
'@

if ($ranking.Contains($badgeOld)) {
    $ranking = $ranking.Replace($badgeOld, $badgeNew)
    Write-Host "OK : badge carrière ajoute au podium/liste." -ForegroundColor Green
} elseif ($ranking -notmatch 'label: `\$\{p\.careerLevel\}') {
    throw "Fonction cardBadges introuvable."
}

# ============================================================
# 4. BARRE D'INFOS : POINTS DU LEADER PLUS IMPORTANT
# ============================================================

$statsOld = @'
                { icon: Target, label: "Scores exacts", value: String(totalExactScores) },
'@

$statsNew = @'
                { icon: Target, label: "Scores exacts", value: String(totalExactScores) },
'@

# Aucun changement fonctionnel ici : on garde les mêmes données.
# Le point important est que les cartes joueurs mettent les points en avant.

# ============================================================
# 5. TITRE DE SECTION AVANT LA LISTE
# ============================================================

$listTitleAnchor = @'
                <div className="hidden grid-cols-[48px_minmax(0,1fr)_70px_70px_82px_48px] items-center gap-3 px-4 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:grid">
                  <span>#</span>
                  <span>Joueur</span>
                  <span className="text-center text-emerald-400/70">Pts</span>
                  <span className="text-center">Exacts</span>
                  <span className="text-center">Régularité</span>
                  <span className="text-right">Évol.</span>
                </div>
'@

# ============================================================
# 6. VERIFICATION
# ============================================================

Set-Content -Path $rankingFile -Value $ranking -Encoding UTF8

$rankingCheck = Get-Content $rankingFile -Raw
$cardCheck = Get-Content $cardFile -Raw

$checks = @(
    @("PlayerCard points renforces", $cardCheck -match 'sm:text-4xl'),
    @("PlayerCard regularite secondaire", $cardCheck -match 'opacity-55'),
    @("En-tetes Pts/Exacts/Regularite", $rankingCheck -match 'text-emerald-400/70">Pts'),
    @("Badge niveau carriere", $rankingCheck -match 'p\.careerLevel.*p\.careerTitle'),
    @("Moteur carriere present", $rankingCheck -match 'calculateCareerScore'),
    @("Niveau individuel", $rankingCheck -match 'careerLevel:\s*result\.level'),
    @("Cumul multi-saisons", $rankingCheck -match 'careerPredictionsData')
)

foreach ($check in $checks) {
    if ($check[1]) {
        Write-Host "OK : $($check[0])" -ForegroundColor Green
    } else {
        Copy-Item $rankingBackup $rankingFile -Force
        Copy-Item $cardBackup $cardFile -Force
        throw "Verification echouee : $($check[0]). Fichiers restaures."
    }
}

# ============================================================
# 7. BUILD
# ============================================================

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $rankingBackup $rankingFile -Force
    Copy-Item $cardBackup $cardFile -Force
    throw "Build echoue. Les deux fichiers ont ete restaures."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " CLASSEMENT PREMIUM CARRIERE : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Niveau sur podium : OUI"
Write-Host "Niveau dans liste #4+ : OUI"
Write-Host "Points mis en avant : OUI"
Write-Host "Regularite secondaire : OUI"
Write-Host "Cumul multi-saisons : CONSERVE"
Write-Host "30 niveaux : CONSERVE"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
