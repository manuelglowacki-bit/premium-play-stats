$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

# Repartir de la sauvegarde V4 propre si elle existe.
$rankingRestore = Get-ChildItem "$rankingFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
$cardRestore = Get-ChildItem "$cardFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($rankingRestore) { Copy-Item $rankingRestore.FullName $rankingFile -Force; Write-Host "OK : Classement restaure depuis V4." -ForegroundColor Yellow }
if ($cardRestore) { Copy-Item $cardRestore.FullName $cardFile -Force; Write-Host "OK : PlayerCard restaure depuis V4." -ForegroundColor Yellow }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-career-ranking-v6-$stamp"
$cardBackup = "$cardFile.backup-career-ranking-v6-$stamp"
Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# ------------------------------------------------------------
# PLAYER CARD : données carrière
# ------------------------------------------------------------
if ($card -notmatch 'careerLevel:\s*number;') {
  $card = [regex]::Replace(
    $card,
    '(regularityPlayed:\s*number;)',
    '$1' + "`r`n  careerLevel: number;`r`n  careerTitle: string;",
    1
  )
}

# Remplace uniquement le bloc pseudo + Vous par une version avec badge carrière.
$nameRegex = '(?s)<div className="flex flex-wrap items-center gap-1\.5 sm:gap-2">\s*<span className="truncate font-display text-sm font-bold text-white sm:text-base">\{player\.pseudo \|\| "Joueur"\}</span>\s*\{isMe && \(\s*<span.*?>\s*Vous\s*</span>\s*\)\}\s*</div>'

if ($card -match $nameRegex -and $card -notmatch 'player\.careerTitle') {
  $replacement = @'
<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
  <span className="truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</span>
  <span
    title={`Niveau ${player.careerLevel} · ${player.careerTitle}`}
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-wider text-amber-300 sm:px-2 sm:text-[8px]"
  >
    <span className="text-amber-200">{player.careerLevel}</span>
    <span className="hidden text-amber-300/75 sm:inline">{player.careerTitle}</span>
    <span className="text-amber-300/60 sm:hidden">Niv.</span>
  </span>
  {isMe && (
    <span className="rounded-full bg-emerald-400 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-wider text-slate-950 sm:bg-transparent sm:px-0 sm:py-0 sm:text-[9px] sm:font-semibold sm:text-slate-400 sm:tracking-normal">
      Vous
    </span>
  )}
</div>
'@
  $card = [regex]::Replace($card, $nameRegex, $replacement.Trim(), 1)
}
elseif ($card -notmatch 'player\.careerTitle') {
  throw "Bloc pseudo PlayerCard introuvable."
}

Set-Content $cardFile $card -Encoding UTF8
Write-Host "OK : PlayerCard prepare." -ForegroundColor Green

# ------------------------------------------------------------
# IMPORT / TYPES CLASSEMENT
# ------------------------------------------------------------
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
  $ranking = [regex]::Replace(
    $ranking,
    '(import \{ matchday as currentMatchday \} from "@/lib/prono-data";)',
    '$1' + "`r`n" + 'import { calculateCareerScore } from "@/lib/careerLevel";',
    1
  )
}

if ($ranking -notmatch 'careerLevel:\s*number;') {
  $ranking = [regex]::Replace(
    $ranking,
    '(regularitySuccess:\s*number;)',
    '$1' + "`r`n  careerLevel: number;`r`n  careerTitle: string;",
    1
  )
}

if ($ranking -notmatch 'careerStatsByUser') {
  $stateRegex = '(const \[regularitySuccessByUser, setRegularitySuccessByUser\] = useState<Record<string, number>>\(\{\}\);)'
  if ($ranking -notmatch $stateRegex) { throw "State regularity introuvable." }
  $ranking = [regex]::Replace(
    $ranking,
    $stateRegex,
    '$1' + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});",
    1
  )
}

# ------------------------------------------------------------
# CARRIERE MULTI-SAISON
# ------------------------------------------------------------
if ($ranking -notmatch 'careerPredictionsData') {
  $anchorRegex = '(\s*const matchdayIds = ligue1Matchdays\.map\(\(md: any\) => String\(md\.id\)\);)'
  if ($ranking -notmatch $anchorRegex) { throw "Ancre matchdayIds introuvable." }

  $careerBlock = @'

        // Carrière : cumul de toutes les saisons, indépendamment du classement affiché.
        const [
          { data: careerPredictionsData, error: careerPredictionsError },
          { data: careerMatchesData, error: careerMatchesError },
        ] = await Promise.all([
          supabase
            .from("predictions")
            .select("user_id,match_id,points,home_prediction,away_prediction"),
          supabase
            .from("matches")
            .select("id,home_score,away_score,finished")
            .eq("finished", true),
        ]);

        if (careerPredictionsError) throw careerPredictionsError;
        if (careerMatchesError) throw careerMatchesError;

        const careerMatchById = new Map<string, any>();
        (careerMatchesData ?? []).forEach((m: any) => careerMatchById.set(String(m.id), m));

        const careerAccum: Record<string, { points: number; exactScores: number }> = {};

        (careerPredictionsData ?? []).forEach((pred: any) => {
          const uid = String(pred.user_id ?? "");
          if (!uid) return;

          const match = careerMatchById.get(String(pred.match_id));
          if (!match) return;

          if (!careerAccum[uid]) careerAccum[uid] = { points: 0, exactScores: 0 };

          careerAccum[uid].points += Number(pred.points ?? 0);

          if (
            match.home_score != null &&
            match.away_score != null &&
            pred.home_prediction != null &&
            pred.away_prediction != null &&
            Number(pred.home_prediction) === Number(match.home_score) &&
            Number(pred.away_prediction) === Number(match.away_score)
          ) {
            careerAccum[uid].exactScores += 1;
          }
        });

        if (!cancelled) setCareerStatsByUser(careerAccum);
'@
  $ranking = [regex]::Replace($ranking, $anchorRegex, '$1' + $careerBlock, 1)
  Write-Host "OK : carrière multi-saisons branchee." -ForegroundColor Green
}

