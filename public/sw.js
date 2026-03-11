// Minimal service worker — ensures the PWA always loads fresh content.
// Serves all navigation requests from the network (no caching of HTML).
// Static assets (JS/CSS) are fingerprinted by Vite, so browser caching is fine.

const CACHE_NAME = "hot-shots-v1";

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

  // Navigation requests (HTML pages) — always go to network
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        // If offline, try the cache as a fallback
        return caches.match(request);
      }),
    );
    return;
  }

  // All other requests — use network-first strategy
  // Vite-built assets have content hashes so stale cache entries are harmless
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
