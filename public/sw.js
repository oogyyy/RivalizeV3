// Rivalize Service Worker — cache-first for static assets, network-first for pages
const CACHE = 'rivalize-v1'
const STATIC_EXT = ['.js', '.css', '.woff', '.woff2', '.ttf', '.svg', '.png', '.ico', '.webp']

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // Skip API routes — always network
  if (url.pathname.startsWith('/api/')) return

  // Skip auth routes
  if (url.pathname.startsWith('/auth/')) return

  // Cache-first for immutable Next.js static assets
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Cache-first for static public assets (images, icons, fonts)
  const ext = url.pathname.split('.').pop() || ''
  if (STATIC_EXT.includes('.' + ext)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Network-first for page navigations
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached || new Response('Offline — open Rivalize when connected', {
          headers: { 'Content-Type': 'text/html' }
        }))
      )
    )
  }
})
