const CACHE_NAME = "gda-finance-cache-v44";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=44",
  "./app.js?v=44",
  "./scripts/activity-log.js?v=44",
  "./scripts/api.js?v=44",
  "./utils/helpers.js?v=44",
  "./utils/pagination.js?v=44",
  "./utils/permissions.js?v=44",
  "./ui/sidebar.js?v=44",
  "./ui/modals.js?v=44",
  "./ui/page-bootstrap.js?v=44",
  "./features/transactions.js?v=44",
  "./features/transactions-category-chart.js?v=44",
  "./features/bank-import.js?v=44",
  "./features/auth.js?v=44",
  "./features/sharedExp.js?v=44",
  "./features/value-sets.js?v=44",
  "./features/admin.js?v=44",
  "./features/reports-monthly-summary.js?v=44",
  "./features/reports-house-costs.js?v=44",
  "./features/reports-bank-matching.js?v=44",
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

  // Navigáció és kódfájlok: hálózat-első stratégia, hogy hibás régi cache ne ragadhasson be.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (req.destination === "script" || req.destination === "style") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((resp) => resp || fetch(req))
  );
});

