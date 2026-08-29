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
-- COMMENT L'ADRESSE ET LE SECRET SONT TROUVÉS
-- ------------------------------------------------------------
-- La première version lisait deux secrets dans Vault. Elle a échoué sur le
-- projet réel : les secrets y ont été installés autrement, et le script s'est
-- arrêté net.
--
-- On ne devine donc plus rien. On RECOPIE la commande de la tâche de rappel
-- qui fonctionne déjà, en remplaçant simplement le nom de la fonction
-- appelée. Peu importe comment l'adresse et le secret y sont écrits — Vault,
-- texte en clair, ou autre : ce qui marche pour les rappels marchera pour la
-- synchronisation, sans que ce script ait besoin de les lire.
--
-- ------------------------------------------------------------
-- RÉVEIL FRÉQUENT, APPEL RARE
-- ------------------------------------------------------------
-- La tâche se réveille toutes les 10 minutes, mais elle n'appelle la fonction
-- QUE s'il y a réellement un résultat à aller chercher (voir
-- sync_resultats_necessaire ci-dessous). Le réveil coûte une petite requête
-- sur `matches` ; l'appel, lui, réveille une Edge Function et consomme le
-- quota football-data.org.
--
-- PRÉALABLE : la fonction sync-ligue1-matches doit avoir été redéployée avec
-- le chemin cron (en-tête x-cron-secret). Sans cela, l'appel repartira en 401
-- et rien ne sera synchronisé — sans casser quoi que ce soit.
--
-- À EXÉCUTER dans Supabase → SQL Editor. Le script est rejouable.
-- ============================================================

-- ---------- 1. La question « y a-t-il un résultat à chercher ? » ----------
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
        -- Match en cours, ou fini depuis moins de 4 heures. (105 minutes de
        -- jeu, plus la marge pour une interruption et pour le délai de
        -- publication du résultat.)
        (now() >= m.kickoff - interval '5 minutes' and now() <= m.kickoff + interval '4 hours')
        -- Ou match joué dont le score manque toujours : on réessaie tout
        -- seul, jusqu'à 3 jours. Au-delà, on abandonne — sinon un match
        -- annulé ou jamais renseigné relancerait la tâche indéfiniment.
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

-- ---------- 2. Programmer, en recopiant la tâche des rappels ----------
do $bloc$
declare
  v_rappel text;
  v_sync text;
  v_url text;
  v_secret text;
begin
  select command into v_rappel
  from cron.job
  where jobname like 'prono-ligue1-reminders%'
  order by jobid desc
  limit 1;

  if v_rappel is null then
    raise exception
      'Aucune tâche de rappel trouvée (jobname commençant par « prono-ligue1-reminders »). C''est elle qui sert de modèle : elle doit être en place avant celle-ci.';
  end if;

  if position('send-prono-reminders' in v_rappel) > 0 then
    -- CAS COURANT : l'adresse figure en clair dans la commande. Même
    -- commande, autre fonction appelée — le secret est recopié tel quel,
    -- sans que ce script ait besoin de le lire.
    v_sync := replace(v_rappel, 'send-prono-reminders', 'sync-ligue1-matches');

  else
    -- L'adresse ne figure pas en clair : elle vient d'ailleurs, typiquement
    -- de Vault. On reconstruit alors la commande à partir des secrets, à
    -- condition de les trouver.
    select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'prono_reminder_function_url';

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'prono_reminder_cron_secret';

    if v_url is null or v_secret is null then
      raise exception
        'Impossible de retrouver l''adresse de la fonction : elle n''apparaît pas dans la commande des rappels et les secrets Vault attendus sont absents. Regarde ta tâche existante avec :  select jobname, schedule from cron.job;  puis dis-moi comment l''adresse y est écrite.';
    end if;

    v_sync := format(
      $modele$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
      body := jsonb_build_object('source', 'supabase-cron')
    );
$modele$,
      replace(v_url, 'send-prono-reminders', 'sync-ligue1-matches'),
      v_secret
    );
  end if;

  -- ON RETIRE LE POINT-VIRGULE FINAL pour accrocher la condition.
  --
  -- `rtrim(texte)` ne supprime QUE des espaces, pas les retours à la ligne :
  -- la commande se terminant par « ; » suivi d'un saut de ligne, la première
  -- version laissait le point-virgule en place et produisait une commande
  -- invalide — « ); » puis « where ... ». C'est le test qui l'a montré, en
  -- exécutant la vraie commande enregistrée.
  v_sync := regexp_replace(v_sync, '\s*;\s*$', '');
  v_sync := v_sync || E'\n    where public.sync_resultats_necessaire();';

  -- Rejouable : on retire une éventuelle version précédente.
  perform cron.unschedule(jobid) from cron.job where jobname like 'prono-ligue1-sync%';

  -- Toutes les 10 minutes, décalé de 5 minutes par rapport aux rappels (qui
  -- tournent à */5, donc à chaque dizaine pile) : les deux tâches ne
  -- réveillent pas les fonctions au même instant.
  perform cron.schedule(
    'prono-ligue1-sync-resultats',
    '5,15,25,35,45,55 * * * *',
    v_sync
  );
end
$bloc$;

-- ---------- 3. Contrôle ----------
-- Deux lignes actives : les rappels et la synchronisation.
select jobid, jobname, schedule, active
from cron.job
where jobname like 'prono-ligue1-%'
order by jobname;

-- La réponse du moment : true s'il y a un match en cours ou un résultat
-- manquant, false sinon.
select public.sync_resultats_necessaire() as synchronisation_necessaire_maintenant;
