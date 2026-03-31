// Service Worker for TraderClaw Terminal
// Handles notifications, caching, and offline support

const CACHE_NAME = 'traderclaw-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Silently fail if assets don't exist yet
        return Promise.resolve()
      })
    })
  )
  self.skipWaiting()
})

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip API routes - always fetch from network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    return
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }
      return fetch(request)
        .then((response) => {
          // Cache successful responses (except for sensitive content)
          if (!response || response.status !== 200 || response.type === 'error') {
            return response
          }
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
          return response
        })
        .catch(() => {
          // Offline fallback
          return new Response('Offline', { status: 503 })
        })
    })
  )
})

// Handle notification clicks
self.addEventListener('push', (event) => {
  // Handle server-sent push notifications
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || 'Alert triggered',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200],
    tag: 'traderclaw-alert',
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TraderClaw Alert', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if already open
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window if not open
      if (clients.openWindow) {
        return clients.openWindow('/monitor/alerts')
      }
    })
  )
})

// Handle notification dismissal
self.addEventListener('notificationclose', (event) => {
  // Optional: track dismissed notifications
})