# ------------------------------------------------------------
# 30 TITRES
# ------------------------------------------------------------
if ($ranking -notmatch 'const careerTitles = \[') {
  $titles = @'
  const careerTitles = [
    "Débutant", "Apprenti", "Novice", "Amateur", "Confirmé",
    "Régulier", "Compétiteur", "Averti", "Spécialiste", "Expert",
    "Stratège", "Tacticien", "Maître", "Élite", "Grand Maître",
    "Virtuose", "Maître Prono", "Champion", "Champion confirmé",
    "Champion d'élite", "Légendaire", "Icône", "Icône majeure",
    "Référence", "Grand Stratège", "Maître absolu", "Légende",
    "Légende ultime", "Immortel", "Icône de la Ligue",
  ] as const;

'@
  $ranking = [regex]::Replace($ranking, '(\s*const loading = players === null;)', "`r`n$titles" + '$1', 1)
}

# ------------------------------------------------------------
# SORTED LIST : REGEX, donc indépendant des espaces/retours ligne
# ------------------------------------------------------------
if ($ranking -notmatch 'careerLevel:\s*result\.level') {
  $sortedPattern = '(?s)(regularitySuccess:\s*regularitySuccessByUser\[p\.id\]\s*\?\?\s*0,\s*)(\}\))'

  if ($ranking -notmatch $sortedPattern) {
    # Diagnostic utile si la structure a encore changé.
    $context = [regex]::Match($ranking, 'regularitySuccess:\s*regularitySuccessByUser\[p\.id\].{0,180}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    Write-Host "CONTEXTE TROUVE :" -ForegroundColor Yellow
    if ($context.Success) { Write-Host $context.Value }
    throw "Ligne regularitySuccess trouvee, mais structure sortedList differente."
  }

  $insert = @'
$1
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);
            return {
              careerLevel: result.level,
              careerTitle: careerTitles[Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))],
            };
          })(),
        $2
'@

  $ranking = [regex]::Replace($ranking, $sortedPattern, $insert, 1)
  Write-Host "OK : niveau individuel ajoute a sortedList." -ForegroundColor Green
}

# Dependency useMemo
$ranking = $ranking.Replace(
  '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser]);',
  '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]);'
)

# toCardData
if ($ranking -notmatch 'careerLevel:\s*p\.careerLevel') {
  $ranking = [regex]::Replace(
    $ranking,
    '(regularityPlayed:\s*p\.predictionsCount,)',
    '$1' + "`r`n    careerLevel: p.careerLevel," + "`r`n    careerTitle: p.careerTitle,",
    1
  )
}

Set-Content $rankingFile $ranking -Encoding UTF8

# ------------------------------------------------------------
# VERIFICATION
# ------------------------------------------------------------
$cardCheck = Get-Content $cardFile -Raw
$rankingCheck = Get-Content $rankingFile -Raw

$tests = @(
  @("PlayerCard careerLevel", $cardCheck -match 'careerLevel:\s*number;'),
  @("PlayerCard careerTitle", $cardCheck -match 'careerTitle:\s*string;'),
  @("Badge carrière", $cardCheck -match 'player\.careerTitle'),
  @("Import moteur", $rankingCheck -match 'calculateCareerScore'),
  @("Cumul multi-saisons", $rankingCheck -match 'careerPredictionsData'),
  @("30 titres", $rankingCheck -match 'const careerTitles = \['),
  @("Niveau sortedList", $rankingCheck -match 'careerLevel:\s*result\.level'),
  @("Titre sortedList", $rankingCheck -match 'careerTitle:\s*careerTitles'),
  @("Transmission card", $rankingCheck -match 'careerLevel:\s*p\.careerLevel')
)

foreach ($test in $tests) {
  if ($test[1]) { Write-Host "OK : $($test[0])" -ForegroundColor Green }
  else {
    Copy-Item $rankingBackup $rankingFile -Force
    Copy-Item $cardBackup $cardFile -Force
    throw "Verification echouee : $($test[0]). Fichiers restaures."
  }
}

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  Copy-Item $rankingBackup $rankingFile -Force
  Copy-Item $cardBackup $cardFile -Force
  throw "Build echoue. Fichiers restaures."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NIVEAUX CLASSEMENT V6 : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Niveau individuel : OUI"
Write-Host "Cumul multi-saisons : OUI"
Write-Host "30 niveaux : OUI"
Write-Host "Badge a cote du pseudo : OUI"
Write-Host "Points carriere affiches : NON"
Write-Host "Progression affichee : NON"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
