-- ============================================================
-- Onglet Bonus : activation/désactivation des championnats
-- ============================================================
-- L'admin doit pouvoir activer/désactiver individuellement les grands
-- championnats européens synchronisés depuis football-data.org. On stocke
-- cet état côté `competitions` plutôt que dans le front (localStorage),
-- pour que ce soit partagé entre admins et persistant.

alter table public.competitions
  add column if not exists is_active boolean not null default false;

-- Ligue 1 est déjà utilisée telle quelle par l'onglet Matchs : on l'active
-- par défaut pour ne rien changer au comportement existant.
update public.competitions
  set is_active = true
  where external_code = 'FL1';

-- Rattachement des 4 grands championnats déjà présents en base (créés sans
-- external_code jusqu'ici, voir commentaire dans
-- 20260809085125_add_football_data_sync.sql) à leur code football-data.org,
-- pour permettre leur synchronisation depuis l'onglet Bonus.
update public.competitions set external_code = 'PL'  where name = 'Premier League' and external_code is null;
update public.competitions set external_code = 'PD'  where name = 'La Liga'        and external_code is null;
update public.competitions set external_code = 'SA'  where name = 'Serie A'        and external_code is null;
update public.competitions set external_code = 'BL1' where name = 'Bundesliga'     and external_code is null;
