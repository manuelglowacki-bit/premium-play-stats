-- ============================================================
-- PLUS D'EMOJIS SUR LE DEBRIEF
-- ============================================================
-- La premiere version n'en autorisait que six. L'organisateur en veut
-- davantage : on passe a douze, choisis pour une ligue de pronostics — on
-- applaudit, on chambre, on salue un score exact.
--
-- LES SIX D'ORIGINE SONT CONSERVES (👏 🔥 😮 😂 😢 💪). En retirer un
-- effacerait de fait les reactions deja posees avec : la page cesse de
-- compter un emoji qui n'est plus dans la liste. On ajoute, on n'enleve pas.
--
-- Cette liste doit rester identique a EMOJIS_DEBRIEF
-- (src/lib/reactionsDebrief.ts). Si les deux divergent, la base refuse
-- l'enregistrement — un refus franc, plutot qu'un bouton qui ne fait rien.
--
-- A EXECUTER dans Supabase -> SQL Editor. Rejouable.
-- ============================================================

alter table public.debrief_reactions
  drop constraint if exists debrief_reactions_emoji_valide;

alter table public.debrief_reactions
  add constraint debrief_reactions_emoji_valide check (
    emoji in (
      '👏', '🔥', '💪', '🎯', '🏆', '🐐',
      '⚽', '🤯', '😮', '😂', '😢', '👀'
    )
  );

comment on constraint debrief_reactions_emoji_valide on public.debrief_reactions is
  'Les douze emojis autorises. Doit rester identique a EMOJIS_DEBRIEF (src/lib/reactionsDebrief.ts).';
