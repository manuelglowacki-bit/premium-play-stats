$ErrorActionPreference = "Stop"

$admin = Join-Path (Get-Location) "src\routes\admin.tsx"

if (-not (Test-Path $admin)) {
    throw "Fichier introuvable : $admin"
}

$backup = "$admin.backup-favorite-team-admin"
Copy-Item $admin $backup -Force

$content = Get-Content $admin -Raw

# 1. Passe la liste des équipes Supabase à PlayersTab.
$content = $content.Replace(
'            <PlayersTab
              players={players}
              setPlayers={setPlayers}',
'            <PlayersTab
              players={players}
              teams={teams}
              setPlayers={setPlayers}'
)

# 2. Ajoute teams aux props de PlayersTab.
$content = $content.Replace(
'function PlayersTab({
  players,
  setPlayers,
  error,',
'function PlayersTab({
  players,
  teams,
  setPlayers,
  error,'
)

$content = $content.Replace(
'  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;',
'  players: Player[];
  teams: Team[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;'
)

# 3. Formulaire : utilise l'ID Supabase de l'équipe.
$content = $content.Replace(
'const [editForm, setEditForm] = useState({ pseudo: "", favorite_team: "" });',
'const [editForm, setEditForm] = useState({ pseudo: "", favorite_team_id: "" });'
)

$content = $content.Replace(
'setEditForm({ pseudo: player.pseudo ?? "", favorite_team: player.favorite_team ?? "" });',
'setEditForm({ pseudo: player.pseudo ?? "", favorite_team_id: player.favorite_team_id ?? "" });'
)

$content = $content.Replace(
'favorite_team: editForm.favorite_team || null,',
'favorite_team_id: editForm.favorite_team_id || null,'
)

# 4. Affichage : recherche le club par son ID dans teams.
$content = $content.Replace(
'              {players.map((player) => (
                <tr key={player.id}',
'              {players.map((player) => {
                const favoriteTeam = teams.find((team) => team.id === player.favorite_team_id);
                return (
                <tr key={player.id}'
)

# Ferme le bloc map avec le bon niveau.
$content = $content.Replace(
'                </tr>
              ))}
            </tbody>',
'                </tr>
                );
              })}
            </tbody>'
)

$content = $content.Replace(
'<ClubBadge value={player.favorite_team} />',
'<ClubBadge value={favoriteTeam?.name ?? ""} />'
)

$content = $content.Replace(
'{player.favorite_team ? (',
'{favoriteTeam ? ('
)

# 5. Select Admin : utilise les équipes Supabase, donc les vrais IDs FK.
$content = $content.Replace(
'value={editForm.favorite_team}',
'value={editForm.favorite_team_id}'
)

$content = $content.Replace(
'onChange={(e) => setEditForm((f) => ({ ...f, favorite_team: e.target.value }))}',
'onChange={(e) => setEditForm((f) => ({ ...f, favorite_team_id: e.target.value }))}'
)

$content = $content.Replace(
'{OFFICIAL_L1_CLUBS.map((c) => (',
'{teams.map((c) => ('
)

Set-Content -Path $admin -Value $content -Encoding UTF8

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " ADMIN - EQUIPE DE COEUR CORRIGE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'Admin utilise maintenant favorite_team_id." -ForegroundColor Green
Write-Host "Le nom du club est resolu depuis teams." -ForegroundColor Green
Write-Host "Le formulaire Admin utilise les vrais IDs Supabase." -ForegroundColor Green
Write-Host ""
Write-Host "Sauvegarde creee :" -ForegroundColor Cyan
Write-Host $backup
Write-Host ""
Write-Host "Teste maintenant avec :" -ForegroundColor Yellow
Write-Host "npm run build"
Write-Host ""
