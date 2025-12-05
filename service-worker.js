self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("gda-finance-cache").then(cache => {
      return cache.addAll([
        "index.html",
        "styles.css",
        "app.js",
        "scripts/api.js",
        "utils/helpers.js"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
    })
  );
});
