import React, { useMemo, useState } from "react";

type TeamLogoProps = {
  name: string;
  logoUrl?: string | null;
  /** Code football-data.org : FL1, PL, PD, SA, BL1 */
  competition?: string | null;
  size?: number;
  className?: string;
};

type LogoLeague = "ligue1" | "Premier league" | "Liga" | "Serie A" | "Bundesliga";

const LEAGUE_FOLDERS: Record<string, LogoLeague> = {
  FL1: "ligue1",
  L1: "ligue1",
  LIGUE1: "ligue1",
  PL: "Premier league",
  PREMIERLEAGUE: "Premier league",
  "PREMIER LEAGUE": "Premier league",
  PD: "Liga",
  LIGA: "Liga",
  LALIGA: "Liga",
  SA: "Serie A",
  SERIEA: "Serie A",
  "SERIE A": "Serie A",
  BL1: "Bundesliga",
  BUNDESLIGA: "Bundesliga",
};

const TEAM_LOGOS: Record<LogoLeague, Record<string, string>> = {
  ligue1: {
    angers: "angers.png",
    auxerre: "auxerre.png",
    brest: "brest.png",
    lehavre: "lehavre.png",
    "le havre": "lehavre.png",
    lemans: "lemans.png",
    "le mans": "lemans.png",
    lens: "lens.png",
    lille: "lille.png",
    lorient: "lorient.png",
    monaco: "monaco.png",
    nice: "nice.png",
    lyon: "ol.png",
    "olympique lyonnais": "ol.png",
    marseille: "om.png",
    "olympique de marseille": "om.png",
    parisfc: "parisfc.png",
    "paris fc": "parisfc.png",
    psg: "psg.png",
    "paris saint germain": "psg.png",
    rennes: "rennes.png",
    strasbourg: "strasbourg.png",
    toulouse: "tfc.png",
    troyes: "troyes.png",
  },
  "Premier league": {
    arsenal: "arsenal.png",
    "arsenal fc": "arsenal.png",
    astonvilla: "astonvilla.png",
    "aston villa": "astonvilla.png",
    bournemouth: "bournemouth.png",
    brentford: "brentford.png",
    brighton: "brighton.png",
    chelsea: "chelsea.png",
    coventry: "coventry.png",
    "crystal palace": "crystalpalace.png",
    everton: "everton.png",
    fulham: "fulham.png",
    "nottingham forest": "forest.png",
    forest: "forest.png",
    hull: "hull.png",
    "hull city": "hull.png",
    ipswich: "ipswich.png",
    leeds: "leeds.png",
    liverpool: "liverpool.png",
    "manchester city": "mancity.png",
    mancity: "mancity.png",
    "manchester united": "manunited.png",
    manunited: "manunited.png",
    newcastle: "newcastle.png",
    "newcastle united": "newcastle.png",
    sunderland: "sunderland.png",
    tottenham: "tottenham.png",
    "tottenham hotspur": "tottenham.png",
  },
  Liga: {
    alaves: "alaves.png",
    athletic: "athletic.png",
    "athletic bilbao": "athletic.png",
    atletico: "atletico.png",
    "atletico madrid": "atletico.png",
    barcelona: "barcelona.png",
    betis: "betis.png",
    celta: "celta.png",
    coruna: "coruna.png",
    "deportivo la coruna": "coruna.png",
    elche: "elche.png",
    espanyol: "espanyol.png",
    getafe: "getafe.png",
    "real madrid": "realmadrid.png",
    realmadrid: "realmadrid.png",
    levante: "levante.png",
    malaga: "malaga.png",
    osasuna: "osasuna.png",
    racing: "racing.png",
    rayo: "rayo.png",
    "rayo vallecano": "rayo.png",
    realsociedad: "realsociedad.png",
    "real sociedad": "realsociedad.png",
    sevilla: "sevilla.png",
    valencia: "valencia.png",
    villarreal: "villarreal.png",
  },
  "Serie A": {
    atalanta: "atalanta.png",
    bologna: "bologna.png",
    cagliari: "cagliari.png",
    como: "como.png",
    fiorentina: "fiorentina.png",
    frosinone: "frosinone.png",
    genoa: "genoa.png",
    inter: "inter.png",
    "inter milan": "inter.png",
    internazionale: "inter.png",
    juventus: "juventus.png",
    lazio: "lazio.png",
    lecce: "lecce.png",
    milan: "milan.png",
    monza: "monza.png",
    napoli: "napoli.png",
    parma: "parma.png",
    roma: "roma.png",
    sassuolo: "sassuolo.png",
    torino: "torino.png",
    udinese: "udinese.png",
    venezia: "venezia.png",
  },
  Bundesliga: {
    augsburg: "augsburg.png",
    bayern: "bayern.png",
    "bayern munich": "bayern.png",
    "bayern munchen": "bayern.png",
    bremen: "bremen.png",
    "werder bremen": "bremen.png",
    dortmund: "dortmund.png",
    "borussia dortmund": "dortmund.png",
    elversberg: "elversberg.png",
    frankfurt: "frankfurt.png",
    "eintracht frankfurt": "frankfurt.png",
    freiburg: "freiburg.png",
    gladbach: "gladbach.png",
    "borussia monchengladbach": "gladbach.png",
    hamburg: "hamburg.png",
    hoffenheim: "hoffenheim.png",
    koln: "koln.png",
    "fc koln": "koln.png",
    leipzig: "leipzig.png",
    "rb leipzig": "leipzig.png",
    leverkusen: "leverkusen.png",
    "bayer leverkusen": "leverkusen.png",
    mainz: "mainz.png",
    paderborn: "paderborn.png",
    schalke: "schalke.png",
    stuttgart: "stuttgart.png",
    "vfb stuttgart": "stuttgart.png",
    unionberlin: "unionberlin.png",
    "union berlin": "unionberlin.png",
  },
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/football club|fc|club|stade|sporting|cf|ss|bc/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function initials(name: string): string {
  const clean = normalize(name);
  if (!clean) return "??";

  const words = clean.split(" ").filter(Boolean);
  const ignored = new Set([
    "as", "aj", "rc", "fc", "ogc", "estac", "losc",
    "olympique", "stade", "le", "the", "afc",
  ]);

  const useful = words.filter((word) => !ignored.has(word));
  const source = useful.length ? useful : words;

  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return `${source[0][0]}${source[1][0]}`.toUpperCase();
}

function inferLeague(name: string): LogoLeague | null {
  const key = normalize(name).replace(/ /g, "");

  for (const [league, teams] of Object.entries(TEAM_LOGOS) as [
    LogoLeague,
    Record<string, string>,
  ][]) {
    if (Object.keys(teams).some((team) => normalize(team).replace(/ /g, "") === key)) {
      return league;
    }
  }

  return null;
}

export default function TeamLogo({
  name,
  logoUrl,
  competition,
  size = 40,
  className = "",
}: TeamLogoProps) {
  const [remoteBroken, setRemoteBroken] = useState(false);

  const localLogo = useMemo(() => {
    const league =
      (competition && LEAGUE_FOLDERS[String(competition).toUpperCase()]) ||
      inferLeague(name);

    if (!league) return null;

    const teams = TEAM_LOGOS[league];
    const normalizedName = normalize(name);

    const exact = Object.entries(teams).find(
      ([team]) => normalize(team) === normalizedName,
    );

    const compactName = normalizedName.replace(/ /g, "");
    const compact = Object.entries(teams).find(
      ([team]) => normalize(team).replace(/ /g, "") === compactName,
    );

    const filename = exact?.[1] ?? compact?.[1];
    if (!filename) return null;

    return `/logos/${encodeURIComponent(league)}/${filename}`;
  }, [competition, name]);

  const showRemote = Boolean(logoUrl) && !remoteBroken;
  const [localBroken, setLocalBroken] = useState(false);
  const showFallback = !showRemote && (!localLogo || localBroken);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-slate-800 border border-slate-700 ${className}`}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <span className="text-xs font-bold text-white select-none">
          {initials(name)}
        </span>
      ) : showRemote ? (
        <img
          src={logoUrl!}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setRemoteBroken(true)}
        />
      ) : (
        <img
          src={localLogo!}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setLocalBroken(true)}
        />
      )}
    </div>
  );
}