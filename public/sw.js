/* Build fills these placeholders with the current app shell, including hashed JS. */
const CACHE_NAME = 'jwo-shell-__BUILD_ID__'
const APP_SHELL = [] // Injected by Vite at build time.
const BASE = '/JorrelWorksOut/'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name !== CACHE_NAME && (name.startsWith('jwo-shell-') || name === 'jorrel-works-out-v1')).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (!response.ok) throw new Error('Navigation unavailable')
      const cache = await caches.open(CACHE_NAME)
      await cache.put(`${BASE}index.html`, response.clone())
      return response
    }).catch(() => caches.match(`${BASE}index.html`)))
  } else if (APP_SHELL.includes(url.pathname)) {
    // These are same-origin immutable build assets. Preview servers may vary on Origin,
    // while precache requests and module requests send different Origin headers.
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request)))
  }
})
