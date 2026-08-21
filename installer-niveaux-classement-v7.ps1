$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
$cardFile = ".\src\components\prono\PlayerCard.tsx"

if (!(Test-Path $rankingFile)) { throw "Classement introuvable." }
if (!(Test-Path $cardFile)) { throw "PlayerCard introuvable." }

# IMPORTANT : on repart de la sauvegarde V4, pas d'un fichier partiellement modifie.
$rb = Get-ChildItem "$rankingFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$cb = Get-ChildItem "$cardFile.backup-career-ranking-v4-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$rb) { throw "Sauvegarde V4 du Classement introuvable." }
if (!$cb) { throw "Sauvegarde V4 du PlayerCard introuvable." }

Copy-Item $rb.FullName $rankingFile -Force
Copy-Item $cb.FullName $cardFile -Force
Write-Host "OK : fichiers propres restaures depuis V4." -ForegroundColor Yellow

$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$rankingBackup="$rankingFile.backup-career-ranking-v7-$stamp"
$cardBackup="$cardFile.backup-career-ranking-v7-$stamp"
Copy-Item $rankingFile $rankingBackup -Force
Copy-Item $cardFile $cardBackup -Force

$ranking=Get-Content $rankingFile -Raw
$card=Get-Content $cardFile -Raw

# ---------- PlayerCard ----------
if ($card -notmatch 'careerLevel:\s*number;') {
  $card=[regex]::Replace($card,'(regularityPlayed:\s*number;)', '$1'+"`r`n  careerLevel: number;`r`n  careerTitle: string;",1)
}

if ($card -notmatch 'player\.careerTitle') {
  $namePattern='(?s)(<div className="flex flex-wrap items-center gap-1\.5 sm:gap-2">.*?</div>\s*)(\{isMe &&)'
  if ($card -notmatch $namePattern) { throw "Bloc nom PlayerCard introuvable." }

  $badge=@'
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
  # V4 contient deja le badge dans la plupart des cas; sinon insertion ciblée.
  $simple='<span className="truncate font-display text-sm font-bold text-white sm:text-base">\{player\.pseudo \|\| "Joueur"\}</span>'
  if ($card -match $simple) {
    $card=[regex]::Replace($card,$simple,$badge.Trim(),1)
  }
}
Set-Content $cardFile $card -Encoding UTF8
Write-Host "OK : PlayerCard prepare." -ForegroundColor Green

# ---------- Classement : import ----------
if ($ranking -notmatch 'from "@/lib/careerLevel"') {
  $ranking=[regex]::Replace($ranking,'(import .*?from "@/lib/prono-data";)','$1'+"`r`n"+'import { calculateCareerScore } from "@/lib/careerLevel";',1)
}
# ---------- RankedPlayer ----------
if ($ranking -notmatch 'careerLevel:\s*number;') {
  $ranking=[regex]::Replace($ranking,'(regularitySuccess:\s*number;)','$1'+"`r`n  careerLevel: number;`r`n  careerTitle: string;",1)
}
# ---------- State ----------
if ($ranking -notmatch 'careerStatsByUser') {
  $state='const \[regularitySuccessByUser, setRegularitySuccessByUser\] = useState<Record<string, number>>\(\{\}\);'
  if ($ranking -notmatch $state) { throw "State regularity introuvable." }
  $ranking=[regex]::Replace($ranking,$state,'$&'+"`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});",1)
}

# ---------- Carriere ----------
if ($ranking -notmatch 'careerPredictionsData') {
  $anchor='const matchdayIds = ligue1Matchdays.map((md: any) => String(md.id));'
  if ($ranking.IndexOf($anchor) -lt 0) { throw "Ancre matchdayIds introuvable." }
  $career=@'

        // CARRIERE MULTI-SAISON
        const [
          { data: careerPredictionsData, error: careerPredictionsError },
          { data: careerMatchesData, error: careerMatchesError },
        ] = await Promise.all([
          supabase.from("predictions").select("user_id,match_id,points,home_prediction,away_prediction"),
          supabase.from("matches").select("id,home_score,away_score,finished").eq("finished", true),
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
            match.home_score != null && match.away_score != null &&
            pred.home_prediction != null && pred.away_prediction != null &&
            Number(pred.home_prediction) === Number(match.home_score) &&
            Number(pred.away_prediction) === Number(match.away_score)
          ) careerAccum[uid].exactScores += 1;
        });
        if (!cancelled) setCareerStatsByUser(careerAccum);
