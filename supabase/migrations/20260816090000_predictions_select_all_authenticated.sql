-- ============================================================
-- Classement global lisible par tous les joueurs connectés
-- ============================================================
-- Cause du bug "chaque compte ne voit que ses propres points dans le
-- classement" : la migration 20260811000000_lock_down_admin_rls.sql a
-- retiré à raison la policy "Public all predictions" (ALL — lecture ET
-- écriture pour n'importe qui, faille de sécurité réelle : n'importe quel
-- compte pouvait MODIFIER les pronostics des autres). Mais aucune policy de
-- LECTURE seule n'a été remise en place pour couvrir le besoin légitime du
-- classement — restaient uniquement les policies predictions_select/
-- insert/update, scopées à `auth.uid() = user_id`. Résultat : un joueur
-- connecté ne pouvait plus lire QUE ses propres lignes de `predictions` ;
-- src/routes/classement.tsx interroge pourtant déjà `predictions` sans
-- filtre user_id (il calcule le score de tout le monde côté client) — la
-- requête ne remontait donc que ses propres lignes, et tous les autres
-- joueurs restaient à 0 point (valeur d'initialisation, jamais dépassée
-- faute de lignes visibles).
--
-- Fix minimal et sécurisé : une policy SELECT supplémentaire, réservée aux
-- utilisateurs authentifiés (jamais `anon`), qui s'ADDITIONNE à la policy
-- existante (les policies RLS pour une même opération se combinent en OR —
-- elle ne la remplace pas, ne la supprime pas). L'écriture reste strictement
-- inchangée et scopée à `auth.uid() = user_id` (insert/update/delete) :
-- un joueur peut toujours lire le classement complet, mais ne peut modifier
-- que ses propres pronostics.
create policy "predictions_select_all_authenticated"
  on public.predictions
  for select
  to authenticated
  using (true);
