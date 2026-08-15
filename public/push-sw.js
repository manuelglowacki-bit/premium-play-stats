// ============================================================
// PWA — cache des ASSETS STATIQUES UNIQUEMENT (Lot PWA).
//
// RÈGLE ABSOLUE : ce service worker ne doit JAMAIS devenir une source de
// vérité parallèle à Supabase. Il ne met en cache QUE les fichiers
// statiques buildés par Vite sous /assets/ (JS/CSS), dont le nom contient
// déjà un hash de contenu — un cache-first sur ces URLs ne peut donc
// jamais servir une version périmée : tout changement de contenu produit
// une URL différente (nouveau hash), l'ancienne reste simplement inutilisée.
//
// Tout le reste (pronostics, classement, profils, auth Supabase, bonus,
// Admin, Gazette, /api/*, et le document HTML lui-même) n'est JAMAIS
// intercepté : ces requêtes passent intégralement en direct au réseau,
// exactement comme si ce service worker n'existait pas pour elles.
// ============================================================
const STATIC_CACHE_NAME = "prono-static-v1";

self.addEventListener("install", (event) => {
  // Prend effet immédiatement (pas d'attente de fermeture de tous les
  // onglets) — nécessaire pour qu'une mise à jour du site ne reste jamais
  // bloquée derrière un ancien service worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Supprime les anciennes versions du cache statique (mise à jour du
      // site) — ne touche à rien d'autre (pas de cache Supabase/API ici).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("prono-static-") && key !== STATIC_CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Uniquement GET, même origine, et strictement sous /assets/ (bundle
  // JS/CSS hashé par Vite). Tout le reste (navigation HTML, /api/*,
  // Supabase, manifest, images non hashées...) n'est pas intercepté du
  // tout — comportement réseau natif inchangé.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/assets/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || "Prono Ligue 1 LM";
  const options = {
    body: data.body || "Tu as une nouvelle notification.",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/pwa-192x192.png",
    tag: data.tag || "prono-ligue1",
    data: data.data || { url: "/pronostics" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/pronostics";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});