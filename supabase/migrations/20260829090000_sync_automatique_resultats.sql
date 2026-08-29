-- ============================================================
-- SYNCHRONISATION AUTOMATIQUE DES RÉSULTATS
-- ============================================================
-- Constat : rien ne remplissait les scores tout seul. La seule tâche
-- programmée du projet envoyait les rappels ; les résultats n'entraient en
-- base que quand un admin cliquait sur « Synchroniser ». Un match joué le
-- vendredi soir ne rapportait donc aucun point à personne — parfois pendant
-- des jours — et la page Pronos affichait un blanc à la place du score.
--
-- CE QUE CE SCRIPT NE FAIT PAS : il ne touche ni au calcul des points, ni au
-- classement. Il remplit seulement les colonnes home_score / away_score que
-- l'admin remplissait à la main. Le barème et le moteur de points restent
-- exactement les mêmes.
--
-- PRÉALABLE : la fonction sync-ligue1-matches doit avoir été redéployée avec
-- le chemin cron (en-tête x-cron-secret). Sans cela, l'appel repartira en 401
-- et rien ne sera synchronisé — sans casser quoi que ce soit.
--
-- AUCUN NOUVEAU SECRET À CRÉER : on réutilise ceux des rappels. Les secrets
-- d'Edge Function sont partagés par tout le projet Supabase, et l'adresse de
-- la fonction se déduit de celle des rappels.
--
-- À EXÉCUTER dans Supabase → SQL Editor. Le script est rejouable.
-- ============================================================

-- ---------- 1. Vérifier que les secrets attendus existent ----------
do $verif$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'prono_reminder_function_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'prono_reminder_cron_secret';

  if v_url is null then
    raise exception
      'Secret « prono_reminder_function_url » introuvable dans Vault. La tâche des rappels doit être en place avant celle-ci.';
  end if;

  if v_secret is null then
    raise exception
      'Secret « prono_reminder_cron_secret » introuvable dans Vault. La tâche des rappels doit être en place avant celle-ci.';
  end if;

  if position('send-prono-reminders' in v_url) = 0 then
    raise exception
      'L''adresse des rappels ne contient pas « send-prono-reminders » : impossible d''en déduire celle de la synchronisation. Adresse trouvée : %',
      v_url;
  end if;
end
$verif$;

-- ---------- 2. Repartir d'une base propre ----------
-- Rejouable : on retire une éventuelle version précédente avant de replanifier.
select cron.unschedule(jobid)
from cron.job
where jobname like 'prono-ligue1-sync%';

-- ---------- 3. Programmer ----------
-- TOUTES LES HEURES, À LA MINUTE 5.
--
-- Pourquoi l'heure et pas plus souvent : un résultat n'a pas besoin d'arriver
-- à la seconde. Un match se termine vers 22 h 35 ; il est en base au plus tard
-- à 23 h 05, avant que quiconque regarde. Plus fréquent multiplierait les
-- appels à football-data.org (dont le quota gratuit est limité) sans rien
-- apporter.
--
-- Pourquoi la minute 5 et pas 0 : les rappels tournent toutes les 5 minutes,
-- donc à chaque heure pile. Décaler évite que les deux tâches réveillent les
-- fonctions au même instant.
--
-- 24 réveils par jour, 720 par mois — à comparer aux 8 640 des rappels.
select cron.schedule(
  'prono-ligue1-sync-resultats-horaire',
  '5 * * * *',
  $job$
    select net.http_post(
      url := replace(
        (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_function_url'),
        'send-prono-reminders',
        'sync-ligue1-matches'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'prono_reminder_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $job$
);

-- ---------- 4. Contrôle ----------
-- Doit afficher une ligne, active, avec le programme 5 * * * *
select jobid, jobname, schedule, active
from cron.job
where jobname like 'prono-ligue1-%'
order by jobname;
