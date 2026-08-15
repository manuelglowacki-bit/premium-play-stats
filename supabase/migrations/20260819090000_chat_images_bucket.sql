-- ============================================================
-- Vestiaire — bucket Storage pour les photos/vidéos partagées
-- ============================================================
-- Vérification faite avant cette migration (requête directe sur
-- storage.buckets / pg_policies) : le bucket "chat-images", pourtant déjà
-- utilisé par le code (src/routes/trophees.tsx, uploadChatImages) via
-- `supabase.storage.from("chat-images").upload(...)`, N'EXISTAIT PAS EN
-- PRODUCTION. Tout envoi de photo échouait donc réellement. Cette
-- migration crée le bucket manquant + ses politiques RLS.
--
-- Chemin de stockage déjà utilisé par le code : `${user_id}/${timestamp}-
-- ${uuid}.${ext}` — les politiques ci-dessous vérifient que le premier
-- segment du chemin correspond bien à auth.uid(), pour qu'un joueur ne
-- puisse jamais écrire/modifier/supprimer dans le dossier d'un autre.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true, -- public : les messages affichent les images/vidéos via getPublicUrl(), sans session
  26214400, -- 25 Mo — plafond serveur ; la limite réelle par type (8 Mo image / 25 Mo vidéo)
            -- est déjà appliquée côté client avant l'upload (voir addFiles dans trophees.tsx)
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique (le bucket public suffit déjà pour les URLs directes,
-- cette politique couvre en plus tout accès via le SDK authentifié).
drop policy if exists "chat_images_select" on storage.objects;
create policy "chat_images_select"
  on storage.objects for select
  using (bucket_id = 'chat-images');

-- Écriture réservée à son propre dossier (premier segment du chemin =
-- auth.uid()) — jamais dans le dossier d'un autre joueur.
drop policy if exists "chat_images_insert_own_folder" on storage.objects;
create policy "chat_images_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_images_update_own_folder" on storage.objects;
create policy "chat_images_update_own_folder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat_images_delete_own_folder" on storage.objects;
create policy "chat_images_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);
