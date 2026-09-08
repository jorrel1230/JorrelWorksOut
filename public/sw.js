const CACHE_NAME = 'jorrel-works-out-v1'
const APP_SHELL = [
  '/JorrelWorksOut/',
  '/JorrelWorksOut/index.html',
  '/JorrelWorksOut/manifest.json',
  '/JorrelWorksOut/icon.svg',
  '/JorrelWorksOut/icon-192.png',
  '/JorrelWorksOut/icon-512.png',
  '/JorrelWorksOut/apple-touch-icon.png',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key === CACHE_NAME ? null : caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))
        return response
      }).catch(() => cached)

      return cached || network
    })
  )
})
