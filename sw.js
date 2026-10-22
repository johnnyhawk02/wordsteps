importScripts('precache.js');

const CACHE = 'wordsteps-' + self.CACHE_VERSION;
const NETWORK_WAIT_MS = 3000;

// Everything (app, pictures, voice) is small enough to cache in one go, so
// WordSteps works offline straight after it's installed. A new version only
// takes over once all of it has downloaded.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(self.PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Pictures and voice never change for a given file name: cache first.
async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
}

// The app's own files come fresh when online, so fixes arrive straight away;
// the cached copy is used offline or when the network is slow.
async function networkFirst(req) {
  const fromNetwork = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS, null));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
  } catch { /* offline: fall through to the cache */ }
  const hit = await caches.match(req, { ignoreSearch: true })
    || (req.mode === 'navigate' && await caches.match('index.html'));
  return hit || fromNetwork;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // The parents' website (and its video) isn't part of the app: straight from the network.
  if (url.pathname.includes('/parents/')) return;
  event.respondWith(url.pathname.includes('/media/') ? cacheFirst(req) : networkFirst(req));
});
