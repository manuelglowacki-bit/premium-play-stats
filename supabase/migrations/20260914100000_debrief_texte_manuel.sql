-- ============================================================
-- LE DEBRIEF ECRIT A LA MAIN
-- ============================================================
-- L'organisateur veut pouvoir ecrire lui-meme l'article du Debrief et le
-- coller depuis Admin, plutot que de laisser la page le rediger. Trois
-- colonnes suffisent, sur la ligne de reglages deja existante :
--
--   debrief_texte    l'article, tel qu'il a ete colle
--   debrief_journee  la journee qu'il raconte (pour l'annonce d'accueil)
--   debrief_maj      la date du dernier enregistrement
--
-- Quand `debrief_texte` est vide ou absent, la page reprend son texte
-- calcule : rien n'est perdu, et il n'y a jamais de page blanche.
--
-- Les droits ne bougent pas : `app_settings` est deja reserve a
-- l'organisateur en ecriture (migration 20260811000000_lock_down_admin_rls)
-- et lisible par les joueurs connectes. Ces colonnes heritent de cette
-- regle, il n'y a donc aucune policy a ajouter.
--
-- A COLLER DANS SUPABASE : SQL Editor -> coller -> Run.
-- Relancer cette migration une seconde fois ne fait rien de plus
-- (`if not exists`).
-- ============================================================

alter table public.app_settings
  add column if not exists debrief_texte text,
  add column if not exists debrief_journee integer,
  add column if not exists debrief_maj timestamptz;

comment on column public.app_settings.debrief_texte is
  'Article du Debrief ecrit par l''organisateur. Vide = la page redige elle-meme.';
comment on column public.app_settings.debrief_journee is
  'Numero de journee que raconte debrief_texte, pour l''annonce sur l''Accueil.';
comment on column public.app_settings.debrief_maj is
  'Date du dernier enregistrement de debrief_texte.';
