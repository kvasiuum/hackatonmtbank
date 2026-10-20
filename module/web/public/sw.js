// Кэш оболочки приложения: после первого открытия модуль запускается и без сети.
const CACHE = 'moby-family-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Сначала сеть, при её отсутствии — кэш
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then(r => r ?? caches.match('./'))));
});
