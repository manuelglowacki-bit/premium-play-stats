$ErrorActionPreference = "Stop"

$file = ".\src\routes\index.tsx"
if (!(Test-Path $file)) { throw "Fichier introuvable : $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-career-final-$stamp"
Copy-Item $file $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Green

$content = Get-Content $file -Raw

# ============================================================
# 1. MATCHES : ajouter matchday_id
# ============================================================
$oldMatches = '.select("id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'
$newMatches = '.select("id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score")'

if ($content.Contains($oldMatches)) {
    $content = $content.Replace($oldMatches, $newMatches)
    Write-Host "OK : matchday_id ajoute aux matchs." -ForegroundColor Green
} elseif ($content -match 'select\("id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score"\)') {
    Write-Host "OK : matchday_id deja present." -ForegroundColor DarkGray
} else {
    Copy-Item $backup $file -Force
    throw "Select matches introuvable. Fichier restaure."
}

# ============================================================
# 2. DESTRUCTURING : ajouter matchdays
# ============================================================
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
    Write-Host "OK : retour matchdays ajoute." -ForegroundColor Green
} elseif ($content -match 'data:\s*matchdays,\s*error:\s*matchdaysError') {
    Write-Host "OK : retour matchdays deja present." -ForegroundColor DarkGray
} else {
    Copy-Item $backup $file -Force
    throw "Destructuring Promise.all introuvable. Fichier restaure."
}

# ============================================================
# 3. PROMISE.ALL : ajouter la requete matchdays
# ============================================================
$oldPot = @'
          supabase
            .from("pot_public")
            .select("total_amount")
            .maybeSingle(),
        ]);
'@

$newPot = @'
          supabase
            .from("pot_public")
            .select("total_amount")
            .maybeSingle(),
          supabase
            .from("matchdays")
            .select("id,season_id,season"),
        ]);
'@

if ($content.Contains($oldPot)) {
    $content = $content.Replace($oldPot, $newPot)
    Write-Host "OK : requete matchdays ajoutee." -ForegroundColor Green
} elseif ($content -match '\.from\("matchdays"\)\s*[\r\n]+\s*\.select\("id,season_id,season"\)') {
    Write-Host "OK : requete matchdays deja presente." -ForegroundColor DarkGray
} else {
    Copy-Item $backup $file -Force
    throw "Bloc pot_public/Promise.all introuvable. Fichier restaure."
}

# ============================================================
# 4. Remplacer UNIQUEMENT le calcul de carriere actuel
# ============================================================
$careerPattern = '(?s)\s*const careerByUser = new Map<string, \{ points: number; exactScores: number \}>\(\);\s*\(predictions \|\| \[\]\)\.forEach\(\(p: any\) => \{.*?\s*setCareerLevel\(career\.level\);\s*\}\s*'

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

          // Verifie que le match appartient bien a une saison.
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

$content = $updated
Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "OK : moteur carriere branche sur toutes les saisons." -ForegroundColor Green
Write-Host "Formule : points cumules + (scores exacts cumules x 2)" -ForegroundColor Green

# ============================================================
# 5. Verification textuelle
# ============================================================
Write-Host ""
Write-Host "=== VERIFICATION ===" -ForegroundColor Cyan

$check = Get-Content $file -Raw

$checks = @(
    'matchday_id,matchday_code',
    'data: matchdays, error: matchdaysError',
    '.from("matchdays")',
    'seasonByMatchdayId',
    'calculateCareerScore(mineCareer)',
    'setCareerLevel(career.level)'
)

foreach ($needle in $checks) {
    if ($check.Contains($needle)) {
        Write-Host "OK : $needle" -ForegroundColor Green
    } else {
        Copy-Item $backup $file -Force
        throw "Verification echouee : $needle. Fichier restaure."
    }
}

# ============================================================
# 6. BUILD
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
Write-Host " CARRIERE MULTI-SAISON : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "30 niveaux : OUI"
Write-Host "Points + exacts x2 : OUI"
Write-Host "Cumul multi-saisons : OUI"
Write-Host "Reset annuel : NON"
Write-Host "Seuils visibles : NON"
Write-Host "Barre de progression : NON"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
