$ErrorActionPreference = "Stop"

$file = ".\supabase\functions\test-push-phone\index.ts"

if (!(Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
}

$backup = "$file.backup-diagnostic-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $file -Destination $backup -Force

$content = [System.IO.File]::ReadAllText($file)

# Ajoute un tableau de détails d'erreur juste après les compteurs.
if ($content -notmatch "const errorDetails") {
    $needle = '    let sent = 0;'
    if (!$content.Contains($needle)) {
        throw "Compteur sent introuvable."
    }

    $replacement = @'
    let sent = 0;
    const errorDetails: Array<{
      id: string;
      statusCode: number;
      message: string;
    }> = [];
'@

    $content = $content.Replace($needle, $replacement)
}

# Remplace uniquement le bloc de catch d'envoi pour conserver le détail sans secret.
$old = @'
      } catch (err) {
        failed++;
        const statusCode = Number((err as any)?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          invalidIds.push(sub.id);
        }
        console.error("Push error:", sub.id, statusCode, err);
      }
'@

$new = @'
      } catch (err) {
        failed++;
        const statusCode = Number((err as any)?.statusCode ?? 0);
        const message = err instanceof Error ? err.message : String(err);

        errorDetails.push({
          id: String(sub.id),
          statusCode,
          message: message.slice(0, 500),
        });

        if (statusCode === 404 || statusCode === 410) {
          invalidIds.push(sub.id);
        }

        console.error("Push error:", sub.id, statusCode, message);
      }
'@

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
}
elseif ($content -notmatch "errorDetails\.push") {
    throw "Bloc catch Push introuvable. Aucune modification supplementaire effectuee."
}

# Ajoute les détails dans la réponse JSON.
$oldResponse = @'
      removed_invalid: invalidIds.length,
      message: sent > 0
'@

$newResponse = @'
      removed_invalid: invalidIds.length,
      errors: errorDetails,
      message: sent > 0
'@

if ($content.Contains($oldResponse)) {
    $content = $content.Replace($oldResponse, $newResponse)
}
elseif ($content -notmatch "errors: errorDetails") {
    throw "Bloc de reponse introuvable."
}

[System.IO.File]::WriteAllText(
    $file,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " DIAGNOSTIC PUSH" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Build local de la fonction non requis : deploiement direct." -ForegroundColor Yellow
Write-Host "Deploiement test-push-phone..." -ForegroundColor Cyan

& npx --yes supabase@latest functions deploy test-push-phone --project-ref azgksiwcgvbertzzzhvq --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    throw "Deploiement de test-push-phone impossible."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " DIAGNOSTIC DEPLOYE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Relance maintenant :" -ForegroundColor Yellow
Write-Host 'powershell -ExecutionPolicy Bypass -File ".\tester-push-telephone.ps1"' -ForegroundColor White
Write-Host ""
Write-Host "Le resultat affichera maintenant le code et le message d'erreur Web Push." -ForegroundColor Cyan
Write-Host "Aucune cle VAPID ne sera affichee." -ForegroundColor Cyan
