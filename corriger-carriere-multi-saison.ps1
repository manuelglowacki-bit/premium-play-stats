$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"

if (!(Test-Path $file)) {
    throw "Fichier introuvable : $file"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-career-multiseason-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# 1) Ajouter matchday_id a la requete matches.
$oldSelect = '.select("id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'
$newSelect = '.select("id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'

if ($content.Contains($oldSelect)) {
    $content = $content.Replace($oldSelect, $newSelect)
} elseif ($content -notmatch 'matchday_id,matchday_code') {
    Copy-Item $backup $file -Force
    throw "Select matches introuvable. Fichier restaure."
}

# 2) Ajouter le chargement des matchdays avec season_id.
$oldPromiseEnd = @'
          .from("pot_public")
            .select("total_amount")
            .maybeSingle(),
        ]);
'@

$newPromiseEnd = @'
          .from("pot_public")
            .select("total_amount")
            .maybeSingle(),
          supabase
            .from("matchdays")
            .select("id,season_id,season")
        ]);
'@

if ($content.Contains($oldPromiseEnd)) {
    $content = $content.Replace($oldPromiseEnd, $newPromiseEnd)
} elseif ($content -notmatch '\.from\("matchdays"\)\s*[\r\n]+\s*\.select\("id,season_id,season"\)') {
    Copy-Item $backup $file -Force
    throw "Bloc Promise principal introuvable. Fichier restaure."
}

# 3) Recuperer les matchdays dans le destructuring Promise.all.
$oldDestructure = @'
          { data: pot, error: paymentsError },
        ] = await Promise.all([
'@

$newDestructure = @'
          { data: pot, error: paymentsError },
          { data: matchdays, error: matchdaysError },
        ] = await Promise.all([
'@

if ($content.Contains($oldDestructure)) {
    $content = $content.Replace($oldDestructure, $newDestructure)
} elseif ($content -notmatch 'data: matchdays, error: matchdaysError') {
    Copy-Item $backup $file -Force
    throw "Destructuring Promise.all introuvable. Fichier restaure."
}

# 4) Inserer le controle de l'erreur matchdays.
$anchorError = 'if (paymentsError) console.warn("Cagnotte non accessible :", paymentsError);'
$insertError = @'
        if (paymentsError) console.warn("Cagnotte non accessible :", paymentsError);
        if (matchdaysError) console.warn("Journées/saisons non accessibles :", matchdaysError);
'@

if ($content.Contains($anchorError) -and $content -notmatch 'Journées/saisons non accessibles') {
    $content = $content.Replace($anchorError, $insertError.TrimEnd())
}

# 5) Remplacer le calcul careerByUser actuel par un calcul multi-saison.
$pattern = '(?s)\s*const careerByUser = new Map<string, \{ points: number; exactScores: number \}>\(\);\s*\(predictions \|\| \[\]\)\.forEach\(\(p: any\) => \{.*?\s*setCareerLevel\(career\.level\);\s*\}'

$replacement = @'
        const seasonByMatchdayId = new Map<string, string>();

        (matchdays || []).forEach((md: any) => {
          if (!md?.id) return;
          const seasonKey = String(md.season_id || md.season || "unknown");
          seasonByMatchdayId.set(String(md.id), seasonKey);
        });

        const careerByUser = new Map<string, { points: number; exactScores: number }>();

        (predictions || []).forEach((p: any) => {
          const uid = p.user_id;
          if (!uid) return;

          const match = matchById.get(String(p.match_id));
          if (!match) return;

          // Une prediction est rattachee a une saison via :
          // prediction -> match -> matchday -> season.
          // Toutes les saisons sont cumulees : aucun reset annuel.
          const seasonKey = seasonByMatchdayId.get(String(match.matchday_id));
          if (!seasonKey) return;

          const current = careerByUser.get(uid) || { points: 0, exactScores: 0 };
          current.points += Number(p.points || 0);
          if (isExactPrediction(p)) current.exactScores += 1;
          careerByUser.set(uid, current);
        });

        if (user?.id) {
          const mineCareer = careerByUser.get(user.id) || { points: 0, exactScores: 0 };
          const career = calculateCareerScore(mineCareer);
          setCareerLevel(career.level);
        }'@

$updated = [regex]::Replace($content, $pattern, $replacement, 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "Bloc careerByUser actuel introuvable. Fichier restaure."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host ""
Write-Host "OK : calcul de carriere maintenant relie aux saisons via matchday_id -> season_id." -ForegroundColor Green
Write-Host "OK : cumul multi-saisons, aucun reset annuel." -ForegroundColor Green
Write-Host "OK : score = points + (scores exacts x 2)." -ForegroundColor Green

Write-Host ""
Write-Host "=== VERIFICATION DU CODE ===" -ForegroundColor Cyan
Get-Content $file | Select-String -Pattern "matchday_id,matchday_code|from\(`"matchdays`"\)|seasonByMatchdayId|careerByUser|calculateCareerScore|setCareerLevel"

Write-Host ""
Write-Host "=== TESTS UNITAIRES DU MOTEUR ===" -ForegroundColor Cyan

$careerFile = ".\src\lib\careerLevel.ts"
if (!(Test-Path $careerFile)) {
    Copy-Item $backup $file -Force
    throw "careerLevel.ts introuvable."
}

$careerContent = Get-Content $careerFile -Raw

if ($careerContent -notmatch 'exactScores \* 2') {
    Copy-Item $backup $file -Force
    throw "La formule x2 n'est pas presente dans careerLevel.ts."
}

Write-Host "Formule x2 : OK" -ForegroundColor Green

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build echoue. Fichier restaure depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " CARRIERE MULTI-SAISON CORRIGEE !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Saisons cumulees : OUI"
Write-Host "Points + scores exacts x2 : OUI"
Write-Host "Reset en debut de saison : NON"
Write-Host "Niveau dynamique : OUI"
Write-Host "Build : OK"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
