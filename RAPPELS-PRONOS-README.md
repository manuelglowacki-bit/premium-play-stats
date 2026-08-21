# RAPPELS PRONOSTICS

Fichiers crÃ©Ã©s :

- supabase/prono-notifications.sql
- supabase/functions/send-prono-reminders/index.ts
- src/PronoReminderNotifications.tsx

IMPORTANT :
La fonction Edge prÃ©pare le ciblage et l'anti-double notification.
La fonction sendWebPush est volontairement isolÃ©e car ton ancien systÃ¨me
Vestiaire possÃ¨de dÃ©jÃ  une infrastructure Web Push/VAPID.

Avant le dÃ©ploiement, il faut brancher sendWebPush sur ton systÃ¨me VAPID
existant afin que les notifications arrivent rÃ©ellement sur les tÃ©lÃ©phones.

Le composant React doit Ãªtre placÃ© dans la page Profil pour permettre
au joueur d'activer les rappels.

AprÃ¨s cela, il faudra programmer l'Edge Function toutes les minutes
ou utiliser un cron Supabase pour dÃ©clencher la vÃ©rification.
