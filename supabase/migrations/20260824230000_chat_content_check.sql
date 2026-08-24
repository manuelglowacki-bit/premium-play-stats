-- ============================================================
-- VESTIAIRE — LA CONTRAINTE QUI REFUSE LES MESSAGES DE 2000 CARACTÈRES
-- ============================================================
-- Contrainte trouvée en production :
--
--   chat_messages_content_check
--   CHECK (char_length(TRIM(BOTH FROM content)) >= 1
--      AND char_length(content) <= 1000)
--
-- Elle fait DEUX choses, et une seule pose problème :
--   * `>= 1` interdit d'envoyer un message vide — on la garde ;
--   * `<= 1000` plafonne la longueur — c'est elle qui refuse le message.
--
-- (Le script précédent l'avait manquée : il cherchait le texte
--  `length(content)`, alors qu'elle s'écrit `char_length(TRIM(BOTH FROM
--  content))`. Ici on la traite par son nom, plus aucun motif à deviner.)
--
-- POURQUOI 6000 ET PAS 2000 : ce qui est stocké dans `content` n'est pas
-- toujours le texte seul. Dès qu'il y a une photo ou une réponse à un autre
-- message, le site enregistre un petit paquet JSON qui contient le texte
-- PLUS les adresses des images PLUS l'extrait cité :
--
--   {"v":1,"text":"...","images":["https://.../photo.jpg", ...],"replyTo":{...}}
--
-- Un message de 2000 caractères accompagné de six photos dépasse donc
-- largement 2000 caractères une fois emballé. La vraie limite lisible par le
-- joueur reste celle du site (2000 caractères, avec le compteur sous le
-- champ) ; celle-ci n'est qu'un garde-fou côté base, et doit être posée
-- au-dessus, sinon elle refuse des messages parfaitement légitimes.
-- ============================================================

-- ---------- AVANT ----------
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.chat_messages'::regclass
  and contype = 'c';

-- ---------- Remplacement ----------
alter table public.chat_messages
  drop constraint if exists chat_messages_content_check;

alter table public.chat_messages
  add constraint chat_messages_content_check
  check (
    char_length(trim(both from content)) >= 1  -- toujours pas de message vide
    and char_length(content) <= 6000           -- garde-fou, jamais atteint en usage normal
  );

-- ---------- Filet de sécurité ----------
-- Si une AUTRE contrainte de longueur sur content traînait sous un nom
-- différent, elle refuserait encore le message. On les repère par leur
-- définition (elle mentionne `content` et un plafond `<=`), sans toucher à
-- celle qu'on vient de poser.
do $$
declare
  contrainte record;
begin
  for contrainte in
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.chat_messages'::regclass
      and contype = 'c'
      and conname <> 'chat_messages_content_check'
      and pg_get_constraintdef(oid) ilike '%content%'
      and pg_get_constraintdef(oid) like '%<=%'
  loop
    raise notice 'Autre contrainte de longueur supprimée : % (%)',
      contrainte.conname, contrainte.definition;
    execute format('alter table public.chat_messages drop constraint %I', contrainte.conname);
  end loop;
end $$;

-- ---------- APRÈS ----------
-- Il ne doit rester qu'une contrainte, avec `>= 1` et `<= 6000`.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.chat_messages'::regclass
  and contype = 'c';
