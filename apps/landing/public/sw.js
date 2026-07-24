// Self-destructing service worker.
//
// The apex origin (hot-shots.dev) used to run a caching service worker for
// the AFL app, which has moved to afl.hot-shots.dev. Installed PWAs may
// still have that old service worker registered here. The browser's
// periodic update check fetches this file; because it is byte-different
// from the old sw.js, the browser installs it, which then wipes every
// cache at this origin and unregisters itself, leaving the apex SW-free.
//
// This file must keep being served indefinitely - do not remove it once
// the apex is SW-free, since that would just mean the update check has
// nothing to compare against (harmless, but the intent is documented here).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) {
        // Reload controlled pages so they leave SW control and hit the
        // network directly (and therefore the redirects) on next load.
        client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});

// Deliberately no fetch handler - this SW only exists to evict itself.
