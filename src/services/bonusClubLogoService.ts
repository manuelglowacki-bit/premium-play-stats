import { type BonusCompetitionCode } from "./bonusSelectionService";

const LEAGUE_FOLDER: Record<BonusCompetitionCode, string> = {
  PL: "Premier league",
  PD: "Liga",
  SA: "Serie A",
  BL1: "Bundesliga",
};

/** Logo du championnat lui-même (pas un club) — fichier réellement présent
 * dans public/logos/<championnat>/ (vérifié : `ls public/logos/<dossier>`),
 * jamais un nom de fichier inventé. Fiable et toujours disponible (asset
 * local servi par Vite), contrairement à l'emblem football-data.org qui
 * dépend d'un appel réseau encore possiblement pas chargé au moment de
 * l'affichage. */
export const BONUS_LEAGUE_LOGO: Record<BonusCompetitionCode, string> = {
  PL: "/logos/Premier league/premierleague.png",
  PD: "/logos/Liga/laliga.png",
  SA: "/logos/Serie A/seriea.png",
  BL1: "/logos/Bundesliga/bundesliga.png",
};

/**
 * SOURCE UNIQUE DES BLASONS BONUS
 * Basé sur le mapping TeamLogo.tsx existant + les appellations réellement
 * utilisées dans les calendriers bonus 2026-2027.
 *
 * Toutes les variantes ci-dessous pointent vers le fichier local réellement
 * prévu dans public/logos/<championnat>/.
 */

