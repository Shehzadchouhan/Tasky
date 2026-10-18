const CACHE_NAME = 'taskly-static-v1';
const MAX_CACHED_ASSETS = 40;
const STATIC_ASSET_PATTERN = /\.(?:css|js|mjs|svg|png|webp|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('taskly-static-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (
    request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          try {
            await caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          } catch (error) {
            console.error('Failed to cache the app shell:', error);
          }
        }
        return response;
      }).catch(async () => {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;
        throw new Error('The app shell is not available offline.');
      })
    );
    return;
  }

  if (!STATIC_ASSET_PATTERN.test(requestUrl.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedAsset = await cache.match(request);
      if (cachedAsset) return cachedAsset;

      const response = await fetch(request);
      if (response.ok) {
        const cacheUpdate = cache.put(request, response.clone()).then(async () => {
          const cachedRequests = (await cache.keys()).filter(
            (cachedRequest) => new URL(cachedRequest.url).pathname !== '/index.html'
          );
          const expiredRequests = cachedRequests.slice(0, Math.max(0, cachedRequests.length - MAX_CACHED_ASSETS));
          await Promise.all(expiredRequests.map((cachedRequest) => cache.delete(cachedRequest)));
        });
        event.waitUntil(
          cacheUpdate.catch((error) => {
            console.error('Failed to cache an app asset:', error);
          })
        );
      }
      return response;
    })
  );
});
