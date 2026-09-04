const CACHE_NAME = 'trueque-v7'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((a) => cache.add(a)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // NUNCA cachear respuestas de API - siempre ir a la red
  // (manejar /api/ y /main/api/ y /demo/api/)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 504 })))
    return
  }

  // No cachear assets con hash (index-XXXX.js, index-XXXX.css)
  // Manejar /assets/ y /main/assets/ y /demo/assets/
  if (url.pathname.startsWith('/assets/') || url.pathname.includes('/assets/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request)).then(r => r || new Response('', { status: 504 })))
    return
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        }
        return response
      }).catch(() => cached)
      return cached || fetchPromise
    })
  )
})

// ===== Web Push Notifications =====

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Notificacion', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Red Federada'
  const options = {
    body: data.message || data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      link: data.link || '/app/notifications',
    },
    tag: data.tag || 'notif-' + Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data && event.notification.data.link
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'navigate', link: link })
          return client.focus()
        }
      }
      // Si no, abrir nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(link)
      }
    })
  )
})
