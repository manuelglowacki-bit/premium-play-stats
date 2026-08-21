$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Fichier introuvable : $rankingFile" }
if (!(Test-Path $cardFile)) { throw "Fichier introuvable : $cardFile" }

# Restaure d'abord les sauvegardes V4 si elles existent, car V4 s'est
# arrêtée après des modifications partielles.
$rankingRestore = Get-ChildItem "$rankingFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
$cardRestore = Get-ChildItem "$cardFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($rankingRestore) {
  Copy-Item $rankingRestore.FullName $rankingFile -Force
  Write-Host "OK : Classement restaure depuis la sauvegarde V4." -ForegroundColor Yellow
}
if ($cardRestore) {
  Copy-Item $cardRestore.FullName $cardFile -Force
  Write-Host "OK : PlayerCard restaure depuis la sauvegarde V4." -ForegroundColor Yellow
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup = "$rankingFile.backup-career-ranking-v5-$stamp"
$cardBackup = "$cardFile.backup-career-ranking-v5-$stamp"
Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

$ranking = Get-Content $rankingFile -Raw
$card = Get-Content $cardFile -Raw

# =========================
# PLAYER CARD
# =========================
if ($card -notmatch 'careerLevel:\s*number;') {
  $anchor = '  regularityPlayed: number;'
  if (!$card.Contains($anchor)) { throw "PlayerCardData introuvable." }
  $card = $card.Replace($anchor, $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;")
}

if ($card -notmatch 'player\.careerTitle') {
  $old = '<span className="truncate font-display text-sm font-bold text-white sm:text-base">{player.pseudo || "Joueur"}</span>'
  if (!$card.Contains($old)) { throw "Pseudo PlayerCard introuvable." }

  $new = @'
<div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
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

  # Remplace le bloc nom + Vous entier, pour éviter un doublon "Vous".
  $nameBlock = '(?s)<div className="flex flex-wrap items-center gap-1\.5 sm:gap-2">\s*<span className="truncate font-display text-sm font-bold text-white sm:text-base">\{player\.pseudo \|\| "Joueur"\}</span>.*?</div>'
  if ($card -notmatch $nameBlock) { throw "Bloc nom PlayerCard introuvable." }
  $card = [regex]::Replace($card, $nameBlock, $new.Trim(), 1)
}

Set-Content $cardFile $card -Encoding UTF8
Write-Host "OK : PlayerCard pret." -ForegroundColor Green

# =========================
# CLASSEMENT IMPORT
# =========================
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
  $anchor = 'import { matchday as currentMatchday } from "@/lib/prono-data";'
  if (!$ranking.Contains($anchor)) { throw "Import prono-data introuvable." }
  $ranking = $ranking.Replace($anchor, $anchor + "`r`n" + 'import { calculateCareerScore } from "@/lib/careerLevel";')
}

if ($ranking -notmatch 'careerLevel:\s*number;') {
  $anchor = '  regularitySuccess: number;'
  if (!$ranking.Contains($anchor)) { throw "RankedPlayer introuvable." }
  $ranking = $ranking.Replace($anchor, $anchor + "`r`n  careerLevel: number;`r`n  careerTitle: string;")
}

if ($ranking -notmatch 'careerStatsByUser') {
  $anchor = '  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});'
  if (!$ranking.Contains($anchor)) { throw "State regularity introuvable." }
  $ranking = $ranking.Replace($anchor, $anchor + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});")
}

# =========================
# CARRIERE MULTI-SAISON
# =========================
if ($ranking -notmatch 'careerPredictionsData') {
  $anchor = '        const matchdayIds = ligue1Matchdays.map((md: any) => String(md.id));'
  if (!$ranking.Contains($anchor)) { throw "Ancre matchdayIds introuvable." }

  $careerBlock = @'

        // Carrière multi-saisons : indépendant du classement de la saison courante.
        // Points cumulés + scores exacts cumulés sur tous les matchs terminés.
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

  $ranking = $ranking.Replace($anchor, $anchor + $careerBlock)
  Write-Host "OK : carrière multi-saisons branchee." -ForegroundColor Green
}

# =========================
# 30 TITRES
# =========================
if ($ranking -notmatch 'const careerTitles = \[') {
  $anchor = '  const loading = players === null;'
  if (!$ranking.Contains($anchor)) { throw "Ancre loading introuvable." }

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
  $ranking = $ranking.Replace($anchor, $titles + "`r`n" + $anchor)
}

# =========================
# SORTED LIST : STRUCTURE REELLE DU FICHIER
# =========================
if ($ranking -notmatch 'careerTitle:\s*careerTitles') {
  $old = @'
          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
        }))
'@

  $new = @'
          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);
            return {
              careerLevel: result.level,
              careerTitle: careerTitles[Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))],
            };
          })(),
        }))
'@

  if (!$ranking.Contains($old)) { throw "Bloc sortedList reel introuvable." }
  $ranking = $ranking.Replace($old, $new)
  Write-Host "OK : niveau individuel ajoute a sortedList." -ForegroundColor Green
}

# useMemo dependency
$oldDep = '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser]);'
$newDep = '}, [players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]);'
if ($ranking.Contains($oldDep)) {
  $ranking = $ranking.Replace($oldDep, $newDep)
}

# toCardData
if ($ranking -notmatch 'careerLevel:\s*p\.careerLevel') {
  $anchor = '    regularityPlayed: p.predictionsCount,'
  if (!$ranking.Contains($anchor)) { throw "toCardData introuvable." }
  $ranking = $ranking.Replace($anchor, $anchor + "`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,")
}

Set-Content $rankingFile $ranking -Encoding UTF8

# =========================
# VERIFICATIONS
# =========================
$cardCheck = Get-Content $cardFile -Raw
$rankingCheck = Get-Content $rankingFile -Raw

$checks = @(
  @("PlayerCardData careerLevel", $cardCheck -match 'careerLevel:\s*number;'),
  @("PlayerCardData careerTitle", $cardCheck -match 'careerTitle:\s*string;'),
  @("Badge PlayerCard", $cardCheck -match 'player\.careerTitle'),
  @("Moteur carrière", $rankingCheck -match 'calculateCareerScore'),
  @("Cumul multi-saisons", $rankingCheck -match 'careerPredictionsData'),
  @("30 titres", $rankingCheck -match 'const careerTitles = \['),
  @("Niveau sortedList", $rankingCheck -match 'careerLevel:\s*result\.level'),
  @("Titre sortedList", $rankingCheck -match 'careerTitle:\s*careerTitles'),
  @("Transmission PlayerCard", $rankingCheck -match 'careerLevel:\s*p\.careerLevel')
)

foreach ($c in $checks) {
  if ($c[1]) { Write-Host "OK : $($c[0])" -ForegroundColor Green }
  else {
    Copy-Item $cardBackup $cardFile -Force
    Copy-Item $rankingBackup $rankingFile -Force
    throw "Verification echouee : $($c[0]). Fichiers restaures."
  }
}

# =========================
# BUILD
# =========================
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
Write-Host " NIVEAUX CLASSEMENT V5 : BUILD OK !" -ForegroundColor Green
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