const CLUBS: Record<BonusCompetitionCode, Record<string, string>> = {
  // ============================================================
  // PREMIER LEAGUE
  // ============================================================
  PL: {
    arsenal: "arsenal.png",
    "arsenal fc": "arsenal.png",

    astonvilla: "astonvilla.png",
    "aston villa": "astonvilla.png",
    "aston villa fc": "astonvilla.png",

    bournemouth: "bournemouth.png",
    "afc bournemouth": "bournemouth.png",
    "bournemouth fc": "bournemouth.png",

    brentford: "brentford.png",
    "brentford fc": "brentford.png",

    brighton: "brighton.png",
    "brighton fc": "brighton.png",
    "brighton hove albion": "brighton.png",
    "brighton and hove albion": "brighton.png",
    "brighton & hove albion": "brighton.png",
    "brighton and hove albion fc": "brighton.png",
    "brighton & hove albion fc": "brighton.png",

    chelsea: "chelsea.png",
    "chelsea fc": "chelsea.png",

    coventry: "coventry.png",
    "coventry city": "coventry.png",
    "coventry city fc": "coventry.png",

    "crystal palace": "crystalpalace.png",
    "crystal palace fc": "crystalpalace.png",

    everton: "everton.png",
    "everton fc": "everton.png",

    fulham: "fulham.png",
    "fulham fc": "fulham.png",

    hull: "hull.png",
    "hull city": "hull.png",
    "hull city fc": "hull.png",

    ipswich: "ipswich.png",
    "ipswich town": "ipswich.png",
    "ipswich town fc": "ipswich.png",

    leeds: "leeds.png",
    "leeds united": "leeds.png",
    "leeds united fc": "leeds.png",

    liverpool: "liverpool.png",
    "liverpool fc": "liverpool.png",

    "manchester city": "mancity.png",
    mancity: "mancity.png",
    "manchester city fc": "mancity.png",

    "manchester united": "manunited.png",
    manunited: "manunited.png",
    "manchester united fc": "manunited.png",
    "man utd": "manunited.png",

    newcastle: "newcastle.png",
    "newcastle united": "newcastle.png",
    "newcastle united fc": "newcastle.png",

    "nottingham forest": "forest.png",
    forest: "forest.png",
    "nottingham forest fc": "forest.png",

    sunderland: "sunderland.png",
    "sunderland afc": "sunderland.png",

    tottenham: "tottenham.png",
    "tottenham hotspur": "tottenham.png",
    "tottenham hotspur fc": "tottenham.png",

    // Appellations supplémentaires déjà rencontrées dans les sélections bonus.
    "west ham": "westham.png",
    "west ham united": "westham.png",
    "west ham united fc": "westham.png",

    "west brom": "westbrom.png",
    "west bromwich": "westbrom.png",
    "west bromwich albion": "westbrom.png",
    "west bromwich albion fc": "westbrom.png",

    burnley: "burnley.png",
    "burnley fc": "burnley.png",

    watford: "watford.png",
    "watford fc": "watford.png",

    "norwich city": "norwich.png",
    "norwich city fc": "norwich.png",

    "sheffield united": "sheffieldunited.png",
    "sheffield united fc": "sheffieldunited.png",

    "sheffield wednesday": "sheffieldwednesday.png",
    "sheffield wednesday fc": "sheffieldwednesday.png",

    middlesbrough: "middlesbrough.png",
    "middlesbrough fc": "middlesbrough.png",

    "queens park rangers": "qpr.png",
    qpr: "qpr.png",

    "stoke city": "stoke.png",
    "stoke city fc": "stoke.png",

    "swansea city": "swansea.png",
    "swansea city fc": "swansea.png",

    "cardiff city": "cardiff.png",
    "cardiff city fc": "cardiff.png",

    "bristol city": "bristolcity.png",
    "bristol city fc": "bristolcity.png",

    "preston north end": "preston.png",
    "blackburn rovers": "blackburn.png",
    "derby county": "derby.png",
    millwall: "millwall.png",
  },

  // ============================================================
  // LA LIGA
  // ============================================================
  PD: {
    alaves: "alaves.png",
    "deportivo alaves": "alaves.png",

    athletic: "athletic.png",
    "athletic bilbao": "athletic.png",
    "athletic club": "athletic.png",

    atletico: "atletico.png",
    "atletico madrid": "atletico.png",
    "club atletico de madrid": "atletico.png",

    barcelona: "barcelona.png",
    "fc barcelona": "barcelona.png",

    betis: "betis.png",
    "real betis": "betis.png",
    "real betis balompie": "betis.png",
    "real betis seville": "betis.png",

    celta: "celta.png",
    "rc celta de vigo": "celta.png",
    "rc celta vigo": "celta.png",
    "celta vigo": "celta.png",

    coruna: "coruna.png",
    "deportivo la coruna": "coruna.png",
    "rc deportivo la coruna": "coruna.png",
    "rc deportivo": "coruna.png",
    deportivo: "coruna.png",

    elche: "elche.png",
    "elche cf": "elche.png",

    espanyol: "espanyol.png",
    "espanyol barcelona": "espanyol.png",
    "rcd espanyol": "espanyol.png",
    "rcd espanyol de barcelona": "espanyol.png",

    getafe: "getafe.png",
    "getafe cf": "getafe.png",

    "real madrid": "realmadrid.png",
    realmadrid: "realmadrid.png",
    "real madrid cf": "realmadrid.png",

    levante: "levante.png",
    "levante ud": "levante.png",
    "levante union deportiva": "levante.png",

    malaga: "malaga.png",
    "malaga cf": "malaga.png",

    osasuna: "osasuna.png",
    "ca osasuna": "osasuna.png",

    racing: "racing.png",
    "racing santander": "racing.png",
    "real racing club": "racing.png",
    "real racing club de santander": "racing.png",

    rayo: "rayo.png",
    "rayo vallecano": "rayo.png",
    "rayo vallecano de madrid": "rayo.png",

    realsociedad: "realsociedad.png",
    "real sociedad": "realsociedad.png",
    "real sociedad san sebastian": "realsociedad.png",
    // Nom officiel exact renvoyé par football-data.org (confirmé en base,
    // colonne matches.home_team/away_team) : "Real Sociedad de Fútbol".
    "real sociedad de futbol": "realsociedad.png",

    sevilla: "sevilla.png",
    "sevilla fc": "sevilla.png",

    valencia: "valencia.png",
    "valencia cf": "valencia.png",

    villarreal: "villarreal.png",
    "villarreal cf": "villarreal.png",
  },

  // ============================================================
  // SERIE A
  // ============================================================
  SA: {
    atalanta: "atalanta.png",
    "atalanta bc": "atalanta.png",

    bologna: "bologna.png",
    "bologna fc": "bologna.png",
    // Nom officiel exact renvoyé par football-data.org (confirmé en base) :
    // "Bologna FC 1909" — le suffixe "1909" n'est pas un préfixe de club
    // connu, donc pas retiré par aliases(), d'où l'entrée dédiée.
    "bologna fc 1909": "bologna.png",

    cagliari: "cagliari.png",
    "cagliari calcio": "cagliari.png",

    como: "como.png",
    "como 1907": "como.png",

    fiorentina: "fiorentina.png",
    "acf fiorentina": "fiorentina.png",

    frosinone: "frosinone.png",
    "frosinone calcio": "frosinone.png",

    genoa: "genoa.png",
    "genoa cfc": "genoa.png",
    "genoa cricket football club": "genoa.png",

    inter: "inter.png",
    "inter milan": "inter.png",
    "inter milano": "inter.png",
    internazionale: "inter.png",
    "fc internazionale": "inter.png",
    // Nom officiel exact renvoyé par football-data.org (confirmé en base) :
    // "FC Internazionale Milano" — "milano" en suffixe n'est pas retiré par
    // aliases() (seuls des préfixes de type club sont retirés).
    "fc internazionale milano": "inter.png",

    juventus: "juventus.png",
    "juventus fc": "juventus.png",
    "juventus turin": "juventus.png",
    "juventus torino": "juventus.png",

    lazio: "lazio.png",
    "ss lazio": "lazio.png",
    "lazio rome": "lazio.png",

    lecce: "lecce.png",
    "us lecce": "lecce.png",

    milan: "milan.png",
    "ac milan": "milan.png",
    "ac milan spa": "milan.png",

    monza: "monza.png",
    "ac monza": "monza.png",

    napoli: "napoli.png",
    "ssc napoli": "napoli.png",

    parma: "parma.png",
    "parma calcio": "parma.png",
    "parma calcio 1913": "parma.png",

    roma: "roma.png",
    "as roma": "roma.png",

    sassuolo: "sassuolo.png",
    "sassuolo calcio": "sassuolo.png",
    "us sassuolo calcio": "sassuolo.png",

    torino: "torino.png",
    "torino fc": "torino.png",

    udinese: "udinese.png",
    "udinese calcio": "udinese.png",

    venezia: "venezia.png",
    "venezia fc": "venezia.png",
    "venezia calcio": "venezia.png",
  },

  // ============================================================
  // BUNDESLIGA
  // ============================================================
  BL1: {
    augsburg: "augsburg.png",
    "fc augsburg": "augsburg.png",

    bayern: "bayern.png",
    "fc bayern": "bayern.png",
    "fc bayern munchen": "bayern.png",
    "fc bayern münchen": "bayern.png",
    "bayern munich": "bayern.png",
    "bayern munich fc": "bayern.png",

    bremen: "bremen.png",
    "werder bremen": "bremen.png",
    "sv werder bremen": "bremen.png",

    dortmund: "dortmund.png",
    "borussia dortmund": "dortmund.png",

    elversberg: "elversberg.png",
    "sv elversberg": "elversberg.png",
    // Nom officiel exact renvoyé par football-data.org (confirmé en base) :
    // "SV 07 Elversberg" — le "07" au milieu du nom n'est pas retiré par
    // aliases() (seuls des mots-préfixes connus sont retirés, pas un
    // nombre isolé), d'où l'entrée dédiée.
    "sv 07 elversberg": "elversberg.png",

    frankfurt: "frankfurt.png",
    "eintracht frankfurt": "frankfurt.png",

    freiburg: "freiburg.png",
    "sc freiburg": "freiburg.png",
    "sport club freiburg": "freiburg.png",
    "sport-club freiburg": "sportclubfreiburg.png",

    gladbach: "gladbach.png",
    "borussia monchengladbach": "gladbach.png",
    "borussia mönchengladbach": "gladbach.png",

    hamburg: "hamburg.png",
    "hamburger sv": "hamburg.png",

    hoffenheim: "hoffenheim.png",
    "tsg hoffenheim": "hoffenheim.png",
    "tsg 1899 hoffenheim": "hoffenheim.png",

    koln: "koln.png",
    köln: "koln.png",
    "fc koln": "koln.png",
    "1 fc koln": "koln.png",
    "1 fc köln": "koln.png",

    leipzig: "leipzig.png",
    "rb leipzig": "leipzig.png",
    "rasenballsport leipzig": "leipzig.png",

    leverkusen: "leverkusen.png",
    "bayer leverkusen": "leverkusen.png",
    "bayer 04 leverkusen": "leverkusen.png",

    mainz: "mainz.png",
    "fsv mainz 05": "mainz.png",
    "1 fsv mainz 05": "mainz.png",

    paderborn: "paderborn.png",
    "sc paderborn 07": "paderborn.png",

    schalke: "schalke.png",
    "fc schalke 04": "schalke.png",

    stuttgart: "stuttgart.png",
    "vfb stuttgart": "stuttgart.png",

    unionberlin: "unionberlin.png",
    "union berlin": "unionberlin.png",
    "1 fc union berlin": "unionberlin.png",

  },
};

