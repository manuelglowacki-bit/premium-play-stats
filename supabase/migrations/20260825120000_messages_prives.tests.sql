-- ============================================================
-- MESSAGES PRIVÉS — VÉRIFICATION DES RÈGLES DE CONFIDENTIALITÉ
-- ============================================================
-- Ce fichier N'EST PAS à exécuter dans Supabase : il sert à prouver, sur une
-- base PostgreSQL jetable, que les règles de 20260825120000_messages_prives.sql
-- font bien ce qu'elles annoncent. Un message privé qui fuite ne se voit pas —
-- il faut donc le tester, pas le supposer.
--
-- Trois joueurs : A, B et C. A écrit à B ; C ne doit jamais rien en savoir.
--
-- Pour le rejouer :
--   initdb + createdb, puis le socle Supabase minimal (rôle `authenticated`,
--   schéma `auth`, `auth.uid()` lisant request.jwt.claim.sub), puis la
--   migration, puis ce fichier. Les 13 lignes doivent commencer par OK.
-- ============================================================

\set QUIET on
\pset tuples_only on
\pset format unaligned

truncate public.direct_messages;

create or replace function public.essai(nom text, sql text, attendu text)
returns text language plpgsql as $$
declare resultat text;
begin
  begin
    execute sql into resultat;
    resultat := coalesce(resultat, 'null');
  exception when others then
    resultat := 'REFUSE';
  end;
  if resultat = attendu then
    return format('OK   %s  (%s)', nom, resultat);
  end if;
  return format('ECHEC %s  attendu=%s obtenu=%s', nom, attendu, resultat);
end;
$$;

-- ============ A ecrit a B ============
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.essai(
  'A peut ecrire a B',
  $q$insert into public.direct_messages (sender_id, recipient_id, content)
     values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Salut, on parie 10 balles sur le derby ?')
     returning 'envoye'$q$, 'envoye');

select public.essai('A ne peut PAS ecrire au nom de C',
  $q$insert into public.direct_messages (sender_id, recipient_id, content)
     values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','faux message')
     returning 'envoye'$q$, 'REFUSE');

select public.essai('A ne peut PAS s ecrire a lui-meme',
  $q$insert into public.direct_messages (sender_id, recipient_id, content)
     values ('11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','moi-meme')
     returning 'envoye'$q$, 'REFUSE');

select public.essai('A ne peut PAS envoyer un message vide',
  $q$insert into public.direct_messages (sender_id, recipient_id, content)
     values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','   ')
     returning 'envoye'$q$, 'REFUSE');

select public.essai('A relit sa conversation',
  $q$select count(*)::text from public.direct_messages$q$, '1');

-- ============ B, le destinataire ============
reset role; set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.essai('B voit le message recu',
  $q$select count(*)::text from public.direct_messages$q$, '1');

select public.essai('B peut marquer comme lu',
  $q$update public.direct_messages set read_at = now()
     where recipient_id = '22222222-2222-2222-2222-222222222222'
     returning 'lu'$q$, 'lu');

select public.essai('B ne peut PAS reecrire le message de A',
  $q$update public.direct_messages set content = 'j ai jamais dit ca'
     where recipient_id = '22222222-2222-2222-2222-222222222222'
     returning 'modifie'$q$, 'REFUSE');

select public.essai('B ne peut PAS supprimer le message de A',
  $q$with d as (delete from public.direct_messages
       where recipient_id = '22222222-2222-2222-2222-222222222222'
       returning 1) select count(*)::text from d$q$, '0');

-- ============ C, un tiers ============
reset role; set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.essai('C ne voit RIEN de la conversation A-B',
  $q$select count(*)::text from public.direct_messages$q$, '0');

select public.essai('C ne peut PAS marquer lu chez les autres',
  $q$with u as (update public.direct_messages set read_at = now()
       returning 1) select count(*)::text from u$q$, '0');

select public.essai('C ne peut PAS supprimer chez les autres',
  $q$with d as (delete from public.direct_messages returning 1)
     select count(*)::text from d$q$, '0');

-- ============ A supprime son propre envoi ============
reset role; set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.essai('A peut retirer ce qu il a ecrit',
  $q$with d as (delete from public.direct_messages
       where sender_id = '11111111-1111-1111-1111-111111111111'
       returning 1) select count(*)::text from d$q$, '1');

reset role;