'@
  $ranking=$ranking.Replace($anchor,$anchor+$career)
  Write-Host "OK : carriere multi-saison branchee." -ForegroundColor Green
}

# ---------- Titres ----------
if ($ranking -notmatch 'const careerTitles = \[') {
  $titles=@'
  const careerTitles = [
    "Débutant","Apprenti","Novice","Amateur","Confirmé","Régulier","Compétiteur","Averti","Spécialiste","Expert",
    "Stratège","Tacticien","Maître","Élite","Grand Maître","Virtuose","Maître Prono","Champion","Champion confirmé","Champion d'élite",
    "Légendaire","Icône","Icône majeure","Référence","Grand Stratège","Maître absolu","Légende","Légende ultime","Immortel","Icône de la Ligue",
  ] as const;

'@
  $ranking=[regex]::Replace($ranking,'(\s*const loading = players === null;)',"`r`n"+$titles+'$1',1)
}

# ---------- sortedList : insertion directement après regularitySuccess ----------
if ($ranking -notmatch 'careerLevel:\s*result\.level') {
  $pattern='(regularitySuccess:\s*regularitySuccessByUser\[p\.id\]\s*\?\?\s*0,\s*)'
  if ($ranking -notmatch $pattern) {
    throw "La ligne regularitySuccess de sortedList est absente."
  }
  $insert=@'
$1
          ...(() => {
            const career = careerStatsByUser[p.id] ?? { points: 0, exactScores: 0 };
            const result = calculateCareerScore(career);
            return {
              careerLevel: result.level,
              careerTitle: careerTitles[Math.max(0, Math.min(result.level - 1, careerTitles.length - 1))],
            };
          })(),
'@
  $ranking=[regex]::Replace($ranking,$pattern,$insert,1)
  Write-Host "OK : niveau individuel ajoute." -ForegroundColor Green
}

# ---------- transmission PlayerCard ----------
if ($ranking -notmatch 'careerLevel:\s*p\.careerLevel') {
  $pattern='(regularityPlayed:\s*p\.predictionsCount,)'
  if ($ranking -notmatch $pattern) { throw "regularityPlayed de toCardData introuvable." }
  $ranking=[regex]::Replace($ranking,$pattern,'$1'+"`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,",1)
}

Set-Content $rankingFile $ranking -Encoding UTF8

# ---------- VERIFICATIONS DIRECTES ----------
$card=Get-Content $cardFile -Raw
$ranking=Get-Content $rankingFile -Raw

if ($card -notmatch 'careerLevel:\s*number;') { throw "PlayerCard : careerLevel absent." }
Write-Host "OK : PlayerCardData carrière." -ForegroundColor Green

if ($card -notmatch 'player\.careerTitle') { throw "PlayerCard : badge carrière absent." }
Write-Host "OK : badge carrière." -ForegroundColor Green

if ($ranking -notmatch 'calculateCareerScore') { throw "Classement : moteur carrière absent." }
Write-Host "OK : moteur carrière." -ForegroundColor Green

if ($ranking -notmatch 'careerPredictionsData') { throw "Classement : cumul multi-saisons absent." }
Write-Host "OK : cumul multi-saisons." -ForegroundColor Green

if ($ranking -notmatch 'careerLevel:\s*result\.level') { throw "Classement : niveau absent du sortedList." }
Write-Host "OK : niveau dans sortedList." -ForegroundColor Green

if ($ranking -notmatch 'careerTitle:\s*careerTitles') { throw "Classement : titre absent du sortedList." }
Write-Host "OK : titre dans sortedList." -ForegroundColor Green

if ($ranking -notmatch 'careerLevel:\s*p\.careerLevel') { throw "Classement : niveau non transmis a PlayerCard." }
Write-Host "OK : niveau transmis a PlayerCard." -ForegroundColor Green

# ---------- BUILD ----------
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
Write-Host " NIVEAUX CLASSEMENT V7 : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "30 niveaux : OUI"
Write-Host "Cumul multi-saisons : OUI"
Write-Host "Badge a cote du pseudo : OUI"
Write-Host "Points/progression affiches : NON"
Write-Host ""
Write-Host "Sauvegarde Classement : $rankingBackup" -ForegroundColor DarkGray
Write-Host "Sauvegarde PlayerCard : $cardBackup" -ForegroundColor DarkGray
