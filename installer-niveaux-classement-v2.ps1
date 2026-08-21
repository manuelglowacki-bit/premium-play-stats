$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-career-ranking-$stamp"
$cardBackup = "$cardFile.backup-career-ranking-$stamp"

Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor Green
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor Green

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# ============================================================
# 1. PlayerCard : ajouter niveau + titre aux donnees
# ============================================================
if ($card -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularityPlayed: number;'
    if (!$card.Contains($anchor)) {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "Ancre PlayerCardData introuvable."
    }

    $card = $card.Replace(
        $anchor,
        $anchor + "`r`n  /** Niveau de carriere multi-saisons du joueur. */`r`n  careerLevel: number;`r`n  /** Titre du niveau de carriere. */`r`n  careerTitle: string;"
    )
    Write-Host "OK : careerLevel/careerTitle ajoutes a PlayerCardData." -ForegroundColor Green
}

# Remplacer le nom seul par nom + mini badge.
$oldName = '<span className="truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</span>'
$newName = @'
<div className="flex min-w-0 flex-wrap items-center gap-1.5">
  <span className="truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</span>
  <span
    title={`Niveau ${player.careerLevel} · ${player.careerTitle}`}
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-[7px] font-black uppercase tracking-wider text-amber-300 sm:px-2 sm:text-[8px]"
  >
    <span className="text-amber-200">{player.careerLevel}</span>
    <span className="hidden text-amber-300/75 sm:inline">{player.careerTitle}</span>
    <span className="text-amber-300/60 sm:hidden">Niv.</span>
  </span>
</div>
'@

if ($card.Contains($oldName)) {
    $card = $card.Replace($oldName, $newName.Trim())
    Write-Host "OK : mini badge niveau ajoute a cote du pseudo." -ForegroundColor Green
} elseif ($card -notmatch 'player\.careerTitle') {
    Copy-Item $cardBackup $cardFile -Force
    Copy-Item $rankingBackup $rankingFile -Force
    throw "Bloc pseudo PlayerCard introuvable."
} else {
    Write-Host "OK : badge niveau deja present dans PlayerCard." -ForegroundColor Yellow
}

Set-Content -Path $cardFile -Value $card -Encoding UTF8

# ============================================================
# 2. Classement : importer le moteur de carriere
# ============================================================
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
    $anchor = 'import { matchday as currentMatchday } from "@/lib/prono-data";'
    if (!$ranking.Contains($anchor)) {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "Import prono-data introuvable."
    }

    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n" + 'import { calculateCareerScore } from "@/lib/careerLevel";'
    )
    Write-Host "OK : moteur carriere importe." -ForegroundColor Green
}

# ============================================================
# 3. RankedPlayer : stocker niveau + titre
# ============================================================
if ($ranking -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularitySuccess: number;'
    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;"
    )
    Write-Host "OK : RankedPlayer enrichi." -ForegroundColor Green
}

# ============================================================
# 4. State carriere multi-saisons
# ============================================================
if ($ranking -notmatch 'careerStatsByUser') {
    $anchor = '  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});'
    if (!$ranking.Contains($anchor)) {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "State regularitySuccessByUser introuvable."
    }

    $state = $anchor + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});"
    $ranking = $ranking.Replace($anchor, $state)
    Write-Host "OK : state carriere ajoute." -ForegroundColor Green
}

# ============================================================
# 5. Charger les donnees de carriere sur TOUTES les saisons.
#    Les points viennent de predictions.points et les scores exacts
#    sont recalcules uniquement sur des matchs termines.
# ============================================================
if ($ranking -notmatch 'careerPredictionsData') {
    $anchor = '        const matchdayIds = ligue1Matchdays.map((md: any) => String(md.id));'

    $careerBlock = @'
        // ============================================================
        // CARRIERE MULTI-SAISONS
        // On ne filtre PAS sur la saison courante ici.
        // Les points deja calcules dans predictions.points sont cumules
        // sur toutes les saisons. Les scores exacts sont verifies sur
        // les matchs termines.
        // ============================================================
        const [
          { data: careerPredictionsData, error: careerPredictionsError },
          { data: careerMatchesData, error: careerMatchesError },
        ] = await Promise.all([
          supabase
            .from("predictions")
            .select("user_id, match_id, points, home_prediction, away_prediction"),
          supabase
            .from("matches")
            .select("id, home_score, away_score, finished")
            .eq("finished", true),
        ]);

        if (careerPredictionsError) throw careerPredictionsError;
        if (careerMatchesError) throw careerMatchesError;

        const careerMatchById = new Map<string, any>();
        (careerMatchesData ?? []).forEach((m: any) => {
          careerMatchById.set(String(m.id), m);
        });

        const careerAccum: Record<string, { points: number; exactScores: number }> = {};

        (careerPredictionsData ?? []).forEach((pred: any) => {
          const uid = String(pred.user_id ?? "");
          if (!uid) return;

          const match = careerMatchById.get(String(pred.match_id));
          if (!match || !match.finished) return;

          if (!careerAccum[uid]) careerAccum[uid] = { points: 0, exactScores: 0 };

          careerAccum[uid].points += Number(pred.points ?? 0);

          const exact =
            match.home_score != null &&
            match.away_score != null &&
            Number(pred.home_prediction) === Number(match.home_score) &&
            Number(pred.away_prediction) === Number(match.away_score);

          if (exact) careerAccum[uid].exactScores += 1;
        });

        setCareerStatsByUser(careerAccum);

'@

    if (!$ranking.Contains($anchor)) {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "Ancre matchdayIds introuvable."
    }

    $ranking = $ranking.Replace($anchor, $anchor + "`r`n" + $careerBlock)
    Write-Host "OK : cumul carriere multi-saisons branche." -ForegroundColor Green
}

