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
-- classement, ni au barème. Il remplit seulement les colonnes home_score /
-- away_score que l'admin remplissait à la main.
--
-- ------------------------------------------------------------
-- LE POINT IMPORTANT : RÉVEIL FRÉQUENT, APPEL RARE
-- ------------------------------------------------------------
-- La tâche se réveille toutes les 10 minutes, mais elle n'appelle la fonction
-- QUE s'il y a réellement un résultat à aller chercher. Le réveil coûte une
-- petite requête sur `matches` ; l'appel, lui, réveille une Edge Function et
-- interroge football-data.org, dont le quota gratuit est limité.
--
-- Résultat : pendant un match, le score se met à jour toutes les 10 minutes.
-- Un mardi après-midi, la tâche se réveille, ne trouve rien, et n'appelle
-- personne.
--
-- La fenêtre couvre DEUX situations :
--   * un match en cours ou tout juste fini — de 5 minutes avant le coup
--     d'envoi à 4 heures après (105 minutes de jeu, plus la marge pour un
--     match interrompu et pour le délai de publication du résultat) ;
--   * un match dont le RÉSULTAT MANQUE ENCORE, jusqu'à 3 jours après. C'est
--     le filet de sécurité : si l'API était en panne le soir du match, on
--     réessaie tout seul au lieu d'attendre un clic. Les 3 jours évitent
--     qu'un match annulé ou jamais renseigné ne relance la tâche
--     indéfiniment.
--
-- Ligue 1 uniquement : la fonction ne synchronise que FL1, un match de
-- Premier League sans score ne doit donc pas la déclencher.
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

-- ---------- 2. La question « y a-t-il un résultat à chercher ? » ----------
-- Isolée dans une fonction plutôt que noyée dans la commande de la tâche :
-- on peut la lire, la tester à la main, et voir tout de suite pourquoi la
-- synchronisation part ou ne part pas.
--
--   select public.sync_resultats_necessaire();
--
create or replace function public.sync_resultats_necessaire()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.matches m
    join public.matchdays d on d.id = m.matchday_id
    join public.competitions c on c.id = d.competition_id
    where c.external_code = 'FL1'
      and m.kickoff is not null
      and (
        -- Match en cours, ou fini depuis moins de 4 heures.
        (now() >= m.kickoff - interval '5 minutes' and now() <= m.kickoff + interval '4 hours')
        -- Ou match joué dont le score manque toujours : on réessaie.
        or (
          m.kickoff < now()
          and m.kickoff > now() - interval '3 days'
          and (m.home_score is null or m.away_score is null)
        )
      )
  );
$fn$;

revoke all on function public.sync_resultats_necessaire() from public, anon;
grant execute on function public.sync_resultats_necessaire() to authenticated;

-- ---------- 3. Repartir d'une base propre ----------
select cron.unschedule(jobid)
from cron.job
where jobname like 'prono-ligue1-sync%';

-- ---------- 4. Programmer ----------
-- Toutes les 10 minutes, décalé de 5 minutes par rapport aux rappels (qui
-- tournent à */5, donc à chaque dizaine pile) : les deux tâches ne réveillent
-- pas les fonctions au même instant.
select cron.schedule(
  'prono-ligue1-sync-resultats',
  '5,15,25,35,45,55 * * * *',
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
    )
    where public.sync_resultats_necessaire();
  $job$
);

-- ---------- 5. Contrôle ----------
-- Deux lignes actives : les rappels et la synchronisation.
select jobid, jobname, schedule, active
from cron.job
where jobname like 'prono-ligue1-%'
order by jobname;

-- Et la réponse du moment : true s'il y a un match en cours ou un résultat
-- manquant, false sinon.
select public.sync_resultats_necessaire() as synchronisation_necessaire_maintenant;
