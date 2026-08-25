-- ============================================================
-- MESSAGES PRIVÉS ENTRE JOUEURS
-- ============================================================
-- Jusqu'ici le Vestiaire n'avait qu'un salon commun : tout ce qui s'y écrit
-- est lu par les 23. Cette table ajoute la conversation à deux.
--
-- POURQUOI UNE TABLE À PART, et non une colonne sur `chat_messages` :
-- `chat_messages` est lisible par TOUT joueur connecté — c'est le principe
-- d'un salon commun. Y glisser des messages privés reviendrait à faire
-- dépendre leur confidentialité d'une condition ajoutée à une règle
-- existante ; la moindre erreur, aujourd'hui ou dans six mois, les rendrait
-- lisibles par tout le monde d'un coup. Une table séparée part de zéro : rien
-- n'y est lisible tant qu'une règle ne l'autorise pas explicitement, et cette
-- règle ne parle que de messages privés.
--
-- À EXÉCUTER dans Supabase → SQL Editor. Le script est rejouable : on peut le
-- relancer sans rien casser.
-- ============================================================

-- ---------- 1. La table ----------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  -- Quand le destinataire a ouvert la conversation. NULL = pas encore lu ;
  -- c'est ce qui alimente la pastille.
  read_at timestamptz,

  -- On ne s'écrit pas à soi-même : sans cette contrainte, un bug d'interface
  -- creerait une conversation fantome impossible a comprendre.
  constraint direct_messages_pas_soi_meme check (sender_id <> recipient_id),

  -- Même garde-fou que le salon commun : ni vide, ni démesuré. La vraie
  -- limite lisible par le joueur reste celle du site (2000 caractères).
  constraint direct_messages_content_check check (
    char_length(btrim(content)) >= 1 and char_length(content) <= 4000
  )
);

comment on table public.direct_messages is
  'Conversations à deux du Vestiaire. Lisible uniquement par l''expéditeur et le destinataire (voir les policies ci-dessous).';

-- ---------- 2. Index ----------
-- Lire une conversation = tous les messages échangés entre deux personnes,
-- dans l'ordre. Les deux sens comptent, d'où les deux index.
create index if not exists direct_messages_conversation_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);

create index if not exists direct_messages_recu_idx
  on public.direct_messages (recipient_id, created_at desc);

-- La pastille « non lus » interroge exclusivement les messages reçus non lus :
-- un index partiel, qui ne contient donc que ces lignes-là.
create index if not exists direct_messages_non_lus_idx
  on public.direct_messages (recipient_id)
  where read_at is null;

-- ---------- 3. Sécurité : personne ne lit la conversation des autres ----------
alter table public.direct_messages enable row level security;
-- `force` : la règle s'applique AUSSI au propriétaire de la table. Sans elle,
-- un rôle propriétaire contournerait tout ce qui suit.
alter table public.direct_messages force row level security;

-- Les droits de table (qui peut tenter l'operation) sont distincts des
-- policies (quelles lignes il verra). Supabase accorde ces droits par defaut
-- aux nouvelles tables, mais on les pose explicitement : la confidentialite ne
-- doit dependre d'aucun reglage de projet.
grant select, insert, update, delete on public.direct_messages to authenticated;
revoke all on public.direct_messages from anon;

drop policy if exists "lire mes conversations" on public.direct_messages;
create policy "lire mes conversations"
  on public.direct_messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "envoyer en mon nom" on public.direct_messages;
create policy "envoyer en mon nom"
  on public.direct_messages
  for insert
  to authenticated
  -- On ne peut écrire QUE sous sa propre identité : impossible de fabriquer un
  -- message qui semblerait venir de quelqu'un d'autre.
  with check (auth.uid() = sender_id);

drop policy if exists "marquer comme lu" on public.direct_messages;
create policy "marquer comme lu"
  on public.direct_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

drop policy if exists "supprimer mes envois" on public.direct_messages;
create policy "supprimer mes envois"
  on public.direct_messages
  for delete
  to authenticated
  -- Seul l'expéditeur retire ce qu'il a écrit. Le destinataire ne peut pas
  -- effacer une conversation chez l'autre.
  using (auth.uid() = sender_id);

-- ---------- 4. Le destinataire ne peut QUE marquer comme lu ----------
-- La policy d'update ci-dessus autorise le destinataire à modifier la ligne.
-- Sans le garde-fou qui suit, il pourrait aussi en réécrire le contenu — et
-- donc faire dire à quelqu'un ce qu'il n'a pas écrit. Ce déclencheur n'accepte
-- qu'un seul changement : la date de lecture.
create or replace function public.direct_messages_lecture_seule()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.content is distinct from old.content
     or new.created_at is distinct from old.created_at then
    raise exception 'Un message privé ne se modifie pas : seule sa date de lecture peut changer.';
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_lecture_seule on public.direct_messages;
create trigger direct_messages_lecture_seule
  before update on public.direct_messages
  for each row
  execute function public.direct_messages_lecture_seule();

-- ---------- 5. Temps réel ----------
-- Pour que le message apparaisse chez l'autre sans recharger la page. Les
-- règles ci-dessus s'appliquent aussi à ce flux : chacun ne reçoit que ce qui
-- le concerne.
do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;  -- déjà ajoutée, on continue
end;
$$;

-- ---------- 6. Vérification ----------
-- Doit renvoyer les quatre règles, et rowsecurity = true.
select relname, relrowsecurity as rls_active, relforcerowsecurity as rls_forcee
from pg_class
where oid = 'public.direct_messages'::regclass;

select policyname as regle, cmd as operation, qual as condition_lecture
from pg_policies
where schemaname = 'public' and tablename = 'direct_messages'
order by cmd;
