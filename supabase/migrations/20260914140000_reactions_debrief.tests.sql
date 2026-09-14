-- ============================================================
-- TESTS DES REACTIONS DU DEBRIEF
-- ============================================================
-- Ce que ces tests verifient n'est pas que « ca marche » mais que ca RESISTE :
-- un joueur ne doit pas pouvoir reagir a la place d'un autre, ni supprimer la
-- reaction de quelqu'un, ni enregistrer autre chose qu'un des six emojis —
-- meme en appelant l'API directement, sans passer par le site.
--
-- Passes sur PostgreSQL 16 le 14 septembre 2026. Les etapes 2, 4 et 5 DOIVENT
-- echouer : c'est leur echec qui prouve que la regle tient.
--
-- A n'executer que sur une base de test : ce script ecrit des donnees.
-- ============================================================

\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),
                              ('22222222-2222-2222-2222-222222222222');
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.debrief_reactions to authenticated;

\echo '--- 1. un joueur reagit'
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into public.debrief_reactions (user_id, journee, article, emoji)
values ('11111111-1111-1111-1111-111111111111', 4, 'leader', '🔥');

\echo '--- 2. le meme joueur ne peut pas reagir deux fois au meme article (doit ECHOUER)'
insert into public.debrief_reactions (user_id, journee, article, emoji)
values ('11111111-1111-1111-1111-111111111111', 4, 'leader', '👏');

\echo '--- 3. mais il peut reagir a un AUTRE article'
insert into public.debrief_reactions (user_id, journee, article, emoji)
values ('11111111-1111-1111-1111-111111111111', 4, 'chiffre', '😮');

\echo '--- 4. un emoji hors liste est refuse (doit ECHOUER)'
insert into public.debrief_reactions (user_id, journee, article, emoji)
values ('11111111-1111-1111-1111-111111111111', 4, 'conclusion', 'coucou');

\echo '--- 5. reagir A LA PLACE d''un autre est refuse (doit ECHOUER)'
insert into public.debrief_reactions (user_id, journee, article, emoji)
values ('22222222-2222-2222-2222-222222222222', 4, 'leader', '👏');

\echo '--- 6. supprimer la reaction d''un autre ne supprime rien'
set test.uid = '22222222-2222-2222-2222-222222222222';
delete from public.debrief_reactions where article = 'leader';

\echo '--- 7. mais chacun voit tout'
select user_id, journee, article, emoji from public.debrief_reactions order by article;

\echo '--- 8. et chacun peut changer son propre emoji'
set test.uid = '11111111-1111-1111-1111-111111111111';
update public.debrief_reactions set emoji = '💪' where article = 'leader';
select article, emoji from public.debrief_reactions order by article;
