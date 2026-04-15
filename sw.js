/**
 * VenueIQ Service Worker
 * Provides offline support, asset caching, and background sync.
 * Strategy: Cache-first for assets, Network-first for API data.
 */

'use strict';

const CACHE_NAME     = 'venueiq-v2.4.1';
const STATIC_CACHE   = 'venueiq-static-v2.4.1';
const DYNAMIC_CACHE  = 'venueiq-dynamic-v2.4.1';

/** Assets to pre-cache on install */
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/design-tokens.css',
  './css/main.css',
  './css/components.css',
  './css/animations.css',
  './css/accessibility.css',
  './js/utils.js',
  './js/security.js',
  './js/data-store.js',
  './js/charts.js',
  './js/crowd-flow.js',
  './js/queue-manager.js',
  './js/maps.js',
  './js/emergency.js',
  './js/analytics.js',
  './js/notifications.js',
  './js/accessibility.js',
  './js/app.js',
  './manifest.json',
];

/** Maximum entries in dynamic cache */
const DYNAMIC_CACHE_MAX = 50;

/* ------------------------------------------------------------------ */
/*  Install                                                             */
/* ------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  console.info('[SW] Installing VenueIQ Service Worker v2.4.1');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed for some assets:', err))
  );
});

/* ------------------------------------------------------------------ */
/*  Activate                                                            */
/* ------------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  console.info('[SW] Activating — clearing old caches');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.info('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------------------------------ */
/*  Fetch Strategy                                                      */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Skip Google Analytics — don't cache
  if (url.hostname.includes('google-analytics.com') ||
      url.hostname.includes('googletagmanager.com')) return;

  // Google Maps API — network only (live data)
  if (url.hostname.includes('maps.googleapis.com') ||
      url.hostname.includes('maps.gstatic.com')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Google Fonts — cache first (fonts don't change)
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Static assets — cache first
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|webp|woff2?)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages — network first with cache fallback
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/* ------------------------------------------------------------------ */
/*  Cache Strategy Implementations                                      */
/* ------------------------------------------------------------------ */

/** Cache-first: Serve cached, fallback to network. */
const cacheFirst = async (request, cacheName = STATIC_CACHE) => {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await updateCache(cacheName, request, response.clone());
    return response;
  } catch {
    return caches.match('./index.html') || new Response('Offline', { status: 503 });
  }
};

/** Network-first: Try network, fallback to cache. */
const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) await updateCache(DYNAMIC_CACHE, request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html') || offlineResponse();
  }
};

/** Stale-while-revalidate: Serve cache immediately, update in background. */
const staleWhileRevalidate = async (request) => {
  const cache  = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || offlineResponse();
};

/** Network only — no cache. */
const networkOnly = async (request) => {
  try { return await fetch(request); }
  catch { return new Response('', { status: 503 }); }
};

/** Add to cache and trim old entries. */
const updateCache = async (cacheName, request, response) => {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length > DYNAMIC_CACHE_MAX) {
    await cache.delete(keys[0]);
  }
};

const offlineResponse = () =>
  new Response(
    '<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0e1a;color:#fff;"><h1>VenueIQ</h1><p>You appear to be offline. Please check your connection.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html' } }
  );

/* ------------------------------------------------------------------ */
/*  Push Notification Handler                                           */
/* ------------------------------------------------------------------ */
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const options = {
    body: data.body || 'New alert from VenueIQ',
    icon: './assets/icon-192.png',
    badge: './assets/badge-72.png',
    tag: 'venueiq-push',
    requireInteraction: data.requireInteraction || false,
    data: { url: data.url || './' },
    actions: [
      { action: 'view',   title: 'View Details' },
      { action: 'dismiss',title: 'Dismiss' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'VenueIQ Alert', options)
  );
});

/* ------------------------------------------------------------------ */
/*  Notification Click Handler                                          */
/* ------------------------------------------------------------------ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

/* ------------------------------------------------------------------ */
/*  Background Sync                                                     */
/* ------------------------------------------------------------------ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'venueiq-sync-reports') {
    event.waitUntil(syncOfflineReports());
  }
});

const syncOfflineReports = async () => {
  console.info('[SW] Background sync: uploading offline reports...');
  // In production: retrieve from IndexedDB and POST to server
};

/* ------------------------------------------------------------------ */
/*  Message Handler (from main thread)                                  */
/* ------------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(DYNAMIC_CACHE).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
