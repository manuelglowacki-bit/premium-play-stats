-- ============================================================
-- JOURNÉES EN DOUBLE — CONSTAT D'ABORD, RÉPARATION ENSUITE
-- ============================================================
-- Constaté : chaque numéro de journée existe en CINQ exemplaires dans la
-- même saison. Quatre en `manual` sans aucun match de Ligue 1, une en
-- `auto_minus_1` qui porte les 9 matchs et les options bonus.
--
-- Conséquence sur les points : depuis le correctif, un bonus est rattaché à
-- la journée de SON match. Si des matchs bonus pendent à une journée en
-- double, leurs points sont comptés — le total reste juste — mais ils
-- apparaissent sur une « autre » journée 1 que les points de Ligue 1. Le
-- détail par journée est alors coupé en deux.
--
-- ⚠️ NE RIEN SUPPRIMER AVANT D'AVOIR LU LA PARTIE 1.
-- Une journée qui semble vide peut porter des matchs BONUS : la colonne
-- « matchs_l1 » ne compte que is_bonus = false et ne les voit pas. Supprimer
-- une telle journée détruirait des pronostics et les points qui vont avec.
-- ============================================================


-- ============================================================
-- PARTIE 1 — CONSTAT (aucune modification)
-- ============================================================

-- 1a) Tout ce que porte réellement chaque journée, matchs bonus COMPRIS.
select
  md.id,
  md.number                                                              as journee,
  md.deadline_mode,
  (select count(*) from matches m where m.matchday_id = md.id and m.is_bonus = false) as matchs_l1,
  (select count(*) from matches m where m.matchday_id = md.id and m.is_bonus = true)  as matchs_bonus,
  (select count(*) from bonus_options bo where bo.matchday_id = md.id)   as options,
  (select count(*) from predictions p
     join matches m on m.id = p.match_id
    where m.matchday_id = md.id)                                         as pronostics,
  case
    when (select count(*) from matches m where m.matchday_id = md.id) = 0
     and (select count(*) from bonus_options bo where bo.matchday_id = md.id) = 0
    then 'VIDE — supprimable'
    else 'porte des donnees — NE PAS SUPPRIMER'
  end                                                                    as verdict
from matchdays md
order by md.number, matchs_l1 desc, matchs_bonus desc;

-- 1b) Résumé : combien de journées vides par numéro.
select
  md.number as journee,
  count(*) filter (
    where (select count(*) from matches m where m.matchday_id = md.id) = 0
      and (select count(*) from bonus_options bo where bo.matchday_id = md.id) = 0
  ) as vides_supprimables,
  count(*) as total_lignes
from matchdays md
group by md.number
order by md.number;


-- ============================================================
-- PARTIE 2 — RÉPARATION
-- ============================================================
-- À lancer SEULEMENT si la partie 1 montre bien des lignes « VIDE ».
-- Tout est dans une transaction : en cas d'anomalie, `rollback` annule tout.
-- ============================================================

begin;

-- 2a) Suppression des journées qui ne portent RIEN : ni match de Ligue 1, ni
--     match bonus, ni option. La condition est répétée ici telle quelle —
--     elle ne fait pas confiance au constat précédent, elle le revérifie au
--     moment de supprimer.
delete from matchdays md
where not exists (select 1 from matches m       where m.matchday_id  = md.id)
  and not exists (select 1 from bonus_options bo where bo.matchday_id = md.id);

-- 2b) Vérification : il ne doit plus rester qu'UNE ligne par numéro.
select
  md.number as journee,
  count(*)  as lignes_restantes
from matchdays md
group by md.number
having count(*) > 1
order by md.number;

-- Si la requête ci-dessus ne renvoie AUCUNE ligne, tout est propre :
--     commit;
-- Sinon, ou au moindre doute :
--     rollback;

-- ⚠️ Tant que tu n'as pas tapé `commit;` ou `rollback;`, la transaction
-- reste ouverte. N'oublie pas de conclure.


-- ============================================================
-- CE QU'IL NE FAUT SURTOUT PAS FAIRE
-- ============================================================
-- NE PAS supprimer les 189 lignes de bonus_options, même celles marquées
-- is_active = false.
--
-- Le calcul des points s'en sert pour reconnaître qu'un match EST un match
-- bonus. Une ligne désactivée continue de servir : le pronostic d'un joueur
-- reste rattaché au match qu'il a réellement joué, pas à la sélection active
-- du moment. Supprimer ces lignes rendrait ces matchs invisibles au calcul —
-- ils ne sont ni dans la Ligue 1 (is_bonus = true les exclut) ni dans les
-- bonus (plus d'option) — et les pronostics correspondants ne rapporteraient
-- plus RIEN. C'est exactement la panne qu'on vient de corriger.
--
-- L'accumulation est sans danger depuis que la journée d'un bonus vient de
-- son match. Elle encombre, elle ne fausse plus rien.
--
-- Si tu veux malgré tout alléger, la SEULE suppression sans risque porte sur
-- les options dont le match n'a jamais été pronostiqué par personne :
--
--   delete from bonus_options bo
--   where bo.is_active = false
--     and not exists (
--       select 1 from predictions p where p.match_id = bo.match_id
--     );
--
-- À lancer aussi dans une transaction, après avoir compté ce qu'elle vise :
--   select count(*) from bonus_options bo
--   where bo.is_active = false
--     and not exists (select 1 from predictions p where p.match_id = bo.match_id);