# ============================================================
# 6. Ajouter les titres identiques a l'Accueil.
# ============================================================
if ($ranking -notmatch 'const careerTitles = \[') {
    $anchor = '  const loading = players === null;'

    $titles = @'
  const careerTitles = [
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

'@

    $ranking = $ranking.Replace($anchor, $titles + "`r`n" + $anchor)
    Write-Host "OK : 30 titres disponibles dans le Classement." -ForegroundColor Green
}

# ============================================================
# 7. Enrichir sortedList avec le niveau individuel.
# ============================================================
$oldMap = @'
          points: pointsByUser[p.id] ?? 0,
          exactScores: exactScoresByUser[p.id] ?? 0,
          predictionsCount: predictionsCountByUser[p.id] ?? 0,
          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
'@

$newMap = @'
          points: pointsByUser[p.id] ?? 0,
          exactScores: exactScoresByUser[p.id] ?? 0,
          predictionsCount: predictionsCountByUser[p.id] ?? 0,
          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);
            return {
              careerLevel: result.level,
              careerTitle: careerTitles[Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))],
            };
          })(),
'@

if ($ranking.Contains($oldMap) -and $ranking -notmatch 'careerTitle: careerTitles') {
    $ranking = $ranking.Replace($oldMap, $newMap)
    Write-Host "OK : niveau individuel injecte dans les joueurs." -ForegroundColor Green
} elseif ($ranking -notmatch 'careerTitle: careerTitles') {
    Copy-Item $cardBackup $cardFile -Force
    Copy-Item $rankingBackup $rankingFile -Force
    throw "Bloc sortedList introuvable."
}

# ============================================================
# 8. useMemo : ajouter careerStatsByUser aux dependances.
# ============================================================
$ranking = $ranking.Replace(
    '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser]);',
    '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]);'
)

# ============================================================
# 9. toCardData : transmettre niveau + titre.
# ============================================================
$anchor = '    regularityPlayed: p.predictionsCount,'
if ($ranking.Contains($anchor) -and $ranking -notmatch 'careerLevel: p.careerLevel') {
    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,"
    )
    Write-Host "OK : niveau transmis a PlayerCard." -ForegroundColor Green
}

Set-Content -Path $rankingFile -Value $ranking -Encoding UTF8

# ============================================================
# 10. Verification
# ============================================================
$cardCheck = Get-Content $cardFile -Raw
$rankingCheck = Get-Content $rankingFile -Raw

$checks = @(
    @{ Name = "PlayerCardData careerLevel"; Ok = $cardCheck -match 'careerLevel:\s*number;' },
    @{ Name = "PlayerCardData careerTitle"; Ok = $cardCheck -match 'careerTitle:\s*string;' },
    @{ Name = "Badge niveau PlayerCard"; Ok = $cardCheck -match 'player\.careerTitle' },
    @{ Name = "Moteur carriere"; Ok = $rankingCheck -match 'calculateCareerScore' },
    @{ Name = "Cumul multi-saisons"; Ok = $rankingCheck -match 'careerPredictionsData' },
    @{ Name = "30 titres"; Ok = $rankingCheck -match 'const careerTitles = \[' },
    @{ Name = "Transmission niveau"; Ok = $rankingCheck -match 'careerLevel:\s*p\.careerLevel' },
    @{ Name = "Transmission titre"; Ok = $rankingCheck -match 'careerTitle:\s*p\.careerTitle' }
)

foreach ($check in $checks) {
    if ($check.Ok) {
        Write-Host "OK : $($check.Name)" -ForegroundColor Green
    } else {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "Verification echouee : $($check.Name). Fichiers restaures."
    }
}

# ============================================================
# 11. BUILD
# ============================================================
Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $cardBackup $cardFile -Force
    Copy-Item $rankingBackup $rankingFile -Force
    throw "Build echoue. Les deux fichiers ont ete restaures."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NIVEAUX CLASSEMENT : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Niveau individuel : OUI"
Write-Host "Carriere multi-saisons : OUI"
Write-Host "30 niveaux : OUI"
Write-Host "Titre du niveau : OUI"
Write-Host "Badge compact a cote du pseudo : OUI"
Write-Host "Points carriere affiches : NON"
Write-Host "Progression affichee : NON"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
