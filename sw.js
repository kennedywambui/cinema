// Cinema Nest — minimal service worker
// Just enough for PWA installability (Bubblewrap/PWABuilder require a
// registered service worker). Caches the app shell so the nav still
// loads if the network briefly drops; everything else goes to network.

const CACHE_NAME = 'cinemanest-shell-v1';
const SHELL_FILES = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first, falling back to cache only for the app shell files.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((res) => res || caches.match('/index.html'))
    )
  );
});
