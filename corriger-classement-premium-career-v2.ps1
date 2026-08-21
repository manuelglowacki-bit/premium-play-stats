$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$classement = Join-Path $root "src\routes\classement.tsx"
$playerCard = Join-Path $root "src\components\prono\PlayerCard.tsx"

if (!(Test-Path $classement)) { throw "Fichier introuvable : $classement" }
if (!(Test-Path $playerCard)) { throw "Fichier introuvable : $playerCard" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupClassement = "$classement.backup-premium-career-fix-$stamp"
$backupPlayerCard = "$playerCard.backup-premium-career-fix-$stamp"

Copy-Item $classement $backupClassement -Force
Copy-Item $playerCard $backupPlayerCard -Force

Write-Host "Sauvegarde Classement : $backupClassement"
Write-Host "Sauvegarde PlayerCard : $backupPlayerCard"

$c = Get-Content $classement -Raw

# 1) Import du calcul carrière
if ($c -notmatch 'from "@/lib/careerLevel"') {
    $needle = 'import { useTeamTheme } from "@/hooks/useTeamTheme";'
    if ($c.Contains($needle)) {
        $c = $c.Replace($needle, $needle + "`r`nimport { calculateCareerScore } from ""@/lib/careerLevel"";")
    } else {
        throw "Import useTeamTheme introuvable."
    }
}

# 2) Ajouter les champs carrière au type RankedPlayer
if ($c -notmatch 'careerLevel:\s*number;') {
    $needle = '  regularitySuccess: number;'
    if ($c.Contains($needle)) {
        $c = $c.Replace($needle, $needle + "`r`n  careerLevel: number;`r`n  careerTitle: string;")
    } else {
        throw "Champ regularitySuccess introuvable dans RankedPlayer."
    }
}

# 3) Ajouter le state carrière
if ($c -notmatch 'careerStatsByUser') {
    $needle = '  const [regularitySuccessByUser, setRegularitySuccessByUser] = useState<Record<string, number>>({});'
    if ($c.Contains($needle)) {
        $replacement = $needle + "`r`n  const [careerStatsByUser, setCareerStatsByUser] = useState<Record<string, { points: number; exactScores: number }>>({});"
        $c = $c.Replace($needle, $replacement)
    } else {
        throw "State regularitySuccessByUser introuvable."
    }
}

# 4) Calcul carrière multi-saison. On l'insère juste après la construction de teamsMap.
if ($c -notmatch 'CARRIERE MULTI-SAISON') {
    $needle = '      setTeamsById(teamsMap);'
    if ($c.Contains($needle)) {
        $block = @'
      setTeamsById(teamsMap);

      // CARRIERE MULTI-SAISON
      // Les points carrière sont cumulés sur tous les matchs terminés,
      // indépendamment de la saison affichée. Les scores exacts sont
      // recalculés depuis le score réel pour rester fiables.
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

      if (!cancelled) {
        setCareerStatsByUser(careerAccum);
      }
'@
        $c = $c.Replace($needle, $block.TrimEnd())
    } else {
        throw "setTeamsById(teamsMap) introuvable."
    }
}

# 5) Titres des 30 niveaux
if ($c -notmatch 'const careerTitles = \[') {
    $needle = '  const loading = players === null;'
    if ($c.Contains($needle)) {
        $block = @'
  const careerTitles = [
    "Débutant","Apprenti","Novice","Amateur","Confirmé","Régulier","Compétiteur","Averti","Spécialiste","Expert",
    "Stratège","Tacticien","Maître","Élite","Grand Maître","Virtuose","Maître Prono","Champion","Champion confirmé","Champion d’élite",
    "Légendaire","Icône","Icône majeure","Référence","Grand Stratège","Maître absolu","Légende","Légende ultime","Immortel","Icône de la Ligue",
  ] as const;

  const loading = players === null;
'@
        $c = $c.Replace($needle, $block.TrimEnd())
    } else {
        throw "const loading introuvable."
    }
}

# 6) Injecter carrière dans le .map() des joueurs du classement.
if ($c -notmatch 'const career = careerStatsByUser\[p\.id\]') {
    $needle = '          regularitySuccess: regularitySuccessByUser[p.id] ?? 0,'
    if ($c.Contains($needle)) {
        $block = @'
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
        $c = $c.Replace($needle, $block.TrimEnd())
    } else {
        throw "Ligne regularitySuccessByUser[p.id] introuvable dans le useMemo."
    }
}

# 7) Ajouter la dépendance careerStatsByUser au useMemo du classement
$oldDeps = '[players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser]'
if ($c.Contains($oldDeps) -and $c -notmatch '\[players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser\]') {
    $c = $c.Replace($oldDeps, '[players, pointsByUser, predictionsCountByUser, exactScoresByUser, regularitySuccessByUser, careerStatsByUser]')
}

# 8) toCardData : transmettre niveau et titre au PlayerCard
if ($c -notmatch 'careerLevel: p\.careerLevel') {
    $needle = '    regularityPlayed: p.predictionsCount,'
    if ($c.Contains($needle)) {
        $c = $c.Replace($needle, $needle + "`r`n    careerLevel: p.careerLevel,`r`n    careerTitle: p.careerTitle,")
    } else {
        throw "regularityPlayed introuvable dans toCardData."
    }
}

# 9) Vérification : la carte doit bien recevoir les valeurs carrière.
$required = @(
    'calculateCareerScore',
    'careerStatsByUser',
    'careerTitles',
    'careerLevel: p.careerLevel',
    'careerTitle: p.careerTitle'
)
foreach ($item in $required) {
    if ($c -notmatch [regex]::Escape($item)) {
        Copy-Item $backupClassement $classement -Force
        Copy-Item $backupPlayerCard $playerCard -Force
        throw "Verification echouee : $item. Fichiers restaures."
    }
}

Set-Content $classement $c -Encoding UTF8

# Le PlayerCard contient déjà le rendu carrière dans la version actuelle.
$pc = Get-Content $playerCard -Raw
if ($pc -notmatch 'player\.careerLevel' -or $pc -notmatch 'player\.careerTitle') {
    Copy-Item $backupClassement $classement -Force
    Copy-Item $backupPlayerCard $playerCard -Force
    throw "PlayerCard ne contient pas le rendu Niveau/Titre attendu. Fichiers restaures."
}

Write-Host "OK : intégration carrière multi-saison + niveau/titre appliquée."
Write-Host "OK : aucun bloc #4+ recherché par commentaire ; patch basé sur les vraies structures du fichier."
Write-Host ""
Write-Host "Lance maintenant : npm run build"
