// Service worker caching strategy:
// - Navigations (HTML): network-first, cached copy as offline fallback. HTML is
//   server-rendered and always references the current hashed asset URLs, so it
//   must stay fresh — this also acts as the kill-switch for a bad SW deploy.
// - Hashed build assets (/assets/*): cache-first. Vite content-hashes these, so
//   a given URL never changes; caching them makes repeat launches skip the
//   network for the whole JS/CSS bundle.
// - Everything else: network-first with cache fallback.

const CACHE_NAME = "hot-shots-v2";

self.addEventListener("install", () => {
  // Activate immediately, don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all open tabs so they use this service worker immediately
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests (HTML pages) — network-first, cache the response so
  // the app shell can still open offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Immutable hashed build assets — cache-first, populate on miss
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // All other requests — network-first with cache fallback
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
