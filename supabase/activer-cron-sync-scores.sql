-- =========================================================
-- PRONO LIGUE 1 LM
-- ENREGISTREMENT AUTOMATIQUE DES SCORES — TOUTES LES 30 MINUTES
-- =========================================================
--
-- Pourquoi : pendant un match, le site lit déjà football-data.org à chaque
-- affichage, donc les points bougent en direct sans rien écrire en base.
-- Mais quand le match est fini, le direct disparaît : si personne ne clique
-- sur « Synchroniser », le score reste « ?-? » en base (c'est ce qui est
-- arrivé à PSG–Rennes en J1). Cette tâche fixe le résultat définitif toute
-- seule.
--
-- Ce qu'elle écrit : home_score, away_score et finished, uniquement sur des
-- matchs déjà présents en base. Elle ne crée jamais de match ni de journée,
-- et ne touche ni aux pronostics ni aux points.
--
-- AVANT DE LANCER CE SCRIPT, trois choses :
--   1. Déployer le site (la route /api/sync-scores doit exister en ligne).
--   2. Ajouter dans Vercel la variable CRON_SECRET, avec une valeur au
--      hasard (par exemple générée ici : select gen_random_uuid();).
--   3. Remplacer ci-dessous TON-DOMAINE-STABLE et TON-SECRET dans le SQL
--      COLLE DANS SUPABASE — mais surtout PAS dans ce fichier, qui est
--      publie sur GitHub.
--
-- DEUX PIEGES :
--
--   * L'ADRESSE. Vercel donne a chaque deploiement une adresse unique du
--     type premium-play-stats-qi3ko53xb-....vercel.app. Elle change a chaque
--     mise en ligne : une tache qui pointe dessus finira par appeler dans le
--     vide. Utilise l'adresse STABLE du projet (Vercel > Project >
--     Domains), celle qui ne bouge jamais.
--
--   * LE SECRET. Ne le colle jamais dans ce fichier : le depot est public,
--     n'importe qui pourrait alors declencher la tache en boucle et faire
--     depasser le quota football-data, ce qui ferait perdre AUSSI
--     l'affichage en direct. Il vit dans Vercel (CRON_SECRET) et dans le SQL
--     que tu colles dans Supabase, nulle part ailleurs.
--
-- OU METTRE TES VRAIES VALEURS : nulle part dans ce fichier. Copie-le sous
-- le nom activer-cron-sync-scores.local.sql (deja ignore par Git), remplis
-- TON-SECRET dedans, et colle CE fichier-la dans Supabase. Le fichier local
-- ne partira jamais sur GitHub.
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supprime l'ancienne tâche si le script est relancé.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prono-ligue1-sync-scores';

-- Toutes les 30 minutes. Ne descends pas en dessous : l'API football-data
-- gratuite limite le nombre d'appels, et se faire bloquer ferait perdre
-- AUSSI l'affichage en direct, qui est bien plus visible pour les joueurs.
select cron.schedule(
  'prono-ligue1-sync-scores',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://premium-play-stats.vercel.app/api/sync-scores',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'TON-SECRET'
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $$
);

-- Vérification : la tâche doit apparaître, active = true.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prono-ligue1-sync-scores';

-- Pour voir les derniers passages (statut et réponse) :
-- select status, return_message, start_time
-- from net._http_response
-- order by created desc
-- limit 10;

-- Pour arrêter la tâche plus tard :
-- select cron.unschedule(jobid) from cron.job where jobname = 'prono-ligue1-sync-scores';
