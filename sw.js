// Caches the app's own files so it runs with no internet connection.
// Bump CACHE whenever a file changes so devices pick up the new version.
const CACHE = 'hallpass-v4';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/store.js',
  'js/rules.js',
  'js/sound.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  // 'reload' skips the browser's HTTP cache, so a new version never stores stale copies of the files.
  const requests = FILES.map(f => new Request(f, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request)));
});
