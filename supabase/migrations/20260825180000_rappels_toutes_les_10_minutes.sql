-- ============================================================
-- RAPPELS DE PRONOSTICS — DE CHAQUE MINUTE À TOUTES LES 10 MINUTES
-- ============================================================
-- La tâche tournait `* * * * *` : 1 440 réveils par jour, 43 200 par mois.
-- L'immense majorité pour ne rien trouver et ne rien envoyer — mais chacun
-- réveille la fonction ET interroge la base. C'est ce qui apparaît sur le
-- tableau de bord Supabase : les barres EDGE FUNCTIONS et DATABASE pleines en
-- permanence, avec trois fois plus d'appels que de vraies visites de joueurs.
--
-- ATTENTION, LES DEUX VONT ENSEMBLE : la fonction ne regarde que les matchs
-- démarrant dans « environ une heure ». Espacer la tâche SANS élargir cette
-- fenêtre ferait passer des matchs entre deux réveils — aucun rappel envoyé,
-- et rien pour le signaler. La fenêtre est donc passée de ±5 à ±10 minutes
-- dans supabase/functions/_shared/fenetreRappel.ts, et la cohérence des deux
-- est vérifiée par `npm run verif-rappels`.
--
-- Être vu deux fois ne coûte rien : `prono_reminder_sent` est unique sur
-- (user_id, match_id), personne n'est relancé deux fois pour le même match.
--
-- ORDRE : déployer d'abord la fonction (fenêtre élargie), PUIS exécuter ce
-- script. L'inverse laisserait une fenêtre de ±5 minutes avec un réveil
-- toutes les 10.
-- ============================================================

-- ---------- Avant ----------
select jobid, jobname, schedule
from cron.job
where jobname like 'prono-ligue1-reminders%';

-- ---------- Remplacement ----------
select cron.unschedule(jobid)
from cron.job
where jobname like 'prono-ligue1-reminders%';

select cron.schedule(
  'prono-ligue1-reminders-toutes-les-10-minutes',
  '*/10 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $job$
);

-- ---------- Après ----------
-- Doit afficher une seule ligne, avec le programme */10 * * * *
select jobid, jobname, schedule, active
from cron.job
where jobname like 'prono-ligue1-reminders%';
