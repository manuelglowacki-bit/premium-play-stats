$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " SUPPRESSION DU FLOATING + NOTIFICATIONS DANS PROFIL" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$root = Get-Location
$src = Join-Path $root "src"

if (!(Test-Path $src)) {
    throw "Dossier src introuvable."
}

$backup = Join-Path $root ("backup-suppression-floating-profil-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

# ------------------------------------------------------------
# 1. Sauvegarder et supprimer le branchement du Floating partout
# ------------------------------------------------------------
$files = Get-ChildItem -Path $src -Recurse -File |
    Where-Object { $_.Extension -in ".tsx",".ts",".jsx",".js" }

$removedFrom = @()

foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName)
    $original = $text

    # Supprime l'import du composant Floating.
    $text = [regex]::Replace(
        $text,
        '(?m)^\s*import\s+VestiaireFloatingButton\s+from\s+["''][^"'']*VestiaireFloatingButton["''];?\s*\r?\n',
        ''
    )

    # Supprime les utilisations JSX simples.
    $text = [regex]::Replace(
        $text,
        '\s*<VestiaireFloatingButton\s*/>\s*',
        "`r`n"
    )

    if ($text -ne $original) {
        $relative = $f.FullName.Substring($root.Path.Length).TrimStart('\')
        $dest = Join-Path $backup $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        Copy-Item $f.FullName $dest -Force

        [System.IO.File]::WriteAllText(
            $f.FullName,
            $text,
            (New-Object System.Text.UTF8Encoding($false))
        )

        $removedFrom += $relative
        Write-Host "OK : branchement Floating retire de $relative" -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# 2. Supprimer totalement le composant Floating
# ------------------------------------------------------------
$floatingCandidates = @(
    (Join-Path $src "components\VestiaireFloatingButton.tsx"),
    (Join-Path $src "components\VestiaireFloatingButton.jsx"),
    (Join-Path $src "components\VestiaireFloatingButton.ts"),
    (Join-Path $src "components\VestiaireFloatingButton.js")
)

foreach ($floating in $floatingCandidates) {
    if (Test-Path -LiteralPath $floating) {
        $relative = $floating.Substring($root.Path.Length).TrimStart('\')
        $dest = Join-Path $backup $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        Copy-Item $floating $dest -Force
        Remove-Item $floating -Force
        Write-Host "OK : composant Floating supprime : $relative" -ForegroundColor Green
    }
}

# ------------------------------------------------------------
# 3. Trouver la page Profil
# ------------------------------------------------------------
$profileCandidates = @(
    (Join-Path $src "routes\profil.tsx"),
    (Join-Path $src "routes\profile.tsx"),
    (Join-Path $src "pages\profil.tsx"),
    (Join-Path $src "pages\profile.tsx"),
    (Join-Path $src "Profil.tsx"),
    (Join-Path $src "Profile.tsx")
)

$profile = $profileCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $profile) {
    $profile = Get-ChildItem -Path $src -Recurse -File |
        Where-Object {
            $_.Extension -eq ".tsx" -and
            $_.BaseName -match '^(profil|profile)$'
        } |
        Select-Object -ExpandProperty FullName -First 1
}

if (-not $profile) {
    throw "Impossible de trouver la page Profil (profil.tsx/profile.tsx)."
}

Write-Host "Profil trouve : $profile" -ForegroundColor Cyan

# Sauvegarde profil
$relativeProfile = $profile.Substring($root.Path.Length).TrimStart('\')
$profileBackup = Join-Path $backup $relativeProfile
New-Item -ItemType Directory -Force -Path (Split-Path $profileBackup) | Out-Null
Copy-Item $profile $profileBackup -Force

$profileText = [System.IO.File]::ReadAllText($profile)

# ------------------------------------------------------------
# 4. Ajouter l'import PushNotificationsButton
# ------------------------------------------------------------
if ($profileText -notmatch 'PushNotificationsButton') {
    $firstImport = [regex]::Match($profileText, '(?m)^import .+;$')

    if ($firstImport.Success) {
        $profileText = $profileText.Insert(
            $firstImport.Index,
            'import PushNotificationsButton from "@/components/PushNotificationsButton";' + "`r`n"
        )
    } else {
        $profileText = 'import PushNotificationsButton from "@/components/PushNotificationsButton";' + "`r`n" + $profileText
    }

    Write-Host "OK : import notifications ajoute au Profil." -ForegroundColor Green
}

# ------------------------------------------------------------
# 5. Ajouter le bloc Notifications dans Profil
# ------------------------------------------------------------
if ($profileText -notmatch 'id=["'']profile-push-notifications["'']') {

    $block = @'
        <section
          id="profile-push-notifications"
          className="mb-6 rounded-2xl border border-emerald-400/20 bg-[#07151d]/90 p-4 shadow-lg"
        >
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Notifications
            </div>
            <h2 className="mt-1 text-lg font-black text-white">
              Rappels de pronostics
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Reçois une notification 1 h avant un match si tu n'as pas encore fait ton prono.
            </p>
          </div>
          <PushNotificationsButton />
        </section>
'@

    # Priorite : insérer au début du premier <main ...>
    $mainMatch = [regex]::Match($profileText, '(?s)<main\b[^>]*>')
    if ($mainMatch.Success) {
        $insertAt = $mainMatch.Index + $mainMatch.Length
        $profileText = $profileText.Insert($insertAt, "`r`n$block`r`n")
    }
    else {
        # Fallback : insérer juste après le premier "return ("
        $returnMatch = [regex]::Match($profileText, '(?s)return\s*\(')
        if (-not $returnMatch.Success) {
            throw "Impossible de trouver le conteneur JSX de la page Profil."
        }

        $insertAt = $returnMatch.Index + $returnMatch.Length
        $profileText = $profileText.Insert($insertAt, "`r`n$block`r`n")
    }

    Write-Host "OK : bloc Notifications ajoute au Profil." -ForegroundColor Green
}
else {
    Write-Host "OK : bloc Notifications deja present dans Profil." -ForegroundColor Yellow
}

[System.IO.File]::WriteAllText(
    $profile,
    $profileText,
    (New-Object System.Text.UTF8Encoding($false))
)

# ------------------------------------------------------------
# 6. Vérifier qu'il ne reste plus de Floating branché
# ------------------------------------------------------------
$remaining = @()

foreach ($f in Get-ChildItem -Path $src -Recurse -File |
    Where-Object { $_.Extension -in ".tsx",".ts",".jsx",".js" }) {

    $t = [System.IO.File]::ReadAllText($f.FullName)

    if ($t -match 'VestiaireFloatingButton') {
        $remaining += $f.FullName
    }
}

if ($remaining.Count -gt 0) {
    Write-Host "ATTENTION : references Floating restantes :" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host $_ }
    throw "Le Floating n'est pas totalement retire."
}

if ($profileText -notmatch 'PushNotificationsButton') {
    throw "Le bouton de notifications n'est pas present dans Profil."
}

Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

& npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Le build a echoue. Les sauvegardes sont dans : $backup"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " TERMINE : FLOATING SUPPRIME" -ForegroundColor Green
Write-Host " NOTIFICATIONS DANS PROFIL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Prochaine commande :" -ForegroundColor Yellow
Write-Host "npx vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Le Vestiaire reste accessible depuis sa page." -ForegroundColor Cyan
Write-Host "Les notifications seront gerees depuis Profil." -ForegroundColor Cyan
