$ErrorActionPreference = "Stop"

$rankingFile = ".\src\routes\classement.tsx"
if (!(Test-Path $rankingFile)) { throw "Fichier classement introuvable : $rankingFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$rankingFile.backup-classement-premium-v3-$stamp"
Copy-Item $rankingFile $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray

$content = Get-Content $rankingFile -Raw

# ============================================================
# 1) IMPORT TEAM CREST
# ============================================================
if ($content -notmatch 'TeamCrest.*from "@/components/prono/PlayerCard"') {
    $content = $content -replace `
      'import \{ PlayerCard,([^\r\n]*)\} from "@/components/prono/PlayerCard";', `
      'import { PlayerCard, TeamCrest,$1} from "@/components/prono/PlayerCard";'
    Write-Host "OK : TeamCrest ajoute." -ForegroundColor Green
} else {
    Write-Host "OK : TeamCrest deja present." -ForegroundColor Green
}

# ============================================================
# 2) PODIUM PREMIUM
#    Si l'ancien PodiumBoard est encore present, on le remplace.
#    S'il a deja ete remplace par le podium premium, on ne touche pas.
# ============================================================
$podium = @'
            {/* ================= PODIUM PREMIUM ================= */}
            <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#050914]/70 p-3 shadow-[0_30px_80px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-5 lg:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,.12),transparent_34%),radial-gradient(circle_at_15%_55%,rgba(14,165,233,.08),transparent_30%),radial-gradient(circle_at_85%_55%,rgba(249,115,22,.08),transparent_30%)]" />
              <div className="relative grid items-end gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-6">
                {[2, 1, 3].map((rank) => {
                  const group = podiumData.find((g) => g.rank === rank);
                  const item = group?.players?.[0];
                  if (!item) return <div key={rank} className="hidden sm:block" />;

                  const p = item.player;
                  const isFirst = rank === 1;
                  const isSecond = rank === 2;

                  const accent =
                    isFirst
                      ? "border-amber-400/80 shadow-[0_0_55px_rgba(245,158,11,.22)]"
                      : isSecond
                        ? "border-sky-400/65 shadow-[0_0_40px_rgba(14,165,233,.16)]"
                        : "border-orange-400/65 shadow-[0_0_40px_rgba(249,115,22,.16)]";

                  const glow =
                    isFirst
                      ? "from-amber-500/20 via-amber-500/5 to-transparent"
                      : isSecond
                        ? "from-sky-500/16 via-sky-500/5 to-transparent"
                        : "from-orange-500/16 via-orange-500/5 to-transparent";

                  return (
                    <div
                      key={rank}
                      className={`relative overflow-hidden rounded-[1.5rem] border bg-[#080d19]/80 ${accent} ${isFirst ? "sm:-translate-y-2" : ""}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-b ${glow}`} />
                      <div
                        className="absolute inset-0 opacity-80"
                        style={{
                          backgroundImage: `linear-gradient(to bottom, rgba(2,6,23,.18), rgba(2,6,23,.88)), url(${isFirst ? "/stadium-gold-bg.png" : "/stadium-bg.jpg"})`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                      />

                      <div className="relative flex min-h-[265px] flex-col items-center justify-end px-4 pb-5 pt-5 text-center sm:min-h-[300px] lg:min-h-[330px]">
                        <div className={`absolute left-4 top-4 font-display text-5xl font-black italic leading-none ${isFirst ? "text-amber-300" : isSecond ? "text-sky-200" : "text-orange-200"}`}>
                          {rank}
                        </div>

                        <div className="mb-2 grid size-11 place-items-center rounded-full border-2 border-white/20 bg-black/35 text-lg shadow-lg backdrop-blur-md sm:size-12">
                          {isFirst ? "🏆" : rank === 2 ? "🥈" : "🥉"}
                        </div>

                        <div className={`relative size-20 overflow-hidden rounded-full border-2 bg-slate-900 shadow-[0_0_28px_rgba(255,255,255,.12)] sm:size-24 ${isFirst ? "border-amber-300" : isSecond ? "border-sky-300" : "border-orange-300"}`}>
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center font-display text-xl font-black text-white">
                              {(p.pseudo || "J").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex max-w-full items-center justify-center gap-2">
                          <span className="truncate font-display text-lg font-black text-white sm:text-xl">
                            {p.pseudo || "Joueur"}
                          </span>
                          {p.favoriteTeam && <TeamCrest team={p.favoriteTeam} size="size-6" />}
                        </div>

                        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] font-black uppercase tracking-wider ${isFirst ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : isSecond ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "border-orange-400/30 bg-orange-400/10 text-orange-300"}`}>
                          <span>{p.careerLevel}</span>
                          <span>•</span>
                          <span>{p.careerTitle}</span>
                        </div>

                        <div className="mt-4 flex items-end justify-center gap-1">
                          <span className={`font-display text-4xl font-black leading-none sm:text-5xl ${isFirst ? "text-amber-300" : "text-white"}`}>
                            {p.points}
                          </span>
                          <span className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">PTS</span>
                        </div>

                        <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-slate-300">
                          {p.exactScores} EXacts
                        </div>
                      </div>

                      <div className={`relative h-2 ${isFirst ? "bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,.7)]" : isSecond ? "bg-sky-400 shadow-[0_0_18px_rgba(14,165,233,.55)]" : "bg-orange-400 shadow-[0_0_18px_rgba(249,115,22,.55)]"}`} />
                    </div>
                  );
                })}
              </div>
            </section>
'@

$oldPodiumPattern = '(?s)\s*<PodiumBoard\s+positions=\{podiumData\}\s+viewerTheme=\{viewerTheme\}\s*/>'

if ($content -match $oldPodiumPattern) {
    $content = [regex]::Replace($content, $oldPodiumPattern, "`r`n" + $podium.Trim())
    Write-Host "OK : ancien PodiumBoard remplace par le podium premium." -ForegroundColor Green
}
elseif ($content -match 'PODIUM PREMIUM') {
    Write-Host "OK : podium premium deja present." -ForegroundColor Green
}
else {
    Copy-Item $backup $rankingFile -Force
    throw "Aucun bloc podium reconnu. Fichier restaure."
}

# ============================================================
# 3) GRAND BLOC #4+
#    Si deja present : on le garde.
#    Sinon, on remplace l'ancien bloc PlayerCard simple.
# ============================================================
if ($content -match 'max-w-6xl[^\\r\\n]*rounded-\[2rem\][^\\r\\n]*PlayerCard' -or
    $content -match 'LISTE DES AUTRES JOUEURS \(#4\+\)') {
    Write-Host "OK : grand bloc classement #4+ deja present." -ForegroundColor Green
}
else {
    $newList = @'
            {others.length > 0 && (
              <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#070d19]/78 p-3 shadow-[0_25px_70px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,.08),transparent_35%)]" />

                <div className="relative mb-3 hidden grid-cols-[56px_minmax(0,1fr)_90px_75px_95px_55px] items-center gap-3 border-b border-white/10 px-3 pb-3 font-mono text-[8px] font-bold uppercase tracking-[.18em] text-slate-500 sm:grid lg:grid-cols-[64px_minmax(0,1fr)_105px_90px_110px_65px]">
                  <span>#</span>
                  <span>Joueur</span>
                  <span className="text-center text-amber-300/80">Points</span>
                  <span className="text-center">Exacts</span>
                  <span className="text-center">Rég.</span>
                  <span className="text-right">Évol.</span>
                </div>

                <div className="relative space-y-2.5 sm:space-y-2">
                  {others.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={toCardData(p, teamsById)}
                      isMe={p.id === user?.id}
                      viewerTheme={viewerTheme}
                      badges={cardBadges(p, bestExactScorePlayerId)}
                    />
                  ))}
                </div>
              </section>
            )}
'@

    $listPattern = '(?s)\{others\.length\s*>\s*0\s*&&\s*\(\s*<section\b.*?</section>\s*\)\}'
    $listMatch = [regex]::Match($content, $listPattern)

    if (!$listMatch.Success) {
        Copy-Item $backup $rankingFile -Force
        throw "Bloc liste #4+ introuvable. Fichier restaure."
    }

    $content = $content.Substring(0, $listMatch.Index) + $newList.Trim() + $content.Substring($listMatch.Index + $listMatch.Length)
    Write-Host "OK : grand bloc classement #4+ cree." -ForegroundColor Green
}

# ============================================================
# 4) Ecriture
# ============================================================
Set-Content $rankingFile $content -Encoding UTF8

# ============================================================
# 5) VERIFICATIONS EXPLICITES
#    Pas de tableau PowerShell ambigu : chaque test est independant.
# ============================================================
$check = Get-Content $rankingFile -Raw

if ($check -notmatch 'PODIUM PREMIUM') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : PODIUM PREMIUM absent. Fichier restaure."
}
Write-Host "OK : podium premium." -ForegroundColor Green

if ($check -notmatch 'stadium-gold-bg\.png') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : fond stade absent. Fichier restaure."
}
Write-Host "OK : fond stade." -ForegroundColor Green

if ($check -notmatch 'p\.avatarUrl') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : photo de profil absente. Fichier restaure."
}
Write-Host "OK : photo de profil." -ForegroundColor Green

if ($check -notmatch 'TeamCrest') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : logo club absent. Fichier restaure."
}
Write-Host "OK : logo club choisi." -ForegroundColor Green

if ($check -notmatch 'p\.careerLevel' -or $check -notmatch 'p\.careerTitle') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : niveau/titre carrière absent. Fichier restaure."
}
Write-Host "OK : niveau + titre." -ForegroundColor Green

if ($check -notmatch 'p\.points') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : points absents. Fichier restaure."
}
Write-Host "OK : points mis en avant." -ForegroundColor Green

if ($check -notmatch 'max-w-6xl') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : grand bloc classement absent. Fichier restaure."
}
Write-Host "OK : grand bloc classement." -ForegroundColor Green

if ($check -notmatch '<PlayerCard') {
    Copy-Item $backup $rankingFile -Force
    throw "Verification echouee : PlayerCard absent. Fichier restaure."
}
Write-Host "OK : PlayerCard conserve." -ForegroundColor Green

# ============================================================
# 6) BUILD
# ============================================================
Write-Host ""
Write-Host "=== BUILD ===" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Copy-Item $backup $rankingFile -Force
    throw "BUILD echoue. Fichier restaure."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " CLASSEMENT PREMIUM IDENTIQUE : BUILD OK !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Podium stade : OUI"
Write-Host "Photos de profil : OUI"
Write-Host "Logo club choisi : OUI"
Write-Host "Niveau + titre : OUI"
Write-Host "Points mis en avant : OUI"
Write-Host "Grand bloc classement : OUI"
Write-Host ""
Write-Host "Sauvegarde : $backup" -ForegroundColor DarkGray
