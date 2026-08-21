-- ============================================================
-- Suite de l'audit sécurité (2026-08-11) : confidentialité de `payments`
-- + nettoyage d'une RPC publique morte.
-- ============================================================

-- ------------------------------------------------------------
-- 1) payments — la table redevient privée (admin uniquement).
--
-- L'ancienne policy `payments_select` (`auth.role() = 'authenticated'`)
-- laissait n'importe quel joueur connecté lire TOUTES les lignes de
-- `payments` : user_id, notes, statut/montant individuel de chacun.
-- Seule l'écriture était déjà correctement restreinte à is_admin()
-- (policy `payments_admin_write`, conservée telle quelle).
--
-- Aucun joueur ne lit aujourd'hui sa propre ligne (vérifié : seuls
-- src/services/adminService.ts — admin — et src/routes/index.tsx — cagnotte
-- publique, remplacée ci-dessous par une vue agrégée — interrogent
-- `payments`). Pas de policy "sa propre ligne" ajoutée : elle serait
-- inutilisée en l'état ; à ajouter plus tard uniquement si une page joueur
-- a réellement besoin d'afficher son propre statut de paiement.
-- ------------------------------------------------------------
drop policy if exists "payments_select" on public.payments;

-- ------------------------------------------------------------
-- 2) pot_public — vue agrégée exposant UNIQUEMENT le total de la cagnotte.
--
-- Ne renvoie qu'une seule ligne (un total), jamais les lignes
-- individuelles : aucune colonne user_id/notes/paid par ligne n'est
-- exposée, donc aucun moyen de reconstituer les paiements de qui que ce
-- soit à partir de cette vue, quels que soient les filtres appliqués côté
-- client (il n'y a rien à filtrer : pas de colonne user_id à exposer, pas
-- de GROUP BY).
--
-- Vue volontairement "security definer" (comportement par défaut d'une vue
-- Postgres : security_invoker = false) : elle s'exécute avec les droits de
-- son propriétaire (le rôle de migration, qui contourne RLS comme
-- propriétaire de la table), donc `sum(amount) filter (where paid)` porte
-- bien sur l'ENSEMBLE des paiements, pas seulement sur ceux visibles par
-- l'appelant — indispensable puisque `payments` n'accorde plus aucun accès
-- direct aux joueurs (étape 1 ci-dessus). C'est un contournement de RLS
-- délibéré et sans risque : seul un total agrégé est exposé, jamais une
-- ligne individuelle.
-- ------------------------------------------------------------
create or replace view public.pot_public
with (security_invoker = false)
as
select
  coalesce(sum(amount) filter (where paid), 0)::numeric as total_amount
from public.payments;

grant select on public.pot_public to anon, authenticated;

-- ------------------------------------------------------------
-- 3) can_update_favorite_team(uuid) — RPC publique mais déjà cassée
--    (référence profiles.role et app_settings.key/value, colonnes
--    inexistantes — vérifié : `select role from profiles`/`select value
--    from app_settings where key = ...` échoueraient à l'exécution) et non
--    appelée nulle part dans le code applicatif (aucun `.rpc(...)` dans
--    src/). Aucune dépendance trouvée (pg_depend : 0 objet en dépend).
--    Supprimée plutôt que réparée : elle portait sur une logique de
--    verrouillage de date limite déjà gérée différemment aujourd'hui
--    (app_settings.favorite_team_deadline / favorite_team_auto_lock, lus
--    directement par src/routes/profil.tsx) — la garder cassée revenait à
--    laisser une RPC publique mais morte, sans utilité ni risque actif
--    (elle échoue plutôt que de mal faire), mais plus propre de la retirer
--    que de la laisser traîner indéfiniment.
-- ------------------------------------------------------------
drop function if exists public.can_update_favorite_team(uuid);
