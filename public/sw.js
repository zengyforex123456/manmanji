// R24: Service Worker — 离线壳 + 缓存策略
const CACHE_NAME = 'manmanji-v1';
const ASSETS = ['/','/index.html'];

// Install: 预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: 缓存策略
self.addEventListener('fetch', (event) => {
  const { pathname } = new URL(event.request.url);

  // HTML: Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CSS/JS: Cache First
  if (/\.(js|css)$/.test(pathname)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return resp;
        }))
    );
    return;
  }

  // 题库JSON: Stale-While-Revalidate
  if (/\/data\/.*questions\.json$/.test(pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 默认: Network
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
