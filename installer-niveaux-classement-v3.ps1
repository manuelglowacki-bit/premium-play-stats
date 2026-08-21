$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-career-ranking-final-$stamp"
$cardBackup = "$cardFile.backup-career-ranking-final-$stamp"

Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor Green
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor Green

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# ============================================================
# PLAYER CARD
# ============================================================
if ($card -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularityPlayed: number;'
    if (!$card.Contains($anchor)) {
        throw "Ancre PlayerCardData introuvable."
    }
    $card = $card.Replace(
        $anchor,
        $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;"
    )
    Write-Host "OK : champs carrière ajoutes a PlayerCardData." -ForegroundColor Green
}

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
    Write-Host "OK : badge carrière ajoute a cote du pseudo." -ForegroundColor Green
} elseif ($card -notmatch 'player\.careerTitle') {
    throw "Bloc pseudo PlayerCard introuvable."
}

Set-Content -Path $cardFile -Value $card -Encoding UTF8

# ============================================================
# CLASSEMENT
# ============================================================
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
    $anchor = 'import { matchday as currentMatchday } from "@/lib/prono-data";'
    if (!$ranking.Contains($anchor)) {
        throw "Import prono-data introuvable."
    }
    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n" + 'import { calculateCareerScore } from "@/lib/careerLevel";'
    )
    Write-Host "OK : moteur carrière importe." -ForegroundColor Green
}

if ($ranking -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularitySuccess: number;'
    if (!$ranking.Contains($anchor)) { throw "Ancre RankedPlayer introuvable." }
    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;"
    )
    Write-Host "OK : RankedPlayer enrichi." -ForegroundColor Green
}

if ($ranking -notmatch 'careerStatsByUser') {
    $anchor = '  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});'
    if (!$ranking.Contains($anchor)) { throw "State regularitySuccessByUser introuvable." }
    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});"
    )
    Write-Host "OK : state carrière ajoute." -ForegroundColor Green
}

# Charger la carrière indépendamment du calcul de la saison courante.
if ($ranking -notmatch 'careerPredictionsData') {
    $anchor = '        const \['
    $firstArray = $ranking.IndexOf($anchor)
    if ($firstArray -lt 0) { throw "Premier Promise.all introuvable." }

    # On insère juste après le chargement des données principales et avant le filtre saison.
    $insertAnchor = '        setTeamsById(teamsMap);'
    if (!$ranking.Contains($insertAnchor)) { throw "setTeamsById introuvable." }

    $careerBlock = @'

        // ============================================================
        // CARRIERE MULTI-SAISON
        // Les points et scores exacts sont cumules sur toutes les
        // saisons disponibles. Aucun reset annuel.
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
          if (!match) return;

          if (!careerAccum[uid]) {
            careerAccum[uid] = { points: 0, exactScores: 0 };
          }

          careerAccum[uid].points += Number(pred.points ?? 0);

          if (
            match.finished &&
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

    $ranking = $ranking.Replace($insertAnchor, $insertAnchor + $careerBlock)
    Write-Host "OK : cumul carrière multi-saisons branche." -ForegroundColor Green
}

# 30 titres.
if ($ranking -notmatch 'const careerTitles = \[') {
    $anchor = '  const loading = players === null;'
    if (!$ranking.Contains($anchor)) { throw "Ancre loading introuvable." }

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
    Write-Host "OK : 30 titres disponibles." -ForegroundColor Green
}

# Ajouter niveau au map exact de sortedList.
$oldMap = @'
           regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
'@

$newMap = @'
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
    Write-Host "OK : niveau individuel ajoute a sortedList." -ForegroundColor Green
} elseif ($ranking -notmatch 'careerTitle: careerTitles') {
    throw "Bloc sortedList introuvable."
}

# Dependances du useMemo.
$oldDeps = '    }, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser]);'
$newDeps = '    }, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]);'
if ($ranking.Contains($oldDeps)) {
    $ranking = $ranking.Replace($oldDeps, $newDeps)
    Write-Host "OK : dependance carrière ajoutee au useMemo." -ForegroundColor Green
}

# toCardData.
$cardDataAnchor = '    regularityPlayed: p.predictionsCount,'
if ($ranking.Contains($cardDataAnchor) -and $ranking -notmatch 'careerLevel: p\.careerLevel') {
    $ranking = $ranking.Replace(
        $cardDataAnchor,
        $cardDataAnchor + "`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,"
    )
    Write-Host "OK : niveau transmis a PlayerCard." -ForegroundColor Green
}

Set-Content -Path $rankingFile -Value $ranking -Encoding UTF8

# ============================================================
# VERIFICATION
# ============================================================
$cardCheck = Get-Content $cardFile -Raw
$rankingCheck = Get-Content $rankingFile -Raw

if ($cardCheck -notmatch 'careerLevel:\s*number;') { throw "PlayerCardData careerLevel absent." }
if ($cardCheck -notmatch 'careerTitle:\s*string;') { throw "PlayerCardData careerTitle absent." }
if ($cardCheck -notmatch 'player\.careerTitle') { throw "Badge PlayerCard absent." }
if ($rankingCheck -notmatch 'calculateCareerScore') { throw "Moteur carrière absent." }
if ($rankingCheck -notmatch 'careerPredictionsData') { throw "Donnees carrière absentes." }
if ($rankingCheck -notmatch 'const careerTitles = \[') { throw "30 titres absents." }
if ($rankingCheck -notmatch 'careerLevel:\s*p\.careerLevel') { throw "Transmission niveau absente." }
if ($rankingCheck -notmatch 'careerTitle:\s*p\.careerTitle') { throw "Transmission titre absente." }

Write-Host "OK : toutes les verifications passent." -ForegroundColor Green

# ============================================================
# BUILD
# ============================================================
Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $cardBackup $cardFile -Force
    Copy-Item $rankingBackup $rankingFile -Force
    throw "Build echoue. Fichiers restaures."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NIVEAUX CLASSEMENT : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Niveau individuel : OUI"
Write-Host "Carriere multi-saisons : OUI"
Write-Host "30 niveaux : OUI"
Write-Host "Badge compact a cote du pseudo : OUI"
Write-Host "Points carriere affiches : NON"
Write-Host "Progression affichee : NON"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
