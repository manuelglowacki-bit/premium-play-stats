-- ============================================================
-- VESTIAIRE — FORMATS D'IMAGES ACCEPTÉS
-- ============================================================
-- Le bucket n'acceptait que jpeg, png, webp et gif. Or les photos prises
-- avec un iPhone sont en HEIC par défaut : le fichier était refusé par le
-- serveur, sans que le joueur comprenne pourquoi.
--
-- On ajoute donc HEIC/HEIF, AVIF et BMP. Le contrôle côté site (voir
-- ALLOWED_IMAGE_TYPES dans src/routes/trophees.tsx) accepte exactement la
-- même liste : les deux niveaux doivent rester d'accord, sinon un fichier
-- passe le premier contrôle pour être rejeté par le second.
--
-- SVG reste volontairement exclu : un SVG peut contenir du code exécuté par
-- le navigateur de celui qui l'ouvre. Dans un salon où 23 personnes
-- s'envoient des images, ce n'est pas un risque à prendre.
-- ============================================================

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime'
]
where id = 'chat-images';

-- Vérification : la liste doit contenir image/heic.
select id, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'chat-images';
