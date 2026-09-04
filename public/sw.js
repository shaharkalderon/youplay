// Minimal offline shell. The library itself lives in localStorage, so the app
// is fully usable offline once the shell is cached; only thumbnails need network.
//
// The scope is wherever this file is served from — "/" locally, "/youplay/" on
// GitHub Pages — so paths are derived rather than hardcoded.
const BASE = new URL('./', self.location).pathname
const CACHE = 'youplay-shell-v2'
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
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
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigations (including share-target hits) go network-first so a shared URL
  // always reaches the live app, with the cached shell as the offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(BASE)))
    return
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
})
