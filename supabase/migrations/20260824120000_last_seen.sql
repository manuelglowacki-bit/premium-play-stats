-- ============================================================
-- DERNIÈRE VISITE RÉELLE
-- ============================================================
-- auth.users.last_sign_in_at ne change que lors d'une authentification :
-- quelqu'un qui reste connecté et ouvre le site tous les samedis depuis six
-- mois y affiche encore la date de son inscription. Pour savoir qui est
-- réellement passé, il faut noter la visite elle-même.
--
-- L'application écrit cette date au plus une fois par heure et par joueur
-- (voir src/components/prono/AppShell.tsx) : aucune charge notable.
-- ============================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Dernière ouverture réelle du site par ce joueur. Écrit par l''application, au plus une fois par heure.';

-- Chaque joueur met à jour SA propre ligne : la politique d'écriture
-- existante sur profiles (pseudo, avatar, équipe favorite) couvre déjà ce
-- cas. Rien de nouveau à ouvrir.

-- Vérification : la colonne doit apparaître.
-- select column_name from information_schema.columns
-- where table_name = 'profiles' and column_name = 'last_seen_at';
