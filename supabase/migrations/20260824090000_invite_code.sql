-- ============================================================
-- CODE D'INVITATION
-- ============================================================
-- La ligue est privée et dotée d'une cagnotte : seuls les joueurs invités
-- doivent pouvoir créer un compte. Le code vit ici plutôt que dans le code
-- du site (qui est téléchargé par le navigateur, donc lisible par tous) ou
-- dans une variable d'environnement (qui obligerait à redéployer à chaque
-- changement). L'admin le régénère quand il veut depuis Admin → Réglages :
-- l'ancien cesse aussitôt de fonctionner.
--
-- Table volontairement séparée de app_settings : app_settings est lisible
-- par tous les joueurs connectés, le code ne doit l'être par personne
-- d'autre que l'admin.
-- ============================================================

create table if not exists public.app_invite (
  id smallint primary key default 1,
  code text not null,
  updated_at timestamptz not null default now(),
  constraint app_invite_single_row check (id = 1)
);

comment on table public.app_invite is
  'Code d''invitation exigé à l''inscription. Une seule ligne (id = 1).';

-- Code initial aléatoire : jamais de valeur par défaut devinable.
insert into public.app_invite (id, code)
values (1, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)))
on conflict (id) do nothing;

alter table public.app_invite enable row level security;

-- Aucune politique de lecture pour les joueurs : même connectés, ils ne
-- peuvent pas lire le code. Seul l'admin y accède, et la route serveur
-- api/verifier-invitation.ts qui utilise la clé de service.
drop policy if exists "app_invite_admin_all" on public.app_invite;
create policy "app_invite_admin_all"
  on public.app_invite
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Vérification : doit renvoyer une ligne avec un code de 8 caractères.
-- select id, code, updated_at from public.app_invite;
