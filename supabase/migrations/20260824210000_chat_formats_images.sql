-- ============================================================
-- VESTIAIRE — FORMATS D'IMAGES + DIAGNOSTIC
-- ============================================================
-- Le bucket n'acceptait que jpeg, png, webp et gif. Or les photos prises
-- avec un iPhone sont en HEIC par défaut : le fichier était refusé par le
-- serveur, sans que le joueur comprenne pourquoi.
--
-- On ajoute donc HEIC/HEIF, AVIF et BMP. Le contrôle côté site (voir
-- ALLOWED_IMAGE_TYPES dans src/routes/trophees.tsx) accepte exactement la
-- même liste : les deux niveaux doivent rester d'accord, sinon un fichier
-- passe le premier contrôle pour être rejeté par le second.
--
-- SVG reste volontairement exclu : un SVG peut contenir du code exécuté par
-- le navigateur de celui qui l'ouvre. Dans un salon où 23 personnes
-- s'envoient des images, ce n'est pas un risque à prendre.
-- ============================================================

-- 1) Le bucket existe-t-il seulement ? S'il a été créé à la main dans le
--    tableau de bord, il peut avoir d'autres réglages. On le (re)pose
--    entièrement plutôt que de supposer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  26214400, -- 25 Mo, la même limite que celle appliquée dans le navigateur
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/avif', 'image/bmp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 2) DIAGNOSTIC — à lire après avoir lancé le script
-- ============================================================

-- a) Le bucket doit être public, à 26214400, et la liste doit contenir
--    image/heic.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'chat-images';

-- b) La colonne qui stocke les messages. Si "data_type" vaut
--    character varying avec une longueur de 1000, un message de 2000
--    caractères est refusé par la base : c'est cette ligne-là qu'il faut
--    corriger (voir la commande commentée juste en dessous).
select column_name, data_type, character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_messages'
  and column_name = 'content';

-- c) Une contrainte de longueur posée à la main ?
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.chat_messages'::regclass
  and contype = 'c';

-- ============================================================
-- 3) SI ET SEULEMENT SI le diagnostic (b) montre une limite trop courte,
--    lancer la ligne ci-dessous en enlevant les deux tirets.
--    `text` n'a pas de limite de longueur : plus jamais de message refusé
--    parce qu'il est trop long.
-- ============================================================
-- alter table public.chat_messages alter column content type text;
