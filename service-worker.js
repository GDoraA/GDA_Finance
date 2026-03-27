const CACHE_NAME = "gda-finance-cache-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./scripts/api.js",
  "./utils/helpers.js",
  "./utils/pagination.js",
  "./ui/sidebar.js",
  "./ui/modals.js",
  "./ui/page-bootstrap.js",
  "./features/transactions.js",
  "./features/bank-import.js",
  "./features/auth.js",
  "./features/sharedExp.js",
  "./features/value-sets.js",
  "./features/admin.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // SPA navigáció: mindig az index.html-t addjuk vissza cache-ből (repo alútvonalon is)
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((resp) => resp || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((resp) => resp || fetch(req))
  );
});

