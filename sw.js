const CACHE_NAME = 'rotation-v3.40';
const ASSETS = [
  './index.html',
  './css/styles.css',
  './js/platform.js',
  './js/formations.js',
  './js/credit.js',
  './js/storage_adapter.js',
  './js/storage.js',
  './js/engine.js',
  './js/utils.js',
  './js/fairness.js',
  './js/clock.js',
  './js/game_notes.js',
  './js/backup.js',
  './js/season_view.js',
  './js/modals.js',
  './js/field.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/dm-sans-latin.woff2',
  './fonts/jetbrains-mono-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  // Don't skipWaiting automatically — let the app prompt the user first
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
