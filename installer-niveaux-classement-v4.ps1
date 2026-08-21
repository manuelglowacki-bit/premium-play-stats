$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-career-ranking-v4-$stamp"
$cardBackup = "$cardFile.backup-career-ranking-v4-$stamp"

Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor Green
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor Green

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# ------------------------------------------------------------
# PLAYER CARD
# ------------------------------------------------------------
if ($card -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularityPlayed: number;'
    if (!$card.Contains($anchor)) { throw "PlayerCardData introuvable." }

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

# ------------------------------------------------------------
# IMPORT MOTEUR CARRIERE
# ------------------------------------------------------------
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
    $importAnchor = 'import { matchday as currentMatchday } from "@/lib/prono-data";'
    if (!$ranking.Contains($importAnchor)) { throw "Import prono-data introuvable." }

    $ranking = $ranking.Replace(
        $importAnchor,
        $importAnchor + "`r`n" + 'import { calculateCareerScore } from "@/lib/careerLevel";'
    )
    Write-Host "OK : moteur carrière importe." -ForegroundColor Green
}

# ------------------------------------------------------------
# RANKED PLAYER
# ------------------------------------------------------------
if ($ranking -notmatch 'careerLevel:\s*number;') {
    $anchor = '  regularitySuccess: number;'
    if (!$ranking.Contains($anchor)) { throw "Interface RankedPlayer introuvable." }

    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;"
    )
    Write-Host "OK : RankedPlayer enrichi." -ForegroundColor Green
}

# ------------------------------------------------------------
# STATE CARRIERE
# ------------------------------------------------------------
if ($ranking -notmatch 'careerStatsByUser') {
    $anchor = '  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});'
    if (!$ranking.Contains($anchor)) { throw "State regularitySuccessByUser introuvable." }

    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});"
    )
    Write-Host "OK : state carrière ajoute." -ForegroundColor Green
}

# ------------------------------------------------------------
# CARRIERE : INSERTION APRES setTeamsById(teamsMap)
# Aucun remplacement du Promise.all existant.
# ------------------------------------------------------------
if ($ranking -notmatch 'careerPredictionsData') {

    $anchor = 'setTeamsById(teamsMap);'
    $pos = $ranking.IndexOf($anchor)

    if ($pos -lt 0) {
        throw "setTeamsById(teamsMap) introuvable."
    }

    $insertAt = $pos + $anchor.Length

    $careerBlock = @'

        // ============================================================
        // CARRIERE MULTI-SAISON
        // Independant du classement de la saison actuelle.
        // Tous les pronostics et tous les scores exacts termines
        // disponibles sont cumules.
        // ============================================================
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

        if (!cancelled) {
          setCareerStatsByUser(careerAccum);
        }
'@

    $ranking = $ranking.Insert($insertAt, $careerBlock)
    Write-Host "OK : carriere branchee apres setTeamsById, sans toucher au Promise.all existant." -ForegroundColor Green
}

# ------------------------------------------------------------
# 30 TITRES
# ------------------------------------------------------------
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

# ------------------------------------------------------------
# AJOUT DU NIVEAU DANS LE MAP sortedList
# Recherche la propriété regularitySuccess dans le bloc .map,
# sans supposer sa mise en forme exacte.
# ------------------------------------------------------------
if ($ranking -notmatch 'careerTitle:\s*careerTitles') {

    $mapPattern = '(?s)(const\s+sortedList\s*=\s*.*?\.map\(\(p:\s*any\)\s*=>\s*\{.*?regularitySuccess:\s*regularitySuccessByUser\[p\.id\]\s*\?\?\s*0,\s*)'

    if ($ranking -notmatch $mapPattern) {
        throw "Propriete regularitySuccess de sortedList introuvable."
    }

    $careerFields = @'
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);

            return {
              careerLevel: result.level,
              careerTitle: careerTitles[
                Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))
              ],
            };
          })(),
'@

    $ranking = [regex]::Replace(
        $ranking,
        $mapPattern,
        '${1}' + $careerFields,
        1
    )

    Write-Host "OK : niveau individuel injecte dans sortedList." -ForegroundColor Green
}

# ------------------------------------------------------------
# DEPENDANCE DU useMemo
# ------------------------------------------------------------
$ranking = $ranking.Replace(
    'regularitySuccessByUser]);',
    'regularitySuccessByUser, careerStatsByUser]);'
)

# ------------------------------------------------------------
# toCardData
# ------------------------------------------------------------
if ($ranking -notmatch 'careerLevel:\s*p\.careerLevel') {

    $anchor = '    regularityPlayed: p.predictionsCount,'
    if (!$ranking.Contains($anchor)) { throw "regularityPlayed de toCardData introuvable." }

    $ranking = $ranking.Replace(
        $anchor,
        $anchor + "`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,"
    )

    Write-Host "OK : niveau transmis a PlayerCard." -ForegroundColor Green
}

Set-Content -Path $rankingFile -Value $ranking -Encoding UTF8

# ------------------------------------------------------------
# VERIFICATIONS
# ------------------------------------------------------------
$cardCheck = Get-Content $cardFile -Raw
$rankingCheck = Get-Content $rankingFile -Raw

$checks = @(
    @("PlayerCardData careerLevel", $cardCheck -match 'careerLevel:\s*number;'),
    @("PlayerCardData careerTitle", $cardCheck -match 'careerTitle:\s*string;'),
    @("Badge PlayerCard", $cardCheck -match 'player\.careerTitle'),
    @("Moteur carrière", $rankingCheck -match 'calculateCareerScore'),
    @("Carriere multi-saison", $rankingCheck -match 'careerPredictionsData'),
    @("30 titres", $rankingCheck -match 'const careerTitles = \['),
    @("Niveau sortedList", $rankingCheck -match 'careerLevel:\s*result\.level'),
    @("Titre sortedList", $rankingCheck -match 'careerTitle:\s*careerTitles'),
    @("Transmission PlayerCard", $rankingCheck -match 'careerLevel:\s*p\.careerLevel')
)

foreach ($c in $checks) {
    if ($c[1]) {
        Write-Host "OK : $($c[0])" -ForegroundColor Green
    } else {
        Copy-Item $cardBackup $cardFile -Force
        Copy-Item $rankingBackup $rankingFile -Force
        throw "Verification echouee : $($c[0]). Fichiers restaures."
    }
}

# ------------------------------------------------------------
# BUILD
# ------------------------------------------------------------
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
Write-Host " NIVEAUX CLASSEMENT V4 : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Niveau individuel : OUI"
Write-Host "Carriere multi-saisons : OUI"
Write-Host "30 niveaux : OUI"
Write-Host "Badge compact : OUI"
Write-Host "Points carriere affiches : NON"
Write-Host "Progression affichee : NON"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
