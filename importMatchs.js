import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://azgksiwcgvbertzzzhvq.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_publishable_NwALJ8h6gzAlC-GgiqnFow_Ol45BzTj';
const API_FOOTBALL_KEY = 'REDACTED_FOOTBALL_DATA_TOKEN';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
