$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-career-robuste-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# 1. Ajouter matchday_id dans la requete matches.
if ($content -notmatch 'id,matchday_id,matchday_code') {
    $content = $content -replace `
        '\.select\("id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score"\)', `
        '.select("id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'
}
if ($content -notmatch 'id,matchday_id,matchday_code') {
    Copy-Item $backup $file -Force
    throw "Impossible d ajouter matchday_id a la requete matches. Fichier restaure."
}
Write-Host "OK : matchday_id present." -ForegroundColor Green

# 2. Ajouter matchdays dans le Promise.all sans dependre du format exact.
if ($content -notmatch 'data:\s*matchdays,\s*error:\s*matchdaysError') {
    $destructurePattern = '(?s)(const\s*\[\s*.*?\{[^}]*data:\s*pot,\s*error:\s*paymentsError[^}]*\},)(\s*\]\s*=\s*await\s+Promise\.all\(\[)'
    if ($content -notmatch $destructurePattern) {
        Copy-Item $backup $file -Force
        throw "Bloc destructuring Promise.all introuvable. Fichier restaure."
    }

    $replacement = '$1' + "`r`n" +
        '          { data: matchdays, error: matchdaysError },' + '$2'

    $content = [regex]::Replace($content, $destructurePattern, $replacement, 1)
}
Write-Host "OK : retour matchdays present." -ForegroundColor Green

# 3. Ajouter la requete matchdays juste avant la fermeture de Promise.all.
if ($content -notmatch '\.from\("matchdays"\)\s*[\r\n]+\s*\.select\("id,season_id,season"\)') {
    $potPattern = '(?s)(supabase\s*\.from\("pot_public"\)\s*\.select\("total_amount"\)\s*\.maybeSingle\(\),)(\s*\]\s*\);)'
    if ($content -notmatch $potPattern) {
        Copy-Item $backup $file -Force
        throw "Bloc pot_public/Promise.all introuvable. Fichier restaure."
    }

    $replacement = '$1' + "`r`n" +
        '          supabase' + "`r`n" +
        '            .from("matchdays")' + "`r`n" +
        '            .select("id,season_id,season"),' + '$2'

    $content = [regex]::Replace($content, $potPattern, $replacement, 1)
}
Write-Host "OK : requete matchdays presente." -ForegroundColor Green

# 4. Remplacer le bloc careerByUser actuel.
$careerPattern = '(?s)\s*const careerByUser = new Map<string, \{ points: number; exactScores: number \}>\(\);\s*\(predictions \|\| \[\]\)\.forEach\(\(p: any\) => \{.*?setCareerLevel\(career\.level\);\s*\}\s*'

$careerReplacement = @'
        // -------- Carriere multi-saisons --------
        // prediction -> match -> matchday -> season.
        // Toutes les saisons sont cumulees ; aucun reset annuel.
        const seasonByMatchdayId = new Map<string, string>();

        (matchdays || []).forEach((md: any) => {
          if (!md?.id) return;
          seasonByMatchdayId.set(
            String(md.id),
            String(md.season_id || md.season || "unknown"),
          );
        });

        const careerByUser = new Map<string, { points: number; exactScores: number }>();

        (predictions || []).forEach((p: any) => {
          const uid = p.user_id;
          if (!uid) return;

          const match = matchById.get(String(p.match_id));
          if (!match || !match.matchday_id) return;

          const seasonKey = seasonByMatchdayId.get(String(match.matchday_id));
          if (!seasonKey) return;

          const current = careerByUser.get(uid) || {
            points: 0,
            exactScores: 0,
          };

          current.points += Number(p.points || 0);
          if (isExactPrediction(p)) current.exactScores += 1;

          careerByUser.set(uid, current);
        });

        if (user?.id) {
          const mineCareer = careerByUser.get(user.id) || {
            points: 0,
            exactScores: 0,
          };

          const career = calculateCareerScore(mineCareer);
          setCareerLevel(career.level);
        }

'@

$updated = [regex]::Replace($content, $careerPattern, $careerReplacement, 1)

if ($updated -eq $content) {
    Copy-Item $backup $file -Force
    throw "Bloc careerByUser introuvable. Fichier restaure."
}

Set-Content -Path $file -Value $updated -Encoding UTF8

Write-Host "OK : carriere multi-saison branchee." -ForegroundColor Green

# 5. Verification.
$check = Get-Content $file -Raw
@(
    'id,matchday_id,matchday_code',
    'data: matchdays, error: matchdaysError',
    '.from("matchdays")',
    'seasonByMatchdayId',
    'calculateCareerScore(mineCareer)',
    'setCareerLevel(career.level)'
) | ForEach-Object {
    if ($check.Contains($_)) {
        Write-Host "OK : $_" -ForegroundColor Green
    } else {
        Copy-Item $backup $file -Force
        throw "Verification echouee : $_. Fichier restaure."
    }
}

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $file -Force
    throw "Build echoue. Fichier restaure depuis la sauvegarde."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " CARRIERE MULTI-SAISON : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Points + exacts x2 : OUI"
Write-Host "Cumul multi-saisons : OUI"
Write-Host "Reset annuel : NON"
Write-Host "30 niveaux : OUI"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
