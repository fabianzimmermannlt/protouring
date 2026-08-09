/* ProTouring Service Worker – installierbare PWA + Offline-Robustheit.
   Bewusst konservativ:
   - statische Assets (gehashte _next/static, Bilder, Fonts) → cache-first
   - Seiten (HTML) → network-first, bei Netzausfall Offline-Fallback
   - /api/* wird NIE gecacht (keine veralteten oder fremden Daten)
   Dadurch bleiben Updates sofort live (jeder Deploy zieht neue gehashte Assets). */
const CACHE = 'pt-shell-v57'
const PRECACHE = ['/offline.html', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin) return       // nur eigene Domain
  if (url.pathname.startsWith('/api/')) return           // API nie cachen

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|svg|jpg|jpeg|webp|gif|ico|woff2?|ttf|css|js)$/.test(url.pathname)

  if (isStatic) {
    // cache-first (gehashte Dateinamen → immer korrekt)
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }).catch(() => hit)
      )
    )
    return
  }

  if (req.mode === 'navigate') {
    // Seiten: immer frisch aus dem Netz; offline → Fallback-Seite
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }
})

// ── Push-Benachrichtigungen ──────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'ProTouring', body: event.data ? event.data.text() : '' } }
  const title = data.title || 'ProTouring'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let url = (event.notification.data && event.notification.data.url) || '/'
  // Marker, damit die App diesen Deeplink direkt als Termin-Detail öffnet
  // (im installierten Modus wird sonst bewusst die Liste gezeigt).
  url += (url.indexOf('?') === -1 ? '?' : '&') + 'from=push'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(url); return client.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
