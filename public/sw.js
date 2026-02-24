const CACHE_VERSION = 'v1'
const SCHEDULE_CACHE = `schedule-cache-${CACHE_VERSION}`
const SHELL_CACHE = `shell-cache-${CACHE_VERSION}`

// Cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/schedule']))
  )
  self.skipWaiting()
})

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SCHEDULE_CACHE && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Network-first for schedule API and page, pass through everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Schedule API: network-first with cache fallback
  if (url.pathname === '/api/schedule') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(SCHEDULE_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Schedule page HTML: network-first with cache fallback
  if (url.pathname === '/schedule') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }
})
