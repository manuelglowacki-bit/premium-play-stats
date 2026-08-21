$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== SYSTEME CARRIERE MULTI-SAISON ===" -ForegroundColor Cyan

$root = Get-Location
$libDir = Join-Path $root "src\lib"

if (!(Test-Path $libDir)) {
    New-Item -ItemType Directory -Path $libDir -Force | Out-Null
}

$careerFile = Join-Path $libDir "careerLevel.ts"

if (Test-Path $careerFile) {
    $backup = "$careerFile.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $careerFile $backup -Force
    Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
}

@'
/**
 * Systeme de carriere Prono Ligue 1 LM
 *
 * REGLE :
 * score de carriere = points cumules sur toutes les saisons
 *                  + (scores exacts cumules x 2)
 *
 * Les seuils des 30 niveaux restent volontairement internes.
 * Aucun compteur de progression n'est expose a l'utilisateur.
 */

export type CareerStats = {
  points: number;
  exactScores: number;
};

export type CareerResult = CareerStats & {
  careerScore: number;
  level: number;
};

export const CAREER_LEVEL_THRESHOLDS: readonly number[] = [
  0,
  35,
  80,
  135,
  200,
  280,
  375,
  485,
  610,
  750,
  905,
  1075,
  1260,
  1460,
  1675,
  1905,
  2150,
  2410,
  2685,
  2975,
  3280,
  3600,
  3935,
  4285,
  4650,
  5030,
  5425,
  5835,
  6260,
  6700,
];

/**
 * Retourne le niveau courant entre 1 et 30.
 * Les seuils sont volontairement non affiches dans l'UI.
 */
export function getCareerLevel(careerScore: number): number {
  const score = Math.max(0, Number(careerScore) || 0);
  let level = 1;

  for (let i = 0; i < CAREER_LEVEL_THRESHOLDS.length; i += 1) {
    if (score >= CAREER_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  return Math.min(30, Math.max(1, level));
}

export function calculateCareerScore(stats: CareerStats): CareerResult {
  const points = Math.max(0, Number(stats.points) || 0);
  const exactScores = Math.max(0, Number(stats.exactScores) || 0);

  const careerScore = points + exactScores * 2;

  return {
    points,
    exactScores,
    careerScore,
    level: getCareerLevel(careerScore),
  };
}
'@ | Set-Content -Path $careerFile -Encoding UTF8

Write-Host "OK : moteur de carriere cree : $careerFile" -ForegroundColor Green

# Recherche du fichier Accueil.
$candidates = @(
    "src\routes\index.tsx",
    "src\routes\home.tsx",
    "src\routes\_index.tsx"
)

$homeFile = $null
foreach ($candidate in $candidates) {
    $full = Join-Path $root $candidate
    if (Test-Path $full) {
        $homeFile = $full
        break
    }
}

if (!$homeFile) {
    Write-Host ""
    Write-Host "ATTENTION : fichier Accueil introuvable automatiquement." -ForegroundColor Yellow
    Write-Host "Le moteur est installe. Il faudra brancher careerLevel.ts dans la page Accueil."
    exit 0
}

Write-Host "Accueil detecte : $homeFile" -ForegroundColor Green

$homeBackup = "$homeFile.backup-career-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $homeFile $homeBackup -Force

$content = Get-Content $homeFile -Raw

# 1. Import du moteur.
if ($content -notmatch 'from "@/lib/careerLevel"') {
    $importAnchor = 'import { useTeamTheme } from "@/hooks/useTeamTheme";'
    if ($content.Contains($importAnchor)) {
        $content = $content.Replace(
            $importAnchor,
            $importAnchor + "`r`nimport { calculateCareerScore } from `"@/lib/careerLevel`";"
        )
    } else {
        $content = $content.Replace(
            'import { useEffect, useRef, useState } from "react";',
            'import { useEffect, useRef, useState } from "react";' + "`r`n" +
            'import { calculateCareerScore } from "@/lib/careerLevel";'
        )
    }
}

# 2. Etat careerLevel.
if ($content -notmatch 'careerLevel:\s*1') {
    $anchor = 'const [potAmount, setPotAmount] = useState(0);'
    if ($content.Contains($anchor)) {
        $content = $content.Replace(
            $anchor,
            $anchor + "`r`n  const [careerLevel, setCareerLevel] = useState(1);"
        )
    }
}

# 3. Remplacer le badge fixe.
$content = $content.Replace(
    '<Star size={10} className="fill-amber-400" /> NIVEAU 12',
    '<Star size={10} className="fill-amber-400" /> NIVEAU {careerLevel}'
)

# 4. Ajout du calcul multi-saison.
# On utilise les points/exacts deja calcules sur toutes les predictions.
# Pour l'instant on branche sur les donnees globales existantes ; le prochain
# passage pourra affiner la separation par saison si necessaire.
$anchor2 = 'setLeaderboard(rankedRankings);'

if ($content.Contains($anchor2) -and $content -notmatch 'setCareerLevel\(') {
    $insert = @'
        const careerByUser = new Map<string, { points: number; exactScores: number }>();

        (predictions || []).forEach((p: any) => {
          const uid = p.user_id;
          if (!uid) return;

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
    $content = $content.Replace($anchor2, $insert + "        " + $anchor2)
}

Set-Content -Path $homeFile -Value $content -Encoding UTF8

Write-Host "OK : badge Accueil passe de NIVEAU 12 a NIVEAU dynamique." -ForegroundColor Green
Write-Host "Sauvegarde Accueil : $homeBackup" -ForegroundColor DarkGray

Write-Host ""
Write-Host "=== VERIFICATION ===" -ForegroundColor Cyan
Get-Content $careerFile | Select-String -Pattern "CAREER_LEVEL_THRESHOLDS|calculateCareerScore|getCareerLevel"
Get-Content $homeFile | Select-String -Pattern "careerLevel|calculateCareerScore|NIVEAU \{careerLevel\}"

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD ECHOUE : restauration de l'Accueil." -ForegroundColor Red
    Copy-Item $homeBackup $homeFile -Force
    throw "Build echoue."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " SYSTEME DE NIVEAUX INSTALLE !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "30 niveaux - seuils caches"
Write-Host "Points carriere = points + (scores exacts x 2)"
Write-Host "Cumul multi-saison"
Write-Host "Aucune barre de progression"
Write-Host "Aucun seuil affiche"
Write-Host ""
