const CACHE_NAME = "gda-finance-cache-v43";
>>>>>>> 3538c377f62f3e8fc1a80f9ae4d9c74eecb89afa
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./scripts/activity-log.js",
  "./scripts/api.js",
  "./utils/helpers.js",
  "./utils/pagination.js",
  "./utils/permissions.js",
  "./ui/sidebar.js",
  "./ui/modals.js",
  "./ui/page-bootstrap.js",
  "./features/transactions.js",
  "./features/transactions-category-chart.js",
  "./features/bank-import.js",
  "./features/auth.js",
  "./features/sharedExp.js",
  "./features/value-sets.js",
  "./features/admin.js",
  "./features/reports-monthly-summary.js",
  "./features/reports-house-costs.js",
  "./features/reports-bank-matching.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
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

