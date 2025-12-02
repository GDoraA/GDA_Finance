/* --------------------------------------------------------------------------
   GDA Finance – Service Worker (PWA)
   --------------------------------------------------------------------------
   Feladata:
   - az app offline működésének biztosítása
   - alap fájlok cache-elése
   - gyors betöltés visszatérő látogatóknál
   - frissítési folyamat kezelése

   Cache stratégia:
   - Network first → ha nincs internet, cache fallback
   -------------------------------------------------------------------------- */

const CACHE_NAME = "gda-finance-cache-v1";

// A cache-elendő fájlok listája
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/utils/helpers.js",
  "/scripts/api.js",
  "/manifest.json"
];

/* --------------------------------------------------------------------------
   INSTALL – amikor a service worker először települ
-------------------------------------------------------------------------- */
self.addEventListener("install", event => {
  console.log("[ServiceWorker] Telepítés…");

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[ServiceWorker] Fájlok cache-elése…");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );

  self.skipWaiting();
});

/* --------------------------------------------------------------------------
   ACTIVATE – régi cache-ek törlése
-------------------------------------------------------------------------- */
self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Aktiválás…");

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[ServiceWorker] Régi cache törlése:", key);
            return caches.delete(key);
          })
      );
    })
  );

  self.clients.claim();
});

/* --------------------------------------------------------------------------
   FETCH – Network first, cache fallback
-------------------------------------------------------------------------- */
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, cloned);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || Promise.reject("Nincs internet és nincs cache.");
        });
      })
  );
});
