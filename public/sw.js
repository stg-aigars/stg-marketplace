// Bumped from stg-v1: before the middleware matcher fix, /offline.html 404'd
// and the install step failed, so no visitor had a working stg-v1 cache. The
// bump still clears any partial stg-v1 left behind (activate handler below).
const CACHE_NAME = 'stg-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Prefix-scoped cleanup: avoids nuking third-party caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('stg-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) return;

  // Cache-first — safe because Next.js static assets have content-hashed filenames
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Only cache successful responses. Cache-first means anything
            // stored here is served forever — a cached 5xx/404 for a valid
            // chunk would keep the site broken for that visitor until they
            // cleared site data.
            if (response.ok) {
              const clone = response.clone();
              event.waitUntil(
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
              );
            }
            return response;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
});
