-- ============================================================
-- RAPPELS DE PRONOSTICS — DE CHAQUE MINUTE À TOUTES LES 5 MINUTES
-- ============================================================
-- La tâche tournait `* * * * *` : 1 440 réveils par jour, 43 200 par mois.
-- L'immense majorité pour ne rien trouver et ne rien envoyer — mais chacun
-- réveille la fonction ET interroge la base. C'est ce qui apparaît sur le
-- tableau de bord Supabase : les barres EDGE FUNCTIONS et DATABASE pleines en
-- permanence, avec trois fois plus d'appels que de vraies visites de joueurs.
--
-- ATTENTION, LES DEUX VONT ENSEMBLE : la fonction ne regarde que les matchs
-- démarrant dans « environ une heure », à ±5 minutes près — soit une fenêtre
-- de 10 minutes de large. Espacer la tâche AU-DELÀ de cette largeur ferait
-- passer des matchs entre deux réveils : aucun rappel envoyé, et rien pour le
-- signaler.
--
-- Toutes les 5 minutes, chaque match reste vu par DEUX passages au moins. La
-- fonction n'a donc RIEN à changer, et ce script suffit à lui seul.
-- `npm run verif-rappels` vérifie cette cohérence, en lisant la vraie fenêtre
-- dans le code de la fonction déployée.
--
-- Être vu deux fois ne coûte rien : `prono_reminder_sent` est unique sur
-- (user_id, match_id), personne n'est relancé deux fois pour le même match.
--
-- RIEN D'AUTRE À FAIRE : aucune fonction à redéployer.
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
  'prono-ligue1-reminders-toutes-les-5-minutes',
  '*/5 * * * *',
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
-- Doit afficher une seule ligne, avec le programme */5 * * * *
select jobid, jobname, schedule, active
from cron.job
where jobname like 'prono-ligue1-reminders%';
