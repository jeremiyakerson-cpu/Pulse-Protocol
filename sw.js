/* Pulse & Protocol service worker
   Bump CACHE_VERSION whenever any precached file changes so clients pick up
   the new copies and old caches are cleaned up. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `pulse-protocol-${CACHE_VERSION}`;

// Paths are relative to the service worker, so the app works from a sub-path
// (e.g. https://user.github.io/Pulse-Protocol/) as well as a domain root.
const PRECACHE = [
  './',
  'index.html',
  'calculator.html',
  'quiz.html',
  'css/pulse.css',
  'css/home.css',
  'css/calculator.css',
  'css/quiz.css',
  'js/pwa.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' bypasses the HTTP cache so a new version never
      // precaches stale files.
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('pulse-protocol-') && k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let external links (Etsy, Pinterest) pass through

  if (request.mode === 'navigate') {
    // Pages: network-first so content updates show up immediately when
    // online; fall back to the cached copy (or the home page) offline.
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true })
            .then(hit => hit || caches.match('index.html'))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    })
  );
});
