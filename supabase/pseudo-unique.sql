-- ============================================================
-- PSEUDO UNIQUE
-- ============================================================
-- Rien n'empêchait deux joueurs d'avoir le même pseudo : deux « Max » dans
-- le classement, impossible de savoir qui est qui. La page d'inscription
-- vérifie désormais avant de créer le compte, mais un contrôle côté site
-- peut toujours être contourné : la garantie doit venir de la base.
--
-- À exécuter dans Supabase → SQL Editor, dans l'ordre.
-- ============================================================


-- ÉTAPE 1 — Y a-t-il déjà des doublons ?
-- La comparaison ignore la casse et les espaces : « Max », « max » et
-- « Max  » seraient trois pseudos différents pour Postgres, mais le même
-- nom à l'écran.
--
-- Si cette requête ne renvoie AUCUNE ligne, passe directement à l'étape 3.

select
  lower(trim(pseudo)) as pseudo_normalise,
  count(*)            as nombre,
  array_agg(id)       as comptes_concernes
from profiles
where pseudo is not null
  and trim(pseudo) <> ''
group by 1
having count(*) > 1
order by nombre desc;


-- ÉTAPE 2 — Seulement si l'étape 1 a renvoyé des lignes.
-- Renomme les doublons À LA MAIN avant de continuer : l'index de l'étape 3
-- échouera tant qu'il en reste. Remplace l'identifiant et le nouveau pseudo.
--
-- update profiles set pseudo = 'Max62' where id = 'colle-ici-un-id-du-tableau';


-- ÉTAPE 3 — La contrainte.
-- Index unique sur le pseudo normalisé : deux comptes ne peuvent plus porter
-- le même nom, quelles que soient les majuscules ou les espaces.
-- Les profils sans pseudo (null ou vide) ne sont pas concernés.

create unique index if not exists profiles_pseudo_unique
  on profiles (lower(trim(pseudo)))
  where pseudo is not null and trim(pseudo) <> '';


-- ÉTAPE 4 — Vérification. Doit renvoyer une ligne nommée
-- « profiles_pseudo_unique ».

select indexname
from pg_indexes
where tablename = 'profiles'
  and indexname = 'profiles_pseudo_unique';
