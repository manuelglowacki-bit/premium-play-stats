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

# Ajoute matchday_id a la requete matches si elle existe.
$oldSelect = '.select("id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'
$newSelect = '.select("id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'

if ($content.Contains($oldSelect)) {
    $content = $content.Replace($oldSelect, $newSelect)
} elseif ($content -notmatch 'matchday_id') {
    Copy-Item $backup $file -Force
    throw "La requete matches n'a pas ete trouvee. Fichier restaure."
}

# Ajoute la requete matchdays/season si elle n'est pas deja presente.
if ($content -notmatch '\.from\("matchdays"\)') {
    $promiseMarker = '        ] = await Promise.all(['
    if (!$content.Contains($promiseMarker)) {
        Copy-Item $backup $file -Force
        throw "Promise.all introuvable. Fichier restaure."
    }

    $insert = @'
          supabase
            .from("matchdays")
            .select("id,season_id,season"),
'@

    $content = $content.Replace(
        $promiseMarker,
        $insert + "`r`n" + $promiseMarker
    )
}

# Ajoute la variable matchdays au destructuring si elle n'existe pas.
if ($content -notmatch 'data:\s*matchdays,\s*error:\s*matchdaysError') {
    $pattern = '(?m)^(\s*)\{\s*data:\s*pot,\s*error:\s*paymentsError\s*\},\s*$'
    $replacement = '$1{ data: pot, error: paymentsError },' + "`r`n" + '$1{ data: matchdays, error: matchdaysError },'
    $content = [regex]::Replace($content, $pattern, $replacement, 1)
}

# Remplace le calcul actuel de careerByUser.
$patternCareer = '(?s)\s*const careerByUser = new Map<string, \{ points: number; exactScores: number \}>\(\);\s*\(predictions \|\| \[\]\)\.forEach\(\(p: any\) => \{.*?setCareerLevel\(career\.level\);\s*\}'

$replacementCareer = @'
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

          // prediction -> match -> matchday -> season
          // Toutes les saisons sont cumulees.
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
        }
'@

$updated = [regex]::Replace($content, $patternCareer, $replacementCareer, 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "Bloc careerByUser introuvable. Fichier restaure."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host ""
Write-Host "OK : calcul carriere multi-saison installe." -ForegroundColor Green
Write-Host "OK : points + scores exacts x2." -ForegroundColor Green
Write-Host "OK : lien match -> matchday -> season." -ForegroundColor Green

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
Write-Host "Reset annuel : NON"
Write-Host "Build : OK"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
