-- ============================================================
-- TOUS LES EMOJIS SUR LE DEBRIEF
-- ============================================================
-- Les deux versions precedentes n'autorisaient qu'une liste fermee (six,
-- puis douze emojis). L'organisateur veut la totalite : le choix se fait
-- desormais dans un selecteur par categories, et la liste ne peut plus etre
-- ecrite en dur dans une contrainte.
--
-- LA CONTRAINTE CHANGE DONC DE NATURE : elle ne dit plus « cet emoji-la »
-- mais « un symbole court, pas du texte ». C'est ce qui compte vraiment.
-- Sans elle, la colonne `emoji` deviendrait un champ de TEXTE LIBRE : le
-- Debrief, lu par les vingt-trois joueurs, pourrait alors servir a ecrire
-- n'importe quoi, sans moderation possible et sans que l'interface le
-- montre. La regle ci-dessous tient meme si quelqu'un appelle l'API
-- directement, sans passer par le site.
--
--   longueur 1 a 8 caracteres  -> assez pour un drapeau, une teinte de peau
--                                 ou une famille ; trop court pour une phrase
--   aucune lettre              -> « arnaque » ne passe pas
--   aucun chiffre              -> « 42 » non plus
--   aucun espace ni saut de ligne
--
-- Les reactions deja posees restent valides : tous les emojis des versions
-- precedentes satisfont cette regle.
--
-- A EXECUTER dans Supabase -> SQL Editor. Rejouable.
-- ============================================================

alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_emoji_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_emoji_valide check (
    char_length(emoji) between 1 and 8
    and emoji !~ '[[:alpha:]]'
    and emoji !~ '[[:digit:]]'
    and emoji !~ '[[:space:]]'
  );

comment on constraint debrief_reactions_emoji_valide on public.debrief_reactions is
  'Un symbole court, jamais du texte. Empeche la colonne emoji de devenir un champ libre.';