function normalizeClubName(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/&/g, " and ")
    .replace(/\./g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeClubName(value).replace(/\s+/g, "");
}

function aliases(value: string): string[] {
  const normalized = normalizeClubName(value);
  const set = new Set<string>();

  if (normalized) set.add(normalized);
  set.add(compact(value));

  // Retire les préfixes de type "FC", "AFC", "CF", "AC", etc.
  const simplified = normalized
    .replace(/\b(fc|afc|cf|cfc|bc|ac|rc|sc|ss|us|as|ca|rcd|rb|sv|tsg|vfb)\b/g, " ")
    .replace(/\b(football club|club de futbol|calcio|calcio srl)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (simplified) {
    set.add(simplified);
    set.add(simplified.replace(/\s+/g, ""));
  }

  return [...set];
}

export function resolveBonusClubLogo(
  clubName: string | null | undefined,
  code: BonusCompetitionCode,
): string | null {
  if (!clubName) return null;

  const map = CLUBS[code];
  const variants = aliases(clubName);

  // Correspondance directe.
  for (const variant of variants) {
    const filename = map[variant];
    if (filename) {
      return `/logos/${LEAGUE_FOLDER[code]}/${filename}`;
    }
  }

  // Correspondance compacte de sécurité.
  const compactVariants = new Set(variants.map((value) => value.replace(/\s+/g, "")));

  const found = Object.entries(map).find(([key]) =>
    compactVariants.has(key.replace(/\s+/g, "")),
  );

  return found ? `/logos/${LEAGUE_FOLDER[code]}/${found[1]}` : null;
}