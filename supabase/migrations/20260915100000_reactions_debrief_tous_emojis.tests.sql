-- ============================================================
-- TESTS DE LA REGLE « UN SYMBOLE, PAS DU TEXTE »
-- ============================================================
-- La colonne `emoji` du Debrief ne doit JAMAIS pouvoir servir de champ de
-- texte libre : la page est lue par les vingt-trois joueurs, et un texte
-- glisse la ne passerait par aucune moderation.
--
-- Les six premiers inserts DOIVENT passer, les six suivants DOIVENT echouer.
-- Passes sur PostgreSQL 16 le 15 septembre 2026 : 6 lignes acceptees, 6
-- refusees.
--
-- A n'executer que sur une base de test : ce script ecrit des donnees.
-- ============================================================

\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
\echo '=== CE QUI DOIT PASSER ==='
insert into public.debrief_reactions (user_id, journee, article, emoji) values
 ('11111111-1111-1111-1111-111111111111', 4, 'a', '🔥'),
 ('11111111-1111-1111-1111-111111111111', 4, 'b', '🐐'),
 ('11111111-1111-1111-1111-111111111111', 4, 'c', '❤️'),
 ('11111111-1111-1111-1111-111111111111', 4, 'd', '👏🏽'),
 ('11111111-1111-1111-1111-111111111111', 4, 'e', '🇫🇷'),
 ('11111111-1111-1111-1111-111111111111', 4, 'f', '👨‍👩‍👧');
\echo '=== CE QUI DOIT ECHOUER (un par un) ==='
\echo '-- un mot'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'g', 'arnaque');
\echo '-- une phrase'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'h', 'salut les gars');
\echo '-- un chiffre'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'i', '42');
\echo '-- un emoji suivi d un mot'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'j', '🔥 nul');
\echo '-- trop long'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'k', '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
\echo '-- un saut de ligne'
insert into public.debrief_reactions (user_id, journee, article, emoji) values ('11111111-1111-1111-1111-111111111111', 4, 'l', E'\n');
\echo '=== BILAN ==='
select count(*) as acceptees from public.debrief_reactions;
