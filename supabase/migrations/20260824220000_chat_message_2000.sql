-- ============================================================
-- VESTIAIRE — LEVER LA LIMITE DE LONGUEUR DES MESSAGES
-- ============================================================
-- Constaté en production : le site accepte 2000 caractères, mais la base
-- refuse le message. L'erreur remontée par le serveur est une limite de
-- longueur — soit la colonne est un varchar(N) trop court, soit une
-- contrainte CHECK a été posée à la main.
--
-- Ce script traite les deux cas, et NE TOUCHE À RIEN D'AUTRE : pas aux
-- messages déjà envoyés, pas aux réactions, pas aux politiques d'accès.
-- ============================================================

-- ---------- AVANT ----------
-- À lire avant/après pour voir ce qui a changé.
select column_name, data_type, character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_messages'
  and column_name = 'content';

-- ---------- 1) La colonne passe en `text` ----------
-- `text` n'a aucune limite de longueur. C'est le type normal pour un message
-- de discussion : la vraie limite reste celle du site (2000 caractères),
-- affichée au joueur par le compteur pendant qu'il écrit.
--
-- L'opération élargit la colonne, elle ne peut donc perdre aucun message
-- existant.
alter table public.chat_messages
  alter column content type text;

-- ---------- 2) Les contraintes CHECK de longueur ----------
-- Si une contrainte du genre `length(content) <= 1000` a été posée, elle
-- refuserait toujours le message malgré le point 1. On les supprime, mais
-- UNIQUEMENT celles qui portent sur la longueur de `content` : toute autre
-- contrainte (message non vide, etc.) est laissée en place.
do $$
declare
  contrainte record;
begin
  for contrainte in
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.chat_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%length(content)%'
      and pg_get_constraintdef(oid) ~ '<=?\s*[0-9]+'
  loop
    raise notice 'Contrainte de longueur supprimée : % (%)',
      contrainte.conname, contrainte.definition;
    execute format('alter table public.chat_messages drop constraint %I', contrainte.conname);
  end loop;
end $$;

-- ---------- APRÈS ----------
-- `data_type` doit maintenant valoir `text`, et `character_maximum_length`
-- être vide.
select column_name, data_type, character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_messages'
  and column_name = 'content';

-- Et il ne doit plus rester de contrainte de longueur sur content.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.chat_messages'::regclass
  and contype = 'c';
