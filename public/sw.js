// Offline support, without ever serving a stale app.
//
// The page itself is NETWORK FIRST: a deploy has to take effect the next time
// the app is opened, not one visit later. The previous version was
// stale-while-revalidate for everything, which meant opening the link served
// the last build from cache — so fixes appeared to have never shipped.
//
// Hashed build assets are cache first, because their filenames change whenever
// their contents do, so a cached one can never be out of date.

const CACHE = 'todo-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isImmutable = (url) => url.pathname.includes('/assets/')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Content-hashed asset: safe to serve from cache forever.
  if (isImmutable(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // The document and everything else: always try the network first, and only
  // fall back to the cache when genuinely offline.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const res = await fetch(req)
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      } catch {
        const hit = await cache.match(req)
        if (hit) return hit
        // A navigation with nothing cached still needs something to render.
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html')
          if (shell) return shell
        }
        throw new Error('offline and nothing cached')
      }
    })(),
  )
})
