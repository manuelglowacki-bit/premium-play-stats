import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import { InstallerApplication } from "@/components/prono/InstallerApplication";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ongletVisible } from "@/lib/ongletVisible";
import { numeroDeJournee } from "@/lib/numeroJournee";
import { resizeImageToDataUrl } from "@/lib/resizeImage";
import {
  Trophy,
  Medal,
  ArrowRight,
  Camera,
  Heart,
  Check,
  ChevronRight,
  Sparkles,
  Star,
  Target
} from "lucide-react";
import { CountdownBlocks } from "@/components/prono/Countdown";
import { useTeamTheme } from "@/hooks/useTeamTheme";
import { calculateCareerScore, aggregateCareerStatsByUser, CAREER_LEVEL_TITLES } from "@/lib/careerLevel";
import { lireNiveauMemorise, memoriserNiveau, niveauAAnnoncer } from "@/lib/annonceNiveau";
import { debriefAAnnoncer, lireDebriefVu, memoriserDebriefVu } from "@/lib/annonceDebrief";
import { journeeTerminee } from "@/lib/parcoursSaison";
import { bonusEnVigueurParJournee } from "@/lib/journeeBonus";
import { journeesDeLaSaison } from "@/lib/perimetreClassement";
import { parcoursSaison } from "@/lib/parcoursSaison";
import {
  placeEcrite,
  podiumDuJoueur,
  resumeDuJoueur,
  titrePodium,
  titreResume,
  type PodiumJoueur,
  type ResumePerso,
} from "@/lib/resumePerso";
import { lireResumeVu, memoriserResumeVu, resumeAMontrer } from "@/lib/annonceResume";
import { rankPlayers } from "@/lib/leaderboardRanking";
import { computePrizeByRank } from "@/lib/prizePool";
import { computeLeagueStats } from "@/lib/leaderboardStats";
import { fetchAllRowsCache } from "@/lib/supabaseFetchAll";
import { fetchLiveApiMatches, reconcileMatchesWithLive, markLiveMatchesScorable } from "@/lib/liveMatches";
import { fermetureEnCours } from "@/lib/journeeCourante";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Prono Ligue 1 LM" },
      { name: "description", content: "Tableau de bord principal de ta ligue de pronostics entre amis." },
    ],
  }),
  component: IndexPage,
});

/**
 * Libelles de la repartition des gains. Les MONTANTS, eux, viennent de
 * computePrizeByRank (src/lib/prizePool.ts) et ne sont pas recalcules ici :
 * cette table ne fait que nommer les trois places.
 *
 * Hors du composant : elle ne depend de rien et n'a aucune raison d'etre
 * reconstruite a chaque rendu.
 */
const PODIUM_CAGNOTTE = [
  { rang: 1, medaille: "\u{1F947}", part: "50 %" },
  { rang: 2, medaille: "\u{1F948}", part: "30 %" },
  { rang: 3, medaille: "\u{1F949}", part: "20 %" },
] as const;

