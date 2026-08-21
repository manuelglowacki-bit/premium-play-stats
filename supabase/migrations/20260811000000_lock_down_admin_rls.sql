-- ============================================================
-- Audit sécurité RLS admin (2026-08-11)
-- ============================================================
-- Trois failles réelles identifiées en inspectant le schéma/policies/
-- fonctions réels via `supabase db query --linked` (lecture seule) :
--
-- 1. predictions : une policy "Public all predictions" (ALL, USING true,
--    WITH CHECK true, rôle public) coexistait avec les policies correctes
--    (predictions_select/insert/update scopées à auth.uid() = user_id).
--    Les policies RLS permissives se combinent en OR : cette policy à elle
--    seule annulait toute la restriction des autres — n'importe quel
--    utilisateur (même anon) pouvait lire/modifier/supprimer les
--    pronostics de n'importe quel autre joueur.
--
-- 2. profiles : les policies UPDATE/INSERT existantes ("Update own
--    profile"/"profiles_update"/"Insert own profile"/"profiles_insert")
--    n'autorisent que auth.uid() = id, mais RLS ne restreint jamais les
--    colonnes — un joueur pouvait donc s'auto-promouvoir admin via
--    `update profiles set is_admin = true where id = auth.uid()`
--    (ou en l'incluant dans l'insert de son propre profil), ce qui
--    contourne entièrement AdminRoute/isAdmin côté front (qui ne lisent
--    que cette colonne).
--
-- 3. delete_user_by_id(uuid) : fonction SECURITY DEFINER qui supprime un
--    compte de auth.users, EXECUTE accordé à `anon`/`authenticated`
--    (défaut Postgres), sans la moindre vérification admin dans son corps
--    (le commentaire d'origine notait explicitement ce contrôle comme
--    "optionnel" — jamais implémenté). N'importe qui pouvait supprimer
--    n'importe quel compte, y compris celui de l'admin, sans même être
--    connecté.
--
-- Aucune nouvelle colonne/table. Réutilise `is_admin()`, déjà existante,
-- déjà SECURITY DEFINER (donc sans risque de récursion RLS sur profiles),
-- déjà utilisée par les policies payments/profiles/app_settings.
-- ============================================================

-- ------------------------------------------------------------
-- 1) predictions — retirer la policy trop permissive, et ajouter le
--    DELETE scopé qui manquait (nécessaire à pronostics.tsx pour
--    remplacer le choix de match bonus : delete + insert sur ses propres
--    lignes). Les policies select/insert/update existantes (auth.uid() =
--    user_id) sont conservées telles quelles.
-- ------------------------------------------------------------
drop policy if exists "Public all predictions" on public.predictions;

create policy "predictions_delete"
  on public.predictions
  for delete
  to public
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) profiles — empêcher toute auto-promotion admin. Un joueur garde le
--    droit de modifier pseudo/avatar_url/favorite_team/favorite_team_id/
--    favorite_team_override sur sa propre ligne (policies inchangées) ;
--    seule une tentative de changer `is_admin` sans être déjà admin est
--    neutralisée (silencieusement ramenée à la valeur précédente/false —
--    pas d'erreur qui casserait un upsert légitime n'y touchant pas).
-- ------------------------------------------------------------
create or replace function public.protect_is_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_admin is true and not public.is_admin() then
      new.is_admin := false;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_admin_column on public.profiles;

create trigger trg_protect_is_admin_column
  before insert or update on public.profiles
  for each row
  execute function public.protect_is_admin_column();

-- ------------------------------------------------------------
-- 3) delete_user_by_id — vérification admin réellement appliquée.
--    Même signature/comportement pour un admin ; refuse net pour
--    quiconque d'autre (aucun appel `.rpc()` n'existe dans le code
--    applicatif actuel, donc aucun flux légitime cassé).
-- ------------------------------------------------------------
create or replace function public.delete_user_by_id(user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut supprimer un compte.';
  end if;

  delete from auth.users where id = user_id;
end;
$$;
