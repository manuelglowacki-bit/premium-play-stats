$ErrorActionPreference = "Stop"

$root = Get-Location
$path = Join-Path $root "src\components\VestiaireFloatingButton.tsx"

if (-not (Test-Path -LiteralPath $path)) {
    throw "Fichier introuvable : $path"
}

$backup = "$path.backup-push-floating-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $path -Destination $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$content = [System.IO.File]::ReadAllText($path)

# ------------------------------------------------------------
# 1. Import du bouton Push
# ------------------------------------------------------------
$importLine = 'import PushNotificationsButton from "@/components/PushNotificationsButton";'

if ($content -notmatch 'PushNotificationsButton') {
    $supabaseImport = 'import { supabase } from "@/lib/supabase";'

    if ($content.Contains($supabaseImport)) {
        $content = $content.Replace(
            $supabaseImport,
            "$supabaseImport`r`n$importLine"
        )
    } else {
        # Fallback : ajout avant le premier import.
        $firstImport = [regex]::Match($content, '(?m)^import .+;$')
        if (-not $firstImport.Success) {
            throw "Impossible de trouver les imports dans VestiaireFloatingButton.tsx."
        }

        $content = $content.Insert($firstImport.Index, "$importLine`r`n")
    }

    Write-Host "OK : import PushNotificationsButton ajoute." -ForegroundColor Green
} else {
    Write-Host "OK : import PushNotificationsButton deja present." -ForegroundColor Green
}

# ------------------------------------------------------------
# 2. Ajout du bouton dans la fenetre Floating
# ------------------------------------------------------------
if ($content -notmatch '<PushNotificationsButton\s*/>') {

    $buttonBlock = @'
          <div className="border-b border-white/[.07] px-3 py-3">
            <PushNotificationsButton />
          </div>
'@

    # Methode A : zone actuelle connue
    $patternA = '(?m)^(\s*)<div\s+className=["'']space-y-2\s+p-3["'']>'

    if ([regex]::IsMatch($content, $patternA)) {
        $content = [regex]::Replace(
            $content,
            $patternA,
            "$buttonBlock`r`n`$1<div className=""space-y-2 p-3"">",
            1
        )
        Write-Host "OK : bouton ajoute dans la zone du Floating." -ForegroundColor Green
    }
    else {
        # Methode B : fallback sur le bloc messages
        $patternB = '(?m)^(\s*)\{messages\.length\s*\?\s*\('

        if ([regex]::IsMatch($content, $patternB)) {
            $match = [regex]::Match($content, $patternB)
            $indent = $match.Groups[1].Value
            $insert = "$indent<div className=""border-b border-white/[.07] px-3 py-3"">`r`n$indent  <PushNotificationsButton />`r`n$indent</div>`r`n"
            $content = $content.Insert($match.Index, $insert)
            Write-Host "OK : bouton ajoute juste avant les messages du Floating." -ForegroundColor Green
        }
        else {
            # Methode C : repere le texte "Le chat privé du groupe" puis
            # cherche le prochain bloc principal de contenu.
            $subtitle = $content.IndexOf("Le chat privé du groupe")

            if ($subtitle -ge 0) {
                $afterSubtitle = $content.IndexOf("</div>", $subtitle)

                if ($afterSubtitle -ge 0) {
                    $insertAt = $afterSubtitle + 6
                    $insert = @"

          <div className="border-b border-white/[.07] px-3 py-3">
            <PushNotificationsButton />
          </div>
"@
                    $content = $content.Insert($insertAt, $insert)
                    Write-Host "OK : bouton ajoute via le titre du Floating." -ForegroundColor Green
                }
                else {
                    throw "Impossible de trouver le conteneur du titre du Floating."
                }
            }
            else {
                throw "Impossible de localiser la fenetre du Floating Vestiaire."
            }
        }
    }
}
else {
    Write-Host "OK : <PushNotificationsButton /> est deja present." -ForegroundColor Green
}

# ------------------------------------------------------------
# 3. Ecriture UTF-8 sans BOM
# ------------------------------------------------------------
[System.IO.File]::WriteAllText(
    $path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

# ------------------------------------------------------------
# 4. Verification
# ------------------------------------------------------------
$check = [System.IO.File]::ReadAllText($path)

if ($check -notmatch 'PushNotificationsButton') {
    throw "Import PushNotificationsButton absent apres modification."
}

if ($check -notmatch '<PushNotificationsButton\s*/>') {
    throw "JSX PushNotificationsButton absent apres modification."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " NOTIFICATIONS BRANCHEES DANS LE FLOATING" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fichier : $path" -ForegroundColor White
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Lance maintenant :" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis Ctrl + F5 sur http://localhost:5173/" -ForegroundColor Cyan
Write-Host "Ouvre le Floating : le bouton ACTIVER doit apparaitre." -ForegroundColor Cyan
