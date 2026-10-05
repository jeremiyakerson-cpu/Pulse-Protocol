/* Pulse & Protocol service worker
   Bump CACHE_VERSION whenever any precached file changes so clients pick up
   the new copies and old caches are cleaned up. The GitHub Pages workflow
   stamps it with the commit SHA on every deploy, so a manual bump only
   matters for other hosts. */
const CACHE_VERSION = 'v4';
const CACHE_NAME = `pulse-protocol-${CACHE_VERSION}`;

// Paths are relative to the service worker, so the app works from a sub-path
// (e.g. https://user.github.io/Pulse-Protocol/) as well as a domain root.
// Every file here must exist: one 404 fails the install and disables offline.
const PRECACHE = [
  './',
  'index.html',
  'calculator.html',
  'quiz.html',
  'css/pulse.css',
  'css/home.css',
  'css/calculator.css',
  'css/quiz.css',
  'js/theme.js',
  'js/pwa.js',
  'js/dosing.js',
  'js/drugs.js',
  'js/calculator.js',
  'js/questions.js',
  'js/srs.js',
  'js/quizstore.js',
  'js/quiz.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

// Cached when present, skipped (without failing the install) when missing.
const PRECACHE_OPTIONAL = [];

// Offline-ish connections ("lie-fi") can hang for a long time. After this long,
// a page that is already cached is served from the cache instead.
const NAV_TIMEOUT_MS = 4000;

// cache: 'reload' bypasses the HTTP cache so a new version never precaches
// stale files.
const fresh = url => new Request(url, { cache: 'reload' });

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cache.addAll(PRECACHE.map(fresh)),
        ...PRECACHE_OPTIONAL.map(url => cache.add(fresh(url)).catch(() => {}))
      ]))
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

function saveCopy(event, request, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let external links (Etsy, Pinterest) pass through

  if (request.mode === 'navigate') {
    // Pages: network-first so content updates show up immediately when
    // online; fall back to the cached copy (or the home page) offline or when
    // the network is too slow to answer.
    const cached = () => caches.match(request, { ignoreSearch: true });
    const network = fetch(request).then(response => saveCopy(event, request, response));
    // Keep the worker alive to cache the fresh copy even if the cache won the race.
    event.waitUntil(network.catch(() => {}));
    event.respondWith(new Promise(resolve => {
      let settled = false;
      const settle = response => { if (response && !settled) { settled = true; resolve(response); } };
      const timer = setTimeout(() => cached().then(settle), NAV_TIMEOUT_MS);
      network
        .then(response => { clearTimeout(timer); settle(response); })
        .catch(() => {
          clearTimeout(timer);
          cached()
            .then(hit => hit || caches.match('index.html'))
            .then(hit => settle(hit || Response.error()));
        });
    }));
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request)
        .then(response => saveCopy(event, request, response))
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    })
  );
});