function IndexPage() {
  const { favoriteTeamId, saveFavoriteTeam } = useFavoriteTeam();
  const { user, profile, refreshProfile } = useAuth();

  const [teams, setTeams] = useState<any[]>([]);
  const [clubId, setClubId] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  // Verrouillage de l'équipe de cœur : même règle que le Profil,
  // appliquée aussi à l'Accueil pour empêcher tout contournement.
  const [favoriteTeamDeadline, setFavoriteTeamDeadline] = useState<Date | null>(null);
  const [favoriteTeamAutoLock, setFavoriteTeamAutoLock] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myStats, setMyStats] = useState({
    rank: 0,
    points: 0,
    exactScores: 0,
    successRate: 0,
    totalPronos: 0,
    avgPoints: 0,
    bestDay: "-",
    bestDayPoints: 0,
    // Régularité = participation : rencontres pronostiquées sur celles que ce
    // joueur pouvait pronostiquer (voir leaderboardStats.ts).
    participation: 0,
    participationTotal: 0,
  });
  // Vide tant que la vraie journee n'est pas connue : afficher "J1" par
  // defaut affichait une information fausse des la J2, et definitivement si
  // le chargement echouait.
  const [currentMatchday, setCurrentMatchday] = useState("");
  // Prochain coup d'envoi REEL, et journee en cours. Le compte a rebours
  // visait jusqu'ici une date figee dans Countdown.tsx (21 aout 2026) : une
  // fois passee, il affichait 00 00 00 00 indefiniment, sous un libelle
  // "Prochaine journee · J1 • 21 aout 2026" lui aussi ecrit en dur.
  // `mode` distingue les deux echeances possibles : l'ouverture d'une journee
  // a venir, ou la fermeture du prochain match d'une journee deja entamee.
  const [nextKickoff, setNextKickoff] = useState<{
    at: number;
    label: string;
    day: string;
    mode: "ouverture" | "fermeture";
  } | null>(null);
  const [potAmount, setPotAmount] = useState(0);
  // Saison affichee dans le bandeau. Elle etait ecrite en dur
  // ("SAISON 2026—2027") : elle serait restee identique l'an prochain.
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  // Gains affiches a cote du classement : meme regle 50/30/20 que la page
  // Classement (src/lib/prizePool.ts), appliquee a la cagnotte reelle.
  const homePrizeByRank = useMemo(() => computePrizeByRank(potAmount), [potAmount]);
  const [careerLevel, setCareerLevel] = useState(1);
  // Niveau a feliciter, ou null. Rempli une seule fois, au moment ou le
  // niveau REEL est calcule depuis les donnees (voir plus bas) — jamais
  // depuis la valeur initiale de `careerLevel`, qui vaut 1 avant chargement
  // et ferait clignoter une fausse annonce.
  const [niveauFete, setNiveauFete] = useState<number | null>(null);
  // La journee racontee par le Debrief, et celle qu'on annonce (ou null).
  const [journeeDuDebrief, setJourneeDuDebrief] = useState<number | null>(null);
  // « Ta journee » : le resume personnel, et le numero de journee a annoncer.
  const [resumePerso, setResumePerso] = useState<ResumePerso | null>(null);
  // Le podium : l'accueil change d'habit pour les trois premiers.
  const [podium, setPodium] = useState<PodiumJoueur | null>(null);
  const [resumeAnnonce, setResumeAnnonce] = useState<number | null>(null);
  const [debriefAnnonce, setDebriefAnnonce] = useState<number | null>(null);

  // ANNONCE DU DEBRIEF — une fois par journee et par joueur.
  // Le numero est memorise des l'affichage : la banniere ne revient donc
  // pas si le joueur ferme l'application sans cliquer.
  // LA BULLE « TA JOURNEE » — une fois par journee et par joueur, a sa
  // premiere visite apres la fin de la journee. Le numero est memorise DES
  // l'affichage : elle ne revient donc pas si le joueur ferme sans lire.
  useEffect(() => {
    if (!user?.id || !resumePerso) return;
    const aMontrer = resumeAMontrer(resumePerso.journee, lireResumeVu(user.id));
    if (aMontrer === null) return;
    setResumeAnnonce(aMontrer);
    memoriserResumeVu(user.id, aMontrer);
  }, [user?.id, resumePerso]);

  useEffect(() => {
    if (!user?.id || journeeDuDebrief === null) return;
    const aAnnoncer = debriefAAnnoncer(journeeDuDebrief, lireDebriefVu(user.id));
    if (aAnnoncer === null) return;
    setDebriefAnnonce(aAnnoncer);
    memoriserDebriefVu(user.id, aAnnoncer);
  }, [user?.id, journeeDuDebrief]);
  const homeRequestSeq = useRef(0);
  // Les equipes arrivent par une requete separee. Sans ce temoin, on ne peut
  // pas distinguer « pas encore chargees » de « chargees, et il n'y en a
  // aucune » — et le chargement lourd ci-dessous se declenchait donc deux
  // fois : une fois a vide, une fois pour de bon.
  const [equipesChargees, setEquipesChargees] = useState(false);


  // 1. Liste des équipes
  useEffect(() => {
    async function fetchTeams() {
      try {
        const { data } = await supabase
          .from("teams")
          .select("id, name, short_name, logo_url")
          .order("name");
        if (data) setTeams(data);
      } finally {
        // Meme si la requete echoue : sans ce passage a `true`, l'accueil
        // resterait vide pour toujours au lieu de s'afficher sans logos.
        setEquipesChargees(true);
      }
    }
    fetchTeams();
  }, []);

  // 2. Données d’accueil (classement, stats, cagnotte) – robuste
  useEffect(() => {
    // On attend de SAVOIR quelles sont les equipes avant de tout charger.
    // Cet effet depend de `teams`, qui passe de [] a sa vraie valeur : sans
    // cette garde, il tournait une premiere fois pour rien, puis une seconde
    // fois. Mesure a 23 joueurs sur une saison complete : 18 appels et
    // 17 204 lignes de pronostics pour 8 602 reellement necessaires, soit
    // 2,84 Mo au lieu de 1,4. A 200 joueurs, 21 Mo au lieu de 10,6.
    if (!equipesChargees) return;

    let cancelled = false;

    async function fetchHomeData() {
      const requestId = ++homeRequestSeq.current;
      try {
        // On récupère chaque ressource indépendamment pour ne pas tout casser
        const [
          { data: profiles, error: profilesError },
          { data: predictions, error: predictionsError },
          { data: matches, error: matchesError },
          { data: settingsRow, error: settingsError },
          { data: matchdays, error: matchdaysError },
          { data: competitions, error: competitionsError },
          { data: bonusOptionsData, error: bonusOptionsError },
          { data: favoriteHistoryData, error: favoriteHistoryError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            // `username`/`player_name`/`account_status` n'existent pas en
            // base (confirmé via `supabase gen types typescript` : profiles
            // n'a que id/pseudo/avatar_url/favorite_team/favorite_team_id/
            // favorite_team_override/is_admin/created_at/updated_at).
            .select("id,pseudo,avatar_url,favorite_team_id,favorite_team"),
          // `points` n'est plus utilisé pour le calcul (voir plus bas) :
          // cette colonne n'est jamais mise à jour par l'application
          // (column_default 0, aucun trigger, vérifié en base) — les
          // points sont recalculés depuis les résultats réels via
          // computeLeagueStats, la même fonction que le Classement.
          // Paginé : sans .range(), PostgREST tronque silencieusement à 1000
          // lignes (voir src/lib/supabaseFetchAll.ts).
          fetchAllRowsCache(
            "predictions",
            "user_id,match_id,home_prediction,away_prediction,created_at",
            ["user_id", "match_id"],
          ),
          // Paginé pour la même raison (5 championnats = plus de 1000 matchs).
          // L'ordre de pagination doit être stable : `id`, pas `kickoff` (des
          // matchs partagent le même coup d'envoi, la pagination sauterait ou
          // dupliquerait des lignes). L'ancien .order("kickoff") n'était utilisé
          // nulle part : la seule sélection qui dépend d'un ordre, la journée
          // terminée la plus récente, retrie explicitement par numéro de journée.
          fetchAllRowsCache(
            "matches",
            "id,matchday_id,matchday_code,matchday,match_day,status,kickoff,kickoff_time,home_score,away_score,home_team_id,away_team_id,home_team,away_team,is_bonus,finished,api_fixture_id",
            ["id"],
          ),
          // Cagnotte théorique = nombre de joueurs inscrits × droit d'entrée
          // configuré dans Admin → Réglages, JAMAIS basée sur qui a réellement
          // payé (voir Admin → Paiements pour ce suivi individuel, inchangé).
          // `app_settings` est déjà lisible par tout joueur connecté (même
          // table que src/routes/profil.tsx) — pas de nouvelle table/policy.
          supabase
            .from("app_settings")
            .select("season, entry_fee, favorite_team_deadline, favorite_team_auto_lock")
            .eq("id", 1)
            .maybeSingle(),
          supabase
            .from("matchdays")
            // `number`, `deadline` et `deadline_mode` servent au compte a
            // rebours de la journee EN COURS (voir fermetureEnCours).
            .select("id,season_id,season,competition_id,number,deadline,deadline_mode"),
          supabase.from("competitions").select("id, code, external_code"),
          // Actives ET historiques — même raison que classement.tsx : un
          // pronostic bonus reste valable même si l'admin a changé la
          // sélection depuis.
          // `is_active` et `created_at` NE SONT PAS DECORATIFS : ce sont les
          // deux departages de computeLeagueStats quand un meme match bonus
          // porte plusieurs lignes (un tirage rejoue). Sans eux, l'Accueil
          // tombait sur le departage de secours — la comparaison textuelle des
          // identifiants de journee, qui n'a aucun sens metier — pendant que le
          // Classement, lui, prenait bien le tirage actif. Deux pages, le meme
          // moteur, mais pas les memes entrees : des points pouvaient differer.
          supabase.from("bonus_options").select("matchday_id, match_id, is_active, created_at"),
          // Équipe favorite historisée par saison (Lot 4) — voir
          // computeLeagueStats() dans leaderboardStats.ts.
          supabase.from("user_season_favorite_teams").select("user_id, season_id, favorite_team_id"),
        ]);

        // On logue les erreurs individuelles mais on continue
        if (profilesError) console.warn("Erreur chargement profils :", profilesError);
        if (predictionsError) console.warn("Erreur chargement pronostics :", predictionsError);
        if (matchesError) console.warn("Erreur chargement matchs :", matchesError);
        if (settingsError) console.warn("Cagnotte non calculable (réglages) :", settingsError);
        if (competitionsError) console.warn("Erreur chargement compétitions :", competitionsError);
        if (bonusOptionsError) console.warn("Erreur chargement bonus :", bonusOptionsError);
        if (favoriteHistoryError) console.warn("Historique équipe favorite non chargé :", favoriteHistoryError);

        if (cancelled || requestId !== homeRequestSeq.current) return;

        const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
        const teamById = new Map((teams || []).map((t: any) => [t.id, t]));

        // Même source live que le Classement (et toutes les autres pages) :
        // fusion + garde anti-régression + fenêtre "match commencé -> scorable"
        // centralisées dans src/lib/liveMatches.ts, jamais dupliquées ici.
        const liveApiMatches = await fetchLiveApiMatches();

        if (cancelled || requestId !== homeRequestSeq.current) return;

        const reconciledMatches = reconcileMatchesWithLive((matches || []) as any[], liveApiMatches);

        // Vue "scorable" dérivée : un match commencé avec un score live
        // devient provisoirement scorable pour computeLeagueStats, sans
        // jamais modifier Supabase (voir markLiveMatchesScorable).
        const liveScoringMatches = markLiveMatchesScorable(reconciledMatches);

        // --- Prochain coup d'envoi + matchs en cours ---
        const now = Date.now();
        const kickoffOf = (m: any) => {
          const value = m?.kickoff ?? m?.kickoff_time;
          const time = value ? new Date(value).getTime() : NaN;
          return Number.isFinite(time) ? time : null;
        };

        // ------------------------------------------------------------------
        // OUVERTURE DE LA PROCHAINE JOURNEE
        //
        // Les dates viennent de l'API (football-data.org, via
        // /api/ligue1/matchs) et non de Supabase : ce sont les horaires
        // officiels, tenus a jour en cas de report ou de reprogrammation, la
        // ou la base ne contient que ce qui a ete importe le jour de l'import.
        //
        // Le compte a rebours vise l'ouverture de la JOURNEE, pas le prochain
        // match : une journee se pronostique en bloc, donc des que son premier
        // match est lance, elle n'est plus a preparer et le compteur bascule
        // sur la suivante. Viser le prochain match ferait au contraire
        // redemarrer un decompte entre chaque rencontre d'une journee entamee.
        // ------------------------------------------------------------------
        const firstKickoffByDay = new Map<number, number>();

        (liveApiMatches || []).forEach((m: any) => {
          // Ligue 1 uniquement : les matchs bonus appartiennent aux quatre
          // autres championnats et portent leurs propres numeros de journee,
          // ce qui ferait viser une date etrangere au calendrier.
          if (String(m?.competitionCode ?? "") !== "FL1") return;

          const journee = Number(m?.journee ?? 0);
          if (!Number.isFinite(journee) || journee <= 0) return;

          const at = m?.kickoff ? new Date(String(m.kickoff)).getTime() : NaN;
          if (!Number.isFinite(at)) return;

          const known = firstKickoffByDay.get(journee);
          if (known === undefined || at < known) firstKickoffByDay.set(journee, at);
        });

        // Repli si l'API n'a rien renvoye (reseau, quota) : on repart du
        // calendrier Supabase plutot que de vider le bloc.
        // La reference reste LE PREMIER MATCH DE LIGUE 1 de la journee : le
        // filtre is_bonus ecarte ici les matchs des quatre autres
        // championnats, comme le filtre competitionCode === "FL1" le fait sur
        // le chemin API. Sans lui, un match bonus programme plus tot aurait
        // fixe l'ouverture de la journee sur ce chemin-la.
        if (firstKickoffByDay.size === 0) {
          (reconciledMatches || []).forEach((m: any) => {
            if (m?.is_bonus === true) return;
            const at = kickoffOf(m);
            const journee = numeroDeJournee(m);
            if (at === null || !Number.isFinite(journee) || journee <= 0) return;
            const known = firstKickoffByDay.get(journee);
            if (known === undefined || at < known) firstKickoffByDay.set(journee, at);
          });
        }

        // Premiere journee dont le coup d'envoi n'est pas encore passe.
        const nextDay = [...firstKickoffByDay.entries()]
          .filter(([, at]) => at > now)
          .sort((a, b) => a[1] - b[1])[0];

        const quand = (at: number) => {
          const dateLabel = new Date(at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          });
          const timeLabel = new Date(at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          // `label` ne porte QUE la date : le libelle affiche deja la journee
          // juste avant, les deux se repeteraient.
          return `${dateLabel} à ${timeLabel}`;
        };

        // LA JOURNEE EN COURS PASSE AVANT LA SUIVANTE.
        //
        // `nextDay` ci-dessus ne retient que les journees PAS ENCORE
        // COMMENCEES. Vendredi 20 h 46, la J2 en disparaissait donc — et la
        // page annoncait « ouverture de la J3 dans 6 jours » alors que les
        // joueurs avaient encore neuf matchs a remplir le week-end. Pire, si
        // la J3 n'etait pas encore synchronisee : « Aucun match programme ».
        //
        // Tant qu'un match de la journee entamee peut encore etre joue, c'est
        // LUI l'echeance qui compte. Voir fermetureEnCours
        // (npm run verif-journee-courante).
        const enCours = fermetureEnCours(
          (matchdays ?? []) as any[],
          reconciledMatches as any[],
          now,
        );

        if (enCours) {
          setNextKickoff({
            at: enCours.at,
            label: quand(enCours.at),
            day: `J${enCours.journee}`,
            mode: "fermeture",
          });
        } else if (nextDay) {
          const [journee, at] = nextDay;
          setNextKickoff({ at, label: quand(at), day: `J${journee}`, mode: "ouverture" });
        } else {
          setNextKickoff(null);
        }




        const matchById = new Map(
          reconciledMatches.map((m: any) => [String(m.id), m]),
        );

        // Pas de colonne `exact_score` en base : un pronostic est "exact"
        // quand home_prediction/away_prediction correspondent exactement au
        // score final du match (matches.home_score/away_score). Toujours
        // utilisé tel quel plus bas pour le widget "stats personnelles".
        const isExactPrediction = (p: any) => {
          if (p.home_prediction == null || p.away_prediction == null) return false;
          const m = matchById.get(String(p.match_id));
          if (!m || m.home_score == null || m.away_score == null) return false;
          return (
            Number(p.home_prediction) === Number(m.home_score) &&
            Number(p.away_prediction) === Number(m.away_score)
          );
        };

        // -------- Classement — même moteur que src/routes/classement.tsx --------
        // Identifie les vraies journées Ligue 1 (FL1) de la saison courante,
        // exactement comme classement.tsx, pour isoler les matchs Ligue 1
        // classiques des matchs bonus (qui peuvent appartenir à PL/PD/SA/BL1).
        const ligue1CompetitionIds = new Set(
          (competitions || [])
            .filter((c: any) => c.code === "FL1" || c.external_code === "FL1")
            .map((c: any) => String(c.id)),
        );
        const ligue1MatchdayIds = new Set(
          (matchdays || [])
            .filter((md: any) => !md.competition_id || ligue1CompetitionIds.has(String(md.competition_id)))
            .map((md: any) => String(md.id)),
        );

        const ligue1Matches = (liveScoringMatches || []).filter(
          (m: any) =>
            m.home_score != null &&
            m.away_score != null &&
            m.finished &&
            !m.is_bonus &&
            m.matchday_id &&
            ligue1MatchdayIds.has(String(m.matchday_id)),
        );

        // QUELLE JOURNEE LE DEBRIEF RACONTE-T-IL ?
        //
        // La derniere dont TOUS les matchs sont termines — de Ligue 1 comme
        // bonus. C'est mot pour mot la regle de la page Debrief
        // (src/routes/debrief.tsx) : si les deux pages n'appliquaient pas la
        // meme, l'Accueil annoncerait « le Debrief de la J4 est en ligne »
        // pendant que le Debrief, lui, raconterait encore la J3.
        //
        // `reconciledMatches` et non la base brute : un score arrive par
        // l'API compte, exactement comme sur le Debrief.
        const debriefEtJournees = (() => {
          // MEME PERIMETRE QUE LE DEBRIEF, saison comprise. Sans ce filtre,
          // la banniere comptait les journees de toutes les saisons : elle
          // pouvait annoncer une journee que le Debrief ne raconte pas.
          // Regle partagee — src/lib/perimetreClassement.ts.
          const perimetreSaison = journeesDeLaSaison(
            (matchdays || []) as any[],
            String((settingsRow as any)?.season ?? ""),
          );
          const parJournee = new Map<string, any[]>();

          for (const match of (reconciledMatches || []) as any[]) {
            if (match.is_bonus) continue;
            const id = String(match.matchday_id ?? "");
            if (!id || !ligue1MatchdayIds.has(id) || !perimetreSaison.has(id)) continue;
            parJournee.set(id, [...(parJournee.get(id) ?? []), match]);
          }

          // Les matchs bonus sont rattaches a leur journee de Ligue 1 par
          // bonus_options, jamais par leur propre matchday_id (qui pointe
          // vers le championnat etranger).
          const matchParId = new Map(
            ((reconciledMatches || []) as any[]).map((m: any) => [String(m.id), m]),
          );
          // UN SEUL match bonus par journee : celui du tirage en vigueur.
          // Une journee peut porter plusieurs lignes `bonus_options` quand un
          // retirage n'a pas desactive l'ancienne. Ces anciennes lignes
          // gardent leurs points (c'est le moteur qui tranche, rien ne change
          // ici), mais un match d'un tirage abandonne — qui ne sera
          // peut-etre jamais joue — ne doit pas bloquer la journee pour
          // toujours. Regle partagee avec le Debrief (src/lib/journeeBonus.ts).
          const bonusEnVigueur = bonusEnVigueurParJournee(
            (bonusOptionsData || []) as any[],
          );
          bonusEnVigueur.forEach((matchId, journeeId) => {
            const match = matchParId.get(String(matchId));
            if (!match || !ligue1MatchdayIds.has(journeeId) || !perimetreSaison.has(journeeId)) return;
            const deja = parJournee.get(journeeId) ?? [];
            if (deja.some((m: any) => String(m.id) === String(match.id))) return;
            parJournee.set(journeeId, [...deja, match]);
          });

          const numeroParId = new Map(
            (matchdays || []).map((md: any) => [String(md.id), Number(md.number) || 0]),
          );

          let derniere: number | null = null;
          parJournee.forEach((matchsDeLaJournee, journeeId) => {
            const numero = numeroParId.get(journeeId) ?? 0;
            if (numero < 1) return;
            const termines = matchsDeLaJournee.map((m: any) =>
              Boolean(m.finished) && m.home_score != null && m.away_score != null,
            );
            if (!journeeTerminee(termines)) return;
            if (derniere === null || numero > derniere) derniere = numero;
          });

          // Le detail sort avec le numero : la bulle « Ta journee » se
          // reconstruit sur EXACTEMENT les memes journees que le Debrief,
          // sans refaire ce tri une seconde fois dans son coin.
          return { derniere, parJournee, numeroParId };
        })();

        const journeeDuDebrief = debriefEtJournees.derniere;
        if (!cancelled) setJourneeDuDebrief(journeeDuDebrief);

        const bonusOptions = (bonusOptionsData || []) as { matchday_id: string; match_id: string }[];
        const bonusMatchIds = new Set(bonusOptions.map((o) => String(o.match_id)));
        const bonusMatches = (liveScoringMatches || []).filter(
          (m: any) => m.home_score != null && m.away_score != null && m.finished && bonusMatchIds.has(String(m.id)),
        );

        const teamNameById: Record<string, string | undefined> = {};
        (teams || []).forEach((t: any) => {
          teamNameById[t.id] = t.name;
        });

        const allProfilesForStats = (profiles || []) as Array<{
          id: string;
          favorite_team_id?: string | null;
          favorite_team?: string | null;
        }>;

        // Saison par journée (matchday -> season_id) et équipe favorite
        // HISTORISÉE par saison (Lot 4) — construits AVANT computeLeagueStats
        // pour que le barème favori (2/1/0) d'un pronostic passé utilise le
        // club réellement favori à cette époque, jamais le favori courant.
        const seasonByMatchdayIdMap = new Map<string, string>();
        (matchdays || []).forEach((md: any) => {
          if (!md?.id) return;
          seasonByMatchdayIdMap.set(String(md.id), String(md.season_id || md.season || "unknown"));
        });
        const seasonByMatchdayId: Record<string, string> = Object.fromEntries(seasonByMatchdayIdMap);

        const favoriteTeamBySeason: Record<string, string> = {};
        (favoriteHistoryData ?? []).forEach((row: any) => {
          if (!row?.user_id || !row?.season_id || !row?.favorite_team_id) return;
          favoriteTeamBySeason[`${row.user_id}:${row.season_id}`] = row.favorite_team_id;
        });

        const {
          pointsByUser: rankingPointsByUser,
          predictionsCountByUser: rankingCountByUser,
          exactScoresByUser: rankingExactByUser,
          regularitySuccessByUser: rankingRegularityByUser,
          participationByUser: rankingParticipationByUser,
          participationTotalByUser: rankingParticipationTotalByUser,
          pointsByUserAndMatchday,
          pointsByPredictionKey,
        } = computeLeagueStats(
          ligue1Matches,
          bonusMatches,
          bonusOptions,
          predictions || [],
          allProfilesForStats,
          teamNameById,
          { seasonByMatchdayId, favoriteTeamBySeason },
        );

        // On complète avec les profils manquants (pour les joueurs sans pronos)
        const allUserIds = new Set(Object.keys(rankingPointsByUser));
        (profiles || []).forEach((p: any) => allUserIds.add(p.id));

        const normalizedRankings = Array.from(allUserIds).map((uid) => {
          const p = profileById.get(uid) || {};
          const team = teamById.get(p.favorite_team_id);
          const pseudo = p.pseudo || "Joueur";
          return {
            user_id: uid,
            total_points: rankingPointsByUser[uid] || 0,
            exact_scores: rankingExactByUser[uid] || 0,
            predictions_count: rankingCountByUser[uid] || 0,
            name: pseudo,
            avatar_url: p.avatar_url || "",
            favorite_team: team?.name || "",
            favorite_logo: team?.logo_url || "",
            // Champs canoniques pour rankPlayers (src/lib/leaderboardRanking.ts)
            // — même classement que la page Classement et le Profil.
            points: rankingPointsByUser[uid] || 0,
            exactScores: rankingExactByUser[uid] || 0,
            predictionsCount: rankingCountByUser[uid] || 0,
            regularitySuccess: rankingRegularityByUser[uid] || 0,
            // Départage sur la RÉGULARITÉ affichée (participation), comme le
            // Classement — sans ces champs, rankPlayers retomberait sur
            // l'ancien taux de réussite et l'ordre differerait d'une page a
            // l'autre pour deux joueurs a egalite de points.
            participation: rankingParticipationByUser[uid] || 0,
            participationTotal: rankingParticipationTotalByUser[uid] || 0,
            pseudo,
          };
        });

        // Tri + attribution du rang : source unique de vérité, réutilisée
        // telle quelle par la page Classement et le Profil.
        const rankedRankings = rankPlayers(normalizedRankings);

        // ============================================================
        // « TA JOURNEE » — le resume personnel du joueur connecte
        // ============================================================
        // On rejoue le classement journee par journee (parcoursSaison, celui
        // du Debrief) pour savoir OU en etait chacun la veille : c'est la
        // seule facon de dire « tu as double Untel ». Les points ne sont pas
        // recalcules — ils viennent de pointsByUserAndMatchday, la meme
        // source que le Classement.
        if (journeeDuDebrief && user?.id) {
          const journeesJouees = [...debriefEtJournees.parJournee.entries()]
            .map(([id, matchs]) => ({
              id,
              numero: debriefEtJournees.numeroParId.get(id) ?? 0,
              matchIds: (matchs as any[]).map((m) => String(m.id)),
            }))
            .filter((j) => j.numero > 0 && j.numero <= journeeDuDebrief);

          const pronoParCle = new Map<string, any>();
          (predictions || []).forEach((pred: any) => {
            if (!pred?.user_id || !pred?.match_id) return;
            pronoParCle.set(`${pred.user_id}:${pred.match_id}`, pred);
          });
          const matchParIdPourExacts = new Map(
            ((reconciledMatches || []) as any[]).map((m: any) => [String(m.id), m]),
          );

          const parcours = parcoursSaison({
            joueurs: rankedRankings.map((r: any) => ({ id: String(r.user_id), name: r.name })),
            journees: journeesJouees,
            pointsDeLaJournee: (uid, journeeId) =>
              pointsByUserAndMatchday?.[uid]?.[journeeId] ?? 0,
            pointsDe: (uid, matchId) => pointsByPredictionKey[`${uid}:${matchId}`] ?? 0,
            exactDe: (uid, matchId) => {
              const prono = pronoParCle.get(`${uid}:${matchId}`);
              const match = matchParIdPourExacts.get(String(matchId));
              if (!prono || !match) return false;
              if (match.home_score == null || match.away_score == null) return false;
              return (
                Number(prono.home_prediction) === Number(match.home_score) &&
                Number(prono.away_prediction) === Number(match.away_score)
              );
            },
            classer: rankPlayers,
          });

          const parcoursTous = rankedRankings.map((r: any) => ({
            id: String(r.user_id),
            nom: String(r.name),
            etapes: parcours.get(String(r.user_id)) ?? [],
          }));

          if (!cancelled) {
            setResumePerso(resumeDuJoueur(String(user.id), parcoursTous, journeeDuDebrief));
            setPodium(podiumDuJoueur(String(user.id), parcoursTous, journeeDuDebrief));
          }
        } else if (!cancelled) {
          setResumePerso(null);
          setPodium(null);
        }
        // -------- Carriere multi-saisons --------
        // prediction -> match -> matchday -> season.
        // Toutes les saisons sont cumulees ; aucun reset annuel.
        // (seasonByMatchdayIdMap déjà construit plus haut, réutilisé ici.)

        // Points réels injectés depuis computeLeagueStats (voir plus haut) —
        // aggregateCareerStatsByUser lit un champ `points` par pronostic ;
        // `predictions.points` n'est jamais mis à jour par l'application
        // (voir le commentaire dans leaderboardStats.ts), donc on ne lui
        // passe jamais cette colonne brute, mais la valeur recalculée.
        const predictionsWithRealPoints = (predictions || []).map((p: any) => ({
          ...p,
          points: pointsByPredictionKey[`${p.user_id}:${p.match_id}`] ?? 0,
        }));

        const careerByUser = aggregateCareerStatsByUser(
          predictionsWithRealPoints,
          isExactPrediction,
          (matchId) => {
            const match = matchById.get(matchId);
            if (!match || !match.matchday_id) return null;
            return seasonByMatchdayIdMap.get(String(match.matchday_id)) ?? null;
          },
        );

        if (user?.id) {
          const mineCareer = careerByUser.get(user.id) || {
            points: 0,
            exactScores: 0,
          };

          const career = calculateCareerScore(mineCareer);
          setCareerLevel(career.level);

          // ANNONCE DE PASSAGE DE NIVEAU.
          // Ici, et pas dans un effet separe : c'est le seul endroit ou le
          // niveau vient des vraies donnees. Le niveau atteint est memorise
          // des qu'il est affiche, pour ne pas revenir a chaque ouverture ;
          // a la toute premiere visite, rien n'est annonce (voir
          // src/lib/annonceNiveau.ts).
          const dernierAnnonce = lireNiveauMemorise(user.id);
          const aFeter = niveauAAnnoncer(career.level, dernierAnnonce);
          if (aFeter !== null) setNiveauFete(aFeter);
          if (dernierAnnonce === null || career.level !== dernierAnnonce) {
            memoriserNiveau(user.id, career.level);
          }
        }
setLeaderboard(rankedRankings);

        // -------- Journée la plus récente terminée --------
        const finished = (reconciledMatches || []).filter((m: any) =>
          String(m.status || "").toLowerCase() === "finished" ||
          String(m.status || "").toLowerCase() === "ft"
        );
        const latest = [...finished].sort((a: any, b: any) =>
          numeroDeJournee(b) - numeroDeJournee(a)
        )[0];
        if (latest) {
          const numero = numeroDeJournee(latest);
          if (numero > 0) setCurrentMatchday(`J${numero}`);
        }

        // -------- Stats personnelles --------
        // Mêmes valeurs que le Classement (computeLeagueStats ci-dessus) —
        // plus de recalcul séparé ni de lecture de predictions.points.
        if (user?.id) {
          const mine = (predictions || []).filter((p: any) => p.user_id === user.id);
          const meRanking = rankedRankings.find((r: any) => r.user_id === user.id);
          const points = rankingPointsByUser[user.id] || 0;
          const exacts = rankingExactByUser[user.id] || 0;
          const bons = rankingRegularityByUser[user.id] || 0;
          const totalCount = rankingCountByUser[user.id] || 0;

          // Libellé de journée ("J5") par matchday_id — pur affichage, un
          // seul match suffit pour retrouver le libellé de sa journée.
          const dayLabelByMatchdayId = new Map<string, string>();
          (reconciledMatches || []).forEach((m: any) => {
            if (!m.matchday_id || dayLabelByMatchdayId.has(String(m.matchday_id))) return;
            const rawDay = m.matchday_code || m.matchday || m.match_day;
            if (rawDay === null || rawDay === undefined || rawDay === "") return;
            const day = String(rawDay).toUpperCase().startsWith("J") ? String(rawDay).toUpperCase() : `J${rawDay}`;
            dayLabelByMatchdayId.set(String(m.matchday_id), day);
          });

          const myPointsByDay = pointsByUserAndMatchday[user.id] ?? {};
          const daysPlayedCount = Object.keys(myPointsByDay).length;

          let bestDay = "-";
          let bestDayPoints = 0;
          Object.entries(myPointsByDay).forEach(([matchdayId, value]) => {
            if (value > bestDayPoints) {
              bestDayPoints = value;
              bestDay = dayLabelByMatchdayId.get(matchdayId) ?? "-";
            }
          });

          const finalPoints = points;
          const finalExacts = exacts;
          const finalCount = totalCount;
          const rank = meRanking?.rank ?? 0;

          setMyStats({
            rank,
            points: finalPoints,
            exactScores: finalExacts,
            successRate: mine.length ? Math.round((bons / mine.length) * 100) : 0,
            totalPronos: finalCount,
            avgPoints: daysPlayedCount ? Number((points / daysPlayedCount).toFixed(1)) : 0,
            bestDay,
            bestDayPoints,
            participation: rankingParticipationByUser[user.id] ?? 0,
            participationTotal: rankingParticipationTotalByUser[user.id] ?? 0,
          });
        }

        // -------- Verrouillage équipe de cœur --------
        // La date est stockée en UTC dans app_settings. On la convertit en
        // objet Date pour comparer l'instant réel, indépendamment du fuseau.
        if (!settingsError) {
          const rawDeadline = settingsRow?.favorite_team_deadline;
          const parsedDeadline = rawDeadline ? new Date(rawDeadline) : null;
          setFavoriteTeamDeadline(
            parsedDeadline && !Number.isNaN(parsedDeadline.getTime()) ? parsedDeadline : null,
          );
          setFavoriteTeamAutoLock(settingsRow?.favorite_team_auto_lock ?? true);
          if (settingsRow?.season) setSeasonLabel(String(settingsRow.season));
        }

        // -------- Cagnotte --------
        // Cagnotte théorique = nombre de joueurs inscrits × droit d'entrée
        // (Admin → Réglages) — jamais basée sur qui a réellement payé (le
        // statut de paiement individuel reste géré uniquement par
        // Admin → Paiements, inchangé). Se met à jour automatiquement dès
        // qu'un joueur s'inscrit ou que le droit d'entrée change.
        if (!settingsError && !profilesError) {
          const entryFee = Number(settingsRow?.entry_fee || 0);
          const registeredPlayers = (profiles || []).length;
          setPotAmount(registeredPlayers * entryFee);
        }
      } catch (error) {
        console.error("Erreur de chargement Supabase accueil :", error);
      }
    }

    fetchHomeData();

    const interval = window.setInterval(() => {
      // Onglet cache : on ne recharge pas. Voir src/lib/ongletVisible.ts.
      if (ongletVisible()) fetchHomeData();
    }, 15000);
    const onFocus = () => fetchHomeData();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchHomeData();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, teams, equipesChargees]);

  // Horloge légère pour que le verrouillage se déclenche sans rechargement
  // lorsque la date limite est atteinte alors que la page reste ouverte.
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isFavoriteTeamLocked = Boolean(
    favoriteTeamAutoLock &&
      favoriteTeamDeadline &&
      currentTime >= favoriteTeamDeadline,
  );

  // 3. Équipe favorite par défaut
  useEffect(() => {
    if (favoriteTeamId) {
      setClubId(favoriteTeamId);
    } else if (teams.length > 0 && !clubId) {
      const defaultTeam = teams.find(t => t.short_name === 'RCL') || teams[0];
      if (defaultTeam) setClubId(defaultTeam.id);
    }
  }, [favoriteTeamId, teams]);

  const activeClub = teams.find((c) => c.id === clubId);
  const {
    theme: clubTheme,
    backgroundUrl: clubWallpaperUrl,
    backgroundFailed: clubWallpaperFailedProbe,
    onBackgroundError: handleClubWallpaperError,
  } = useTeamTheme(activeClub?.name ?? null);

  const openTeamPicker = () => {
    if (isFavoriteTeamLocked) {
      alert("La période de choix de l'équipe de cœur est terminée.");
      return;
    }
    setPendingTeamId(clubId);
    setIsChangingTeam(true);
  };

  const handleConfirmTeamChange = async () => {
    if (!pendingTeamId) return;

    // Recontrôle au moment exact de l'enregistrement pour éviter qu'un
    // sélecteur déjà ouvert puisse être validé après l'heure limite.
    const lockedNow = Boolean(
      favoriteTeamAutoLock &&
        favoriteTeamDeadline &&
        new Date() >= favoriteTeamDeadline,
    );
    if (lockedNow) {
      setIsChangingTeam(false);
      alert("La période de choix de l'équipe de cœur est terminée.");
      return;
    }

    setSavingTeam(true);
    try {
      await saveFavoriteTeam(pendingTeamId);
      setClubId(pendingTeamId);
      setIsChangingTeam(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("Erreur équipe favorite :", err);
      alert("Impossible d'enregistrer l'équipe.");
    } finally {
      setSavingTeam(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: dataUrl, updated_at: new Date().toISOString() });

      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error("Erreur lors de l'envoi de la photo :", err);
      alert("Erreur lors de l'envoi de la photo de profil.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const currentCareerTitle =
    CAREER_LEVEL_TITLES[Math.max(0, Math.min(careerLevel - 1, CAREER_LEVEL_TITLES.length - 1))];

  return (

  <AppShell>
      {/* Animations discrètes, propres à cette page (n'affecte aucune autre
          route) : légère apparition en fondu + translation, désactivée si
          l'utilisateur préfère moins de mouvement. Même convention que la
          page Trophées (voir trophees.tsx). */}
      <style>{`
        @keyframes dash-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .dash-fade-up { animation: dash-fade-up .55s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .dash-fade-up { animation: none; }
        }
      `}</style>

      {/* pb-28 (au lieu de pb-20) : plus de respiration au-dessus de la nav
          mobile fixe, qui a elle-même grandi avec l'ajout de safe-area
          (voir AppShell.tsx) — évite que la dernière carte stats se sente
          collée à la nav sur téléphone. space-y-7/8 : sections plus
          clairement séparées, cohérent avec la demande de blocs "qui
          respirent" plutôt que compressés. */}
      <div className="relative z-10 mx-auto max-w-6xl space-y-7 pb-28 md:space-y-8 md:pb-20">

        {/* ============================================================
            L'ACCUEIL DU PODIUM
            ============================================================
            Etre premier ne devrait pas se lire dans un tableau : ca doit se
            voir en ouvrant le site. Les trois premiers ont donc leur propre
            en-tete — or, argent, bronze — a la place du bandeau ordinaire.

            LA PLACE EST CELLE DU SOIR DE LA DERNIERE JOURNEE TERMINEE, et
            non celle de l'instant. Pendant que les matchs se jouent, les
            rangs s'echangent plusieurs fois : une couronne qui apparait et
            disparait le samedi apres-midi ne veut plus rien dire. Elle se
            fixe a la fin de la journee et tient jusqu'a la suivante — c'est
            ce qui en fait un titre. Voir podiumDuJoueur(). */}
        {podium !== null && (
          <div
            className={`relative overflow-hidden rounded-[26px] border p-5 md:p-6 ${
              podium.rang === 1
                ? "border-amber-300/45 bg-gradient-to-br from-amber-400/[.18] via-amber-400/[.06] to-transparent shadow-[0_18px_60px_-20px_rgba(245,158,11,.5)]"
                : podium.rang === 2
                  ? "border-slate-200/35 bg-gradient-to-br from-slate-200/[.14] via-slate-200/[.05] to-transparent shadow-[0_18px_60px_-20px_rgba(203,213,225,.35)]"
                  : "border-orange-400/35 bg-gradient-to-br from-orange-500/[.14] via-orange-500/[.05] to-transparent shadow-[0_18px_60px_-20px_rgba(249,115,22,.4)]"
            }`}
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl ${
                podium.rang === 1
                  ? "bg-amber-400/20"
                  : podium.rang === 2
                    ? "bg-slate-200/15"
                    : "bg-orange-500/15"
              }`}
            />

            <div className="relative flex items-center gap-4">
              <span className="text-5xl leading-none md:text-6xl" aria-hidden>
                {podium.rang === 1 ? "👑" : podium.rang === 2 ? "🥈" : "🥉"}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`font-mono text-[10px] font-black uppercase tracking-[.2em] ${
                    podium.rang === 1
                      ? "text-amber-300"
                      : podium.rang === 2
                        ? "text-slate-300"
                        : "text-orange-300"
                  }`}
                >
                  {podium.rang === 1 ? "1er" : `${podium.rang}e`} · Journée {podium.journee}
                </p>
                <p className="mt-1 font-display text-2xl font-black uppercase leading-[1.05] tracking-[-.02em] text-white md:text-3xl">
                  {titrePodium(podium)}
                </p>
                <p className="mt-1.5 font-display text-lg font-black tabular-nums text-white/90">
                  {podium.points} <span className="text-sm font-bold text-white/60">points</span>
                </p>
              </div>
            </div>

            <div className="relative mt-4 space-y-1.5 text-sm leading-relaxed text-white/85">
              {/* Depuis combien de temps : c'est ce qui separe un coup
                  d'eclat d'une vraie domination. */}
              {podium.depuis > 1 && (
                <p>
                  {podium.rang === 1 ? "En tête" : `${podium.rang}e`} depuis{" "}
                  <span className="font-black text-white">{podium.depuis} journées</span> d'affilée.
                </p>
              )}

              {podium.devant && (
                <p>
                  <span className="font-black text-white">{podium.devant.nom}</span> est devant toi
                  {podium.devant.ecart === 0 ? (
                    <span className="font-black text-white"> à égalité de points</span>
                  ) : (
                    <>
                      , à{" "}
                      <span className="font-black text-white">
                        {podium.devant.ecart} point{podium.devant.ecart > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  .
                </p>
              )}

              {podium.derriere && (
                <p>
                  <span className="font-black text-white">{podium.derriere.nom}</span>{" "}
                  {podium.derriere.ecart === 0 ? (
                    <>te suit <span className="font-black text-white">à égalité de points</span>.</>
                  ) : podium.derriere.ecart <= 2 ? (
                    <>
                      te souffle dans le cou :{" "}
                      <span className="font-black text-white">
                        {podium.derriere.ecart} point{podium.derriere.ecart > 1 ? "s" : ""}
                      </span>{" "}
                      seulement.
                    </>
                  ) : (
                    <>
                      te suit à{" "}
                      <span className="font-black text-white">
                        {podium.derriere.ecart} points
                      </span>
                      .
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* « TA JOURNEE » — la bulle personnelle, en premier.
            Le Debrief raconte la ligue ; celle-ci ne raconte qu'une
            personne : ce qu'elle a marque, ou elle en est, qui elle a double.
            C'est la question qu'on se pose en ouvrant le site, et la reponse
            demandait jusqu'ici de comparer deux pages.
            Une fois par journee et par joueur (src/lib/annonceResume.ts) ;
            le bouton ne fait que masquer, le numero est deja memorise. */}
        {resumeAnnonce !== null && resumePerso !== null && (
          <div
            role="status"
            className="relative overflow-hidden rounded-[26px] border border-cyan-300/35 bg-gradient-to-br from-cyan-400/[.14] via-cyan-400/[.05] to-transparent p-5 shadow-[0_18px_60px_-20px_rgba(34,211,238,.45)] md:p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-cyan-400/15 blur-3xl"
            />

            <div className="relative">
              <div className="flex items-start gap-4">
                <span className="text-4xl leading-none md:text-5xl" aria-hidden>
                  {resumePerso.meilleureJournee
                    ? "🏆"
                    : resumePerso.mouvement > 0
                      ? "📈"
                      : resumePerso.mouvement < 0
                        ? "📉"
                        : "🎯"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">
                    Ta journée {resumePerso.journee}
                  </p>
                  <p className="mt-1 font-display text-xl font-black uppercase leading-tight text-white md:text-2xl">
                    {titreResume(resumePerso)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setResumeAnnonce(null)}
                  aria-label="Fermer"
                  className="tap -mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 font-mono text-lg leading-none text-cyan-200/60 transition-colors hover:text-cyan-100"
                >
                  ×
                </button>
              </div>

              {/* LES TROIS CHIFFRES, gros et lisibles d'un coup d'oeil. */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <p className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-cyan-200/70">
                    Marqués
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-black tabular-nums text-white">
                    {resumePerso.gain}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <p className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-cyan-200/70">
                    Ta place
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-black tabular-nums text-white">
                    {resumePerso.rang}
                    <span className="text-sm text-slate-400">/{resumePerso.participants}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <p className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-cyan-200/70">
                    Total
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-black tabular-nums text-white">
                    {resumePerso.points}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-cyan-50/90">
                {resumePerso.rangVeille !== null && resumePerso.mouvement !== 0 && (
                  <p>
                    Tu passes de la{" "}
                    <span className="font-black text-white">
                      {placeEcrite(resumePerso.rangVeille)}
                    </span>{" "}
                    à la{" "}
                    <span className="font-black text-white">{placeEcrite(resumePerso.rang)}</span>{" "}
                    place —{" "}
                    <span className={resumePerso.mouvement > 0 ? "font-black text-emerald-300" : "font-black text-red-300"}>
                      {resumePerso.mouvement > 0 ? "+" : ""}
                      {resumePerso.mouvement} place{Math.abs(resumePerso.mouvement) > 1 ? "s" : ""}
                    </span>
                    .
                  </p>
                )}

                {resumePerso.doubles.length > 0 && (
                  <p>
                    Tu passes devant{" "}
                    <span className="font-black text-white">{resumePerso.doubles.join(", ")}</span>.
                  </p>
                )}

                {resumePerso.doublePar.length > 0 && (
                  <p>
                    <span className="font-black text-white">{resumePerso.doublePar.join(", ")}</span>{" "}
                    {resumePerso.doublePar.length > 1 ? "sont passés" : "est passé"} devant toi.
                  </p>
                )}

                <p>
                  {resumePerso.retard === 0
                    ? "Personne devant toi. À toi de tenir."
                    : `Tu es à ${resumePerso.retard} point${resumePerso.retard > 1 ? "s" : ""} de la tête.`}
                </p>
              </div>

              <Link
                to="/debrief"
                onClick={() => setResumeAnnonce(null)}
                className="tap mt-4 inline-block rounded-xl border border-cyan-300/40 px-3 py-2.5 font-mono text-[10px] font-black uppercase tracking-[.12em] text-cyan-200 transition-colors hover:border-cyan-300/70 hover:text-cyan-100"
              >
                Lire le Debrief →
              </Link>
            </div>
          </div>
        )}

        {/* LE DEBRIEF EST EN LIGNE — la seule chose qui manquait pour que la
            page soit lue : un mot sur l'Accueil, la ou tout le monde passe.
            Elle ne s'affiche qu'une fois par journee (voir
            src/lib/annonceDebrief.ts) ; le bouton ne fait que masquer. */}
        {debriefAnnonce !== null && (
          <Link
            to="/debrief"
            onClick={() => setDebriefAnnonce(null)}
            className="tap group relative block overflow-hidden rounded-[26px] border border-emerald-300/35 bg-gradient-to-br from-emerald-400/[.14] via-emerald-400/[.05] to-transparent p-5 shadow-[0_18px_60px_-20px_rgba(16,185,129,.45)] transition-colors hover:border-emerald-300/60 md:p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-emerald-400/15 blur-3xl"
            />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="text-4xl leading-none md:text-5xl" aria-hidden>
                📰
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">
                  Le Debrief
                </p>
                <p className="mt-1 font-display text-xl font-black uppercase leading-tight text-white md:text-2xl">
                  Le bilan de la journée {debriefAnnonce} est en ligne
                </p>
                <p className="mt-1.5 text-sm text-emerald-100/80">
                  Qui grimpe, qui recule, et ce que ça change au classement.
                </p>
              </div>
              <span className="w-full shrink-0 rounded-xl border border-emerald-300/40 px-3 py-2.5 text-center font-mono text-[10px] font-black uppercase tracking-[.12em] text-emerald-200 transition-colors group-hover:border-emerald-300/70 group-hover:text-emerald-100 sm:w-auto sm:py-2">
                Aller voir →
              </span>
            </div>
          </Link>
        )}

        {/* PASSAGE DE NIVEAU — la premiere chose que le joueur voit en
            ouvrant le site apres avoir gagne un niveau. Ne s'affiche qu'une
            fois : le niveau atteint est memorise des l'affichage (voir
            src/lib/annonceNiveau.ts). Le bouton ne fait que masquer, il n'y a
            plus rien a enregistrer a ce moment-la. */}
        {niveauFete !== null && (
          <div
            role="status"
            className="relative overflow-hidden rounded-[26px] border border-amber-300/35 bg-gradient-to-br from-amber-400/[.16] via-amber-400/[.06] to-transparent p-5 shadow-[0_18px_60px_-20px_rgba(245,158,11,.45)] md:p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-amber-400/15 blur-3xl"
            />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="text-4xl leading-none md:text-5xl" aria-hidden>
                🎉
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-amber-300">
                  Nouveau niveau
                </p>
                <p className="mt-1 font-display text-2xl font-black uppercase leading-none text-white md:text-3xl">
                  Niveau {niveauFete} atteint
                </p>
                <p className="mt-2 text-sm text-amber-100/80">
                  Te voilà{" "}
                  <span className="font-bold text-amber-200">
                    {CAREER_LEVEL_TITLES[
                      Math.max(0, Math.min(niveauFete - 1, CAREER_LEVEL_TITLES.length - 1))
                    ]}
                  </span>
                  . Continue comme ça.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNiveauFete(null)}
                className="tap shrink-0 rounded-xl border border-amber-300/30 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[.12em] text-amber-200 transition-colors hover:border-amber-300/60 hover:text-amber-100"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Installation sur l'ecran d'accueil. Le bloc ne s'affiche que s'il
            y a quelque chose a proposer : ni sur une application deja
            installee, ni sur un navigateur qui ne sait pas installer, ni si le
            joueur a ferme la proposition. */}
        <InstallerApplication />

        {/* HERO SECTION avec Effet Verre */}
        {/* Rembourrage reduit (p-12 -> p-8 sur grand ecran) : c'est lui qui
            faisait le plus pour la hauteur du bandeau. */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.7)] sm:p-7 md:p-8">
          <div
            role="img"
            aria-label="Ligue 1"
            /* L'image couvre TOUT le bloc, centree. Le "contain" cale a droite
               essaye precedemment laissait une couture nette au milieu du
               bandeau, l'image ne commencant qu'a mi-largeur. */
            className="pointer-events-none absolute inset-0 block bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/logo-ligue1.png')" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d1322] from-0% via-[#0d1322]/80 via-40% to-[#0d1322]/25 to-95%"
          />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] items-center">
            {/* Bandeau resserre : le titre en deux lignes geantes, le
                sous-titre publicitaire et le compte a rebours en pleine
                largeur occupaient un ecran entier pour quatre informations.
                Titre reduit d'un cran, sous-titre supprime (il ne disait rien
                qu'un joueur deja inscrit ignore), compte a rebours ramene a
                une seule ligne. */}
            <div className="dash-fade-up max-w-full space-y-4 lg:max-w-[56%]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-bold text-emerald-400 tracking-wider">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {seasonLabel ? `SAISON ${seasonLabel} • ` : ""}LIGUE 1 MCDONALD'S
              </div>
              {/* Titre STABLE, qui nomme la competition entre amis.
                  Deux essais precedents ne tenaient pas : "Prédis les
                  résultats de la Ligue 1" s'adressait a un visiteur a
                  convaincre alors que le lecteur est deja inscrit, et un
                  titre change a chaque etat ("ça se joue maintenant")
                  repetait ce que le bandeau juste en dessous annonce deja.
                  L'etat en direct reste donc sous le titre, la ou il a sa
                  place. Le titre nomme la competition, l'accroche juste en
                  dessous donne l'enjeu. */}
              <h1
                /* Le degrade descendait jusqu'a un bleu clair des la moitie
                   des lettres, ce qui delavait le bas du titre sur un fond
                   deja sombre. Le blanc tient maintenant les deux tiers. */
                className="bg-gradient-to-b from-white from-30% via-white via-70% to-[color-mix(in_oklab,var(--sky)_26%,white)] bg-clip-text font-display text-[1.75rem] leading-[1.05] tracking-tight text-transparent [text-wrap:balance] sm:text-4xl md:text-5xl md:leading-none"
                style={{
                  filter:
                    "drop-shadow(0 1px 0 rgba(0,0,0,.35)) drop-shadow(0 0 20px rgba(22,82,240,.16))",
                }}
              >
                LE CHAMPIONNAT DES PRONOS
              </h1>
              {/* Accroche d'une ligne : elle donne l'enjeu que le titre se
                  contente de nommer. Volontairement courte — c'est le
                  sous-titre publicitaire de trois lignes qui avait fait
                  gonfler le bandeau. */}
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-slate-400 sm:text-xs">
                Une saison, un vainqueur
              </p>

              {/* Compte a rebours vers le prochain coup d'envoi REEL, au lieu
                  d'une date figee dans Countdown.tsx qui laissait 00 00 00 00
                  a l'ecran. Le bandeau "N matchs en direct" a ete retire :
                  l'information vit deja sur les pages Pronos et Classement. */}
              {nextKickoff ? (
                <div className="max-w-md rounded-2xl border border-slate-800 bg-[#060b16]/70 px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                        nextKickoff.mode === "fermeture" ? "text-amber-300" : "text-emerald-400"
                      }`}
                    >
                      {nextKickoff.mode === "fermeture"
                        ? `${nextKickoff.day} · fermeture du prochain match`
                        : `Ouverture de la ${nextKickoff.day || "journée"} · ${nextKickoff.label}`}
                    </span>
                  </div>
                  <CountdownBlocks target={nextKickoff.at} />
                </div>
              ) : (
                <div className="flex max-w-md items-center gap-3 rounded-2xl border border-slate-800 bg-[#060b16]/70 px-4 py-3">
                  <span className="size-1.5 shrink-0 rounded-full bg-slate-600" />
                  <span className="font-mono text-[11px] text-slate-400">
                    Aucun match programmé pour l'instant.
                  </span>
                </div>
              )}

              {/* flex-col sur mobile : boutons pleine largeur, empilés
                  proprement (grande cible tactile), plutôt qu'un flex-wrap
                  qui les laissait retomber côte à côte de façon imprévisible
                  selon la largeur exacte de l'écran. */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  to="/pronostics"
                  /* ACTION PRINCIPALE. Les deux boutons avaient exactement le
                     meme poids : meme taille, meme graisse, deux cadres pleins
                     cote a cote. L'oeil ne savait pas lequel etait l'action du
                     jour. Celui-ci gagne en taille et en presence, l'autre
                     s'efface — sans rien changer a ce qu'ils font. */
                  className="tap flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-7 py-3.5 font-display text-[15px] font-black tracking-wide text-slate-950 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.65)] ring-1 ring-emerald-200/50 transition-all hover:bg-emerald-300 active:scale-[.98]"
                >
                  <Medal size={18} /> Faire mes pronos <ArrowRight size={16} />
                </Link>
                <Link
                  to="/classement"
                  className="tap flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-white/[0.02] px-6 py-3 font-display text-sm font-bold text-slate-300 transition-all hover:border-slate-600 hover:bg-white/[0.05] hover:text-white active:scale-[.98]"
                >
                  <Trophy size={18} className="text-amber-400" /> Voir le classement
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* LIGNE : PROFIL avec Effet Verre */}
        <div className="dash-fade-up w-full" style={{ animationDelay: "80ms" }}>
          <div
            className="relative overflow-hidden rounded-3xl border bg-[#0d1322]/75 backdrop-blur-xl p-5 md:p-6 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors duration-500"
            style={{ borderColor: clubTheme.primary + "40" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              /* "100% 100%" ETIRAIT le visuel du club pour remplir le cadre,
                 sans respecter son ratio : sur un bloc large et court, le
                 blason se retrouvait ecrase en hauteur. "cover" cadre sans
                 deformer ; la position a droite garde le blason visible, la
                 ou l'artwork le place. */
              style={{
                backgroundImage: `url('${clubWallpaperUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "right center",
                backgroundRepeat: "no-repeat",
                filter: "saturate(1.2) brightness(1.02)",
              }}
            />
            {clubTheme.id !== "default" && !clubWallpaperFailedProbe && (
              <img
                src={clubTheme.background}
                alt=""
                className="hidden"
                onError={handleClubWallpaperError}
              />
            )}
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#0d1322]/90 from-0% via-[#0d1322]/60 via-35% to-transparent to-62%" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[62%] z-0 bg-gradient-to-t from-[#0d1322]/70 from-0% via-transparent via-30% to-transparent" />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -left-16 z-0 h-64 w-64 rounded-full blur-[110px]"
              style={{ backgroundColor: clubTheme.glow }}
            />
            <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />

            {/* Voile bas sur TOUTE la largeur : la barre d'actions ("Gérer mon
                profil") tombait pile sur le slogan grave dans le visuel du
                club — "Toujours plus haut, fiers d'être Lensois" pour Lens.
                Deux typographies se croisaient sans se voir. Le degrade
                gauche existant ne couvrait que 62 % de la largeur. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-t from-[#0d1322] via-[#0d1322]/70 to-transparent" />

            {/* Assombrissement supplémentaire, mobile uniquement : les dégradés
                ci-dessus sont pensés pour le layout desktop (texte à gauche /
                blason à droite sur toute la largeur restante) — sur une seule
                colonne (mobile), le texte occupe toute la largeur et se
                retrouve directement sur le fond du club, parfois trop clair/vif
                (ex. rouge RC Lens) pour rester lisible. Purement additif,
                masqué dès md: donc aucun changement du rendu desktop. */}
            <div className="pointer-events-none absolute inset-0 z-0 bg-[#070c16]/50 md:hidden" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:gap-6 md:pr-[30%] lg:pr-[34%]">
              <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  {/* Avatar nettement réduit sur mobile (96px au lieu de 144px) :
                      à 144px il écrasait la colonne pseudo/niveau/classement
                      contre le blason du club sur les écrans étroits (360-412px).
                      Desktop inchangé (md:size-40). */}
                  <div className="size-24 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-500 p-1 shadow-[0_0_20px_rgba(245,158,11,0.3)] sm:size-28 md:size-32">
                    <div className="size-full rounded-full bg-[#060b16] flex items-center justify-center overflow-hidden border border-slate-800">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-xl font-extrabold text-red-500 tracking-wider sm:text-2xl md:text-4xl">{(profile?.pseudo || user?.email?.split("@")[0] || "JO").slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    title="Changer ma photo de profil"
                    className="tap absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-amber-400 text-slate-950 border-2 border-[#0d1322] shadow-[0_2px_10px_rgba(0,0,0,0.5)] hover:bg-amber-300 transition-colors disabled:opacity-60 sm:size-9 md:size-10"
                  >
                    <Camera size={16} className={avatarUploading ? "animate-pulse" : undefined} />
                  </button>
                </div>

                {/* HIERARCHIE INVERSEE. Le pavé ambré "Niveau 1 · DÉBUTANT"
                    passait AVANT le pseudo, avec bordure doree, halo et fond
                    opaque : l'element le plus voyant du bloc annoncait
                    l'information la moins interessante, et le sujet reel —
                    le joueur — venait apres, en texte nu. Le pseudo prend la
                    tete, le niveau rejoint le rang et les points sur la meme
                    ligne de pastilles. */}
                <div className="min-w-0">
                  <h3 className="font-display text-2xl text-white tracking-tight truncate sm:text-3xl md:text-4xl">
                    {profile?.pseudo || user?.email?.split("@")[0] || "Joueur"}
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-400 sm:text-sm">
                      <Trophy size={14} /> #{myStats.rank || "—"} du classement
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 font-mono text-xs font-bold text-yellow-400 sm:text-sm">
                      {myStats.points} pts
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 font-mono text-xs font-bold text-amber-300 sm:text-sm">
                      Niv. {careerLevel}
                      <span className="text-amber-400/60">·</span>
                      <span className="truncate uppercase">{currentCareerTitle}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden self-stretch w-px bg-gradient-to-b from-transparent via-slate-500/70 to-transparent md:block" />

              <div className="md:w-72 lg:w-80 md:shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                <span className="font-mono text-[10px] uppercase text-red-400 font-bold tracking-widest flex items-center gap-1.5">
                  <Heart size={12} className="fill-red-400" /> Équipe de cœur
                </span>
                {/* Le nom etait rempli d'un degrade aux couleurs du club. Sur
                    le fond du club lui-meme — rouge vif pour Lens — un degrade
                    rouge et or devenait illisible. Blanc plein, avec une barre
                    aux couleurs du club en rappel : le contraste ne depend
                    plus de l'equipe choisie. */}
                <div className="mt-1 flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: clubTheme.primary }}
                  />
                  <span className="block truncate font-display text-xl font-bold text-white md:text-2xl">
                    {activeClub?.name || "À choisir"}
                  </span>
                </div>

                {/* Le cadenas vivait en bas a gauche du bloc, a l'oppose du
                    nom du club qu'il concerne. Il le suit desormais. */}
                {isFavoriteTeamLocked && !isChangingTeam && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-red-300">
                    <span aria-hidden="true">🔒</span> Choix verrouillé
                  </span>
                )}
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {!isChangingTeam ? (
                  !isFavoriteTeamLocked ? (
                    <button
                      type="button"
                      onClick={openTeamPicker}
                    className="tap flex items-center gap-2 rounded-xl border bg-slate-900/80 px-4 py-2.5 text-[13px] font-display font-bold text-slate-200 hover:border-red-500/50 hover:text-red-400 transition-all"
                      style={{ borderColor: clubTheme.primary + "55" }}
                    >
                      <Heart size={14} style={{ color: clubTheme.primary }} /> Changer mon équipe
                    </button>
                  ) : null
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pendingTeamId}
                      onChange={(e) => setPendingTeamId(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-display font-bold text-white focus:border-red-500 focus:outline-none transition-colors cursor-pointer"
                    >
                      {teams.length === 0 && <option value="">Chargement...</option>}
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleConfirmTeamChange}
                      disabled={!pendingTeamId || savingTeam}
                      className="tap flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-500 px-3.5 py-2 text-xs font-display font-bold text-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={14} /> {savingTeam ? "..." : "Valider"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChangingTeam(false)}
                      className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors px-1"
                    >
                      Annuler
                    </button>
                  </div>
                )}
                {isSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 animate-fade-in">
                    <Check size={14} /> Équipe enregistrée !
                  </span>
                )}
              </div>
              <Link
                to="/profil"
                className="tap group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-[13px] font-display font-bold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <Camera size={14} className="text-emerald-400" /> Gérer mon profil <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION : PODIUM & STATS avec Effet Verre */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">

          <div className="dash-fade-up relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_40px_rgba(0,0,0,0.6)]" style={{ animationDelay: "140ms" }}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url('/images/fond-bloc-accueil.png')" }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0d1322]/20 via-[#0d1322]/35 to-[#0d1322]/55" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className="text-amber-400 animate-pulse" />
                  <span className="font-mono text-[11px] uppercase text-amber-400 font-bold tracking-widest">
                    {currentMatchday ? `À l'issue de la ${currentMatchday}` : "Classement en direct"}
                  </span>
                </div>
                <h3 className="font-display text-[26px] font-black md:text-3xl text-white tracking-tight">Classement général</h3>
              </div>
              <Link
                to="/classement"
                className="tap shrink-0 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2.5 font-mono text-xs text-slate-200 shadow-md transition-all hover:border-amber-500/50 hover:text-white"
              >
                Complet →
              </Link>
            </div>

            {/* Podium en cartes remplacé par les 5 premiers, dans le même
                ordre de lecture que la page Classement : place, joueur,
                points, gain. Trois cartes empilées disaient moins que cinq
                lignes, et n'affichaient pas les gains. */}
            <div className="relative z-10 space-y-1.5">
              {/* COLONNES PLUS SERREES SUR TELEPHONE. A 393 px, « Red Evils »
                  s'affichait « Red … » des que la pastille « TOI » etait la :
                  les trois colonnes de droite prenaient 144 px fixes sur les
                  325 disponibles. Elles se resserrent sous sm:, et retrouvent
                  leur largeur d'origine au-dela. */}
              {/* MEME LECTURE QUE LA PAGE CLASSEMENT, EN MINIATURE.
                  Medaille pour le podium, blason du club sur l'avatar, points,
                  scores exacts et barre de regularite. Toutes ces valeurs sont
                  DEJA portees par chaque ligne de `leaderboard` (favorite_logo,
                  exact_scores, participation / participationTotal) : rien n'est
                  recalcule ici, rien n'est demande a Supabase en plus.
                  Le mouvement et le niveau de carriere, eux, ne sont pas
                  disponibles sur cette page — ils ne sont donc pas inventes. */}
              <div className="hidden grid-cols-[30px_minmax(0,1fr)_44px_44px_88px] items-center gap-2.5 px-2 pb-1 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-slate-500 sm:grid">
                <span>#</span>
                <span>Joueur</span>
                <span className="text-right">Pts</span>
                <span className="text-center">Exacts</span>
                <span className="text-right">Régularité</span>
              </div>

              {leaderboard.slice(0, 5).map((player, index) => {
                const place = index + 1;
                const isMe = myStats.rank === place;
                const joues = Number(player?.participation || 0);
                const jouables = Number(player?.participationTotal || 0);
                const regularite = jouables > 0 ? Math.round((joues / jouables) * 100) : 0;

                return (
                  <div
                    key={player?.user_id || `place-${place}`}
                    className={`dash-fade-up relative flex flex-wrap items-center gap-x-2.5 gap-y-1.5 overflow-hidden rounded-xl border px-2 py-2 transition-colors sm:grid sm:grid-cols-[30px_minmax(0,1fr)_44px_44px_88px] sm:gap-2.5 sm:px-2.5 sm:py-2.5 ${
                      isMe
                        ? "border-emerald-400/45 bg-emerald-400/[.10] ring-1 ring-emerald-400/20 before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-emerald-400"
                        : place === 1
                          ? "border-amber-500/30 bg-amber-500/[.06]"
                          : "border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/70"
                    }`}
                    style={{ animationDelay: `${180 + index * 60}ms` }}
                  >
                    {/* MEDAILLE pour le podium, simple numero ensuite — comme
                        sur la page Classement. */}
                    <span
                      className={`order-1 grid size-[26px] shrink-0 place-items-center rounded-full font-mono text-[11px] font-black sm:order-none sm:size-[30px] ${
                        place === 1
                          ? "bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,.45)]"
                          : place === 2
                            ? "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900"
                            : place === 3
                              ? "bg-gradient-to-br from-amber-500/80 via-amber-700 to-amber-900 text-amber-50"
                              : "border border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {place}
                    </span>

                    <div className="order-2 flex min-w-0 flex-1 items-center gap-2 sm:order-none sm:flex-none">
                      {/* AVATAR + BLASON, comme sur la page Classement : le
                          club se lit sans quitter la ligne. */}
                      <span className="relative shrink-0">
                        {player?.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt=""
                            className="size-7 rounded-full border border-white/10 object-cover sm:size-8"
                          />
                        ) : (
                          <span className="grid size-7 place-items-center rounded-full border border-white/10 bg-slate-800 font-mono text-[9px] font-black text-slate-300 sm:size-8">
                            {String(player?.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {player?.favorite_logo && (
                          <img
                            src={player.favorite_logo}
                            alt=""
                            aria-hidden
                            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border border-[#0d1322] bg-[#0d1322] object-contain sm:size-4"
                          />
                        )}
                      </span>

                      <span className="truncate font-display text-sm font-bold text-white">
                        {player?.name || "En attente"}
                      </span>
                      {isMe && (
                        <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-1 py-0.5 font-mono text-[8px] font-black uppercase text-emerald-200 sm:px-1.5">
                          Toi
                        </span>
                      )}
                    </div>

                    <span
                      className={`order-3 shrink-0 font-display text-[17px] font-black tabular-nums sm:order-none sm:text-right ${
                        place === 1 ? "text-amber-300" : "text-white"
                      }`}
                    >
                      {Number(player?.total_points || 0)}
                    </span>

                    {/* Saut de ligne : sur telephone, les deux mesures passent
                        sous le nom plutot que de l'ecraser. */}
                    <div aria-hidden className="order-4 h-0 basis-full sm:hidden" />

                    <span className="order-5 inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-slate-300 sm:order-none sm:justify-center">
                      <Target size={11} className="text-sky-400" />
                      {Number(player?.exact_scores || 0)}
                    </span>

                    <span className="order-6 flex flex-1 items-center gap-1.5 sm:order-none sm:flex-none">
                      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <span
                          className={`block h-full rounded-full ${place === 1 ? "bg-amber-400" : "bg-emerald-400/80"}`}
                          style={{ width: `${regularite}%` }}
                        />
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-slate-400">
                        {jouables > 0 ? `${regularite}%` : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}

              {!leaderboard.length && (
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-6 text-center font-mono text-[11px] text-slate-500">
                  Le classement apparaîtra dès les premiers résultats.
                </div>
              )}
            </div>

            {/* LA CAGNOTTE, ET CE QU'ELLE DEVIENT.
                Une seule ligne annoncait le total, a cote d'une phrase
                d'ambiance ecrite en dur (« Ligue ultra serree en tete ! »)
                qui ne disait rien du classement reel. Le total prend la place
                qu'il merite, et la repartition 50/30/20 devient lisible —
                elle vient de `homePrizeByRank`, exactement la meme valeur que
                celle affichee sur chaque ligne du classement ci-dessus.
                Aucun calcul touche : computePrizeByRank est inchange. */}
            <div className="relative z-10 mt-6 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.09] to-transparent p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-amber-400/90">
                  La cagnotte
                </span>
                <span className="font-display text-2xl font-black tabular-nums text-amber-300 sm:text-[26px]">
                  {potAmount.toFixed(0)} €
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {PODIUM_CAGNOTTE.map(({ rang, medaille, part }) => (
                  <div
                    key={rang}
                    className="rounded-xl border border-white/[0.06] bg-black/25 px-2 py-2 text-center"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                      <span aria-hidden>{medaille}</span> {part}
                    </div>
                    <div className="mt-0.5 font-display text-base font-black tabular-nums text-white">
                      {homePrizeByRank[rang] ?? 0} €
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dash-fade-up relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1322]/75 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)]" style={{ animationDelay: "200ms" }}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url('/images/fond-bloc-accueil.png')" }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0d1322]/20 via-[#0d1322]/35 to-[#0d1322]/55" />

            <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-400">Tes performances</span>
                <h3 className="font-display text-2xl font-semibold text-white mt-0.5">Statistiques personnelles</h3>
              </div>
              <Link to="/stats" className="tap shrink-0 whitespace-nowrap rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 font-mono text-xs text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-white">
                Tout voir →
              </Link>
            </div>

            <div className="relative z-10 grid flex-1 grid-cols-2 content-stretch gap-3.5 sm:gap-4">
              <div
                className="relative flex h-full min-h-[104px] flex-col justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat sm:p-5"
                style={{ backgroundImage: "url('/images/stats/stat-bons-pronos.png')" }}
              >
                <div className="absolute inset-0 bg-black/55" />
                <span className="relative font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-slate-300 block mb-1">Bons pronos</span>
                <strong
                  className="relative block font-display text-[28px] font-black tabular-nums text-white sm:text-3xl"
                  style={{ filter: "drop-shadow(0 0 14px rgba(110,231,183,.35))" }}
                >
                  {myStats.successRate}
                  <span className="text-[0.6em] align-top">%</span>
                </strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">{myStats.totalPronos} pronos</span>
              </div>

              <div
                className="relative flex h-full min-h-[104px] flex-col justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat sm:p-5"
                style={{ backgroundImage: "url('/images/stats/stat-scores-exacts.png')" }}
              >
                <div className="absolute inset-0 bg-black/55" />
                <span className="relative font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-slate-300 block mb-1">Scores exacts</span>
                <strong
                  className="relative block font-display text-[28px] font-black tabular-nums text-white sm:text-3xl"
                  style={{ filter: "drop-shadow(0 0 14px rgba(96,165,250,.35))" }}
                >
                  {myStats.exactScores}
                </strong>
                {/* "0% des pronos" ne dit rien quand le compteur est a zero. */}
                <span className="relative text-[11px] text-slate-300 block mt-1">
                  {myStats.exactScores > 0
                    ? `${Math.round((myStats.exactScores / Math.max(myStats.totalPronos, 1)) * 100)}% des pronos`
                    : "Pas encore trouvé"}
                </span>
              </div>

              <div
                className="relative flex h-full min-h-[104px] flex-col justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat sm:p-5"
                style={{ backgroundImage: "url('/images/stats/stat-points-moyens.png')" }}
              >
                <div className="absolute inset-0 bg-black/55" />
                {/* "Points moyens" affichait le meme chiffre que "Meilleure
                    journee" tant qu'une seule journee etait jouee. Remplace par
                    la REGULARITE, qui manquait a l'Accueil alors qu'elle sert
                    desormais a departager le classement. */}
                <span className="relative font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-slate-300 block mb-1">Régularité</span>
                <strong
                  className="relative block font-display text-[28px] font-black tabular-nums text-white sm:text-3xl"
                  style={{ filter: "drop-shadow(0 0 14px rgba(252,211,77,.35))" }}
                >
                  {myStats.participationTotal
                    ? `${Math.round((myStats.participation / myStats.participationTotal) * 100)}%`
                    : "—"}
                </strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">
                  {myStats.participationTotal
                    ? `${myStats.participation} sur ${myStats.participationTotal} matchs`
                    : "Aucun match joué"}
                </span>
              </div>

              <div
                className="relative flex h-full min-h-[104px] flex-col justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#060b16]/90 p-4 bg-cover bg-center bg-no-repeat sm:p-5"
                style={{ backgroundImage: "url('/images/stats/stat-meilleure-journee.png')" }}
              >
                <div className="absolute inset-0 bg-black/55" />
                <span className="relative font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-slate-300 block mb-1">Meilleure journée</span>
                <strong
                  className="relative block font-display text-[28px] font-black tabular-nums text-white sm:text-3xl"
                  style={{ filter: "drop-shadow(0 0 14px rgba(129,140,248,.35))" }}
                >
                  {myStats.bestDayPoints}
                </strong>
                <span className="relative text-[11px] text-slate-300 block mt-1">Points • {myStats.bestDay}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}