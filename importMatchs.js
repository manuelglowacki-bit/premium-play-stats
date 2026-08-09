import { createClient } from '@supabase/supabase-js';

// Charge .env si présent (Node >= 20.6). Ignoré silencieusement si absent :
// le script marche aussi si les variables sont déjà exportées dans le shell.
try {
  process.loadEnvFile();
} catch {
  // pas de .env à charger, ou API non disponible sur cette version de Node
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
// Note : ce script appelle v3.football.api-sports.io (x-apisports-key), pas
// football-data.org — mais réutilise la même variable d'environnement que le
// reste du projet pour rester cohérent avec un seul token configuré.
const API_FOOTBALL_KEY = process.env.FOOTBALL_DATA_API_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !API_FOOTBALL_KEY) {
  console.error(
    "Variables manquantes : vérifie VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et FOOTBALL_DATA_API_TOKEN dans .env.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const teamNameMapping = {
  "Lens": "RCL",
  "Paris Saint Germain": "PSG",
  "Marseille": "OM",
  "Lyon": "OL",
  "Lille": "LOSC",
  "Monaco": "ASM",
  "Rennes": "SRFC",
  "Nice": "OGCN",
  "Stade Brestois 29": "SB29",
  "Toulouse": "TFC",
  "Strasbourg": "RCSA",
  "Reims": "SDR",
  "Montpellier": "MHSC",
  "Nantes": "FCN",
  "Auxerre": "AJA",
  "Angers": "SCO",
  "Le Havre": "HAC"
};

async function syncMatches() {
  console.log("⚽ Récupération des équipes depuis Supabase...");
  const { data: dbTeams, error: dbError } = await supabase.from('teams').select('id, short_name');
  if (dbError) return console.error("Erreur Supabase équipes :", dbError);

  console.log("🌐 Appel à API-Football pour la Ligue 1 (Saison 2026)...");
  
  const response = await fetch("https://v3.football.api-sports.io/fixtures?league=61&season=2026", {
    method: "GET",
    headers: {
      "x-apisports-key": API_FOOTBALL_KEY
    }
  });
  
  const apiData = await response.json();
  console.log("DEBUG API-Football:", JSON.stringify(apiData, null, 2));
  
  if (!apiData.response || apiData.response.length === 0) {
    console.error("⚠️ Aucun match retourné par l'API.");
    return;
  }

  const matches = apiData.response;
  console.log(`✅ ${matches.length} matchs trouvés ! Insertion dans Supabase...`);

  let insertedCount = 0;

  for (const match of matches) {
    const apiHomeName = match.teams.home.name;
    const apiAwayName = match.teams.away.name;

    const homeTeam = dbTeams.find(t => t.short_name === teamNameMapping[apiHomeName]);
    const awayTeam = dbTeams.find(t => t.short_name === teamNameMapping[apiAwayName]);

    if (!homeTeam || !awayTeam) continue;

    const matchDayStr = match.league.round.split(' - ')[1];
    const matchDay = parseInt(matchDayStr, 10);

    const { error } = await supabase.from('matches').upsert({
      api_fixture_id: match.fixture.id,
      match_day: matchDay,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      kickoff_time: match.fixture.date,
      status: match.fixture.status.short,
      home_score: match.goals.home,
      away_score: match.goals.away
    }, { onConflict: 'api_fixture_id' });

    if (!error) insertedCount++;
  }

  console.log(`🚀 Terminé ! ${insertedCount} matchs importés.`);
}

syncMatches();
