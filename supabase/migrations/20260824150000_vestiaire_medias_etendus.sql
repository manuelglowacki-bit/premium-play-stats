-- ============================================================
-- Vestiaire — élargissement des médias acceptés
-- ============================================================
-- Le bucket "chat-images" n'acceptait que JPEG/PNG/WebP/GIF et plafonnait à
-- 25 Mo. Deux conséquences concrètes :
--   * une photo prise avec un iPhone récent (HEIC/HEIF, format par défaut)
--     était refusée par le Storage, alors que le fichier est parfaitement
--     valide ;
--   * un GIF animé un peu long dépassait la limite client de 8 Mo.
-- Cette migration aligne le bucket sur la nouvelle liste côté client
-- (ALLOWED_IMAGE_TYPES / ALLOWED_VIDEO_TYPES dans src/routes/trophees.tsx).
--
-- Les politiques RLS posées par 20260819090000_chat_images_bucket.sql restent
-- valables telles quelles : rien à redéfinir ici, seul le filtre de types et
-- le plafond de taille changent.
--
-- Note : "application/octet-stream" est accepté volontairement. Certains
-- navigateurs mobiles n'annoncent aucun type MIME pour un fichier choisi
-- depuis un gestionnaire de fichiers ; le client déduit alors le type de
-- l'extension, mais l'en-tête envoyé peut rester générique. Sans cette
-- entrée, ces envois échoueraient côté serveur.
update storage.buckets
set
  file_size_limit = 26214400, -- 25 Mo — plafond serveur ; le client applique
                              -- 15 Mo par photo/GIF et 25 Mo par vidéo
  allowed_mime_types = array[
    -- Photos
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff',
    -- Vidéos
    'video/mp4', 'video/webm', 'video/quicktime',
    -- Type générique renvoyé par certains navigateurs mobiles
    'application/octet-stream'
  ]
where id = 'chat-images';
