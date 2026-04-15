/**
 * VenueIQ — Service Worker
 * Cache-first offline strategy with navigation preload, background sync,
 * stale-while-revalidate for remote resources, and push notifications.
 * @version 2.4.1
 */

'use strict';

const CACHE_NAME     = 'venueiq-v2-4-1';
const OFFLINE_URL    = './index.html';
const FONT_CACHE     = 'venueiq-fonts-v1';
const IMAGES_CACHE   = 'venueiq-images-v1';

/* ------------------------------------------------------------------ */
/*  Assets to pre-cache on install                                      */
/* ------------------------------------------------------------------ */
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './robots.txt',
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
  './assets/icon-72.png',
  './assets/icon-96.png',
  './assets/icon-128.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

/* ------------------------------------------------------------------ */
/*  Install — pre-cache core assets                                     */
/* ------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  console.log('[SW] Install — caching core assets');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed (some assets may be missing):', err))
  );
});

/* ------------------------------------------------------------------ */
/*  Activate — clean old caches, enable navigation preload              */
/* ------------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — cleaning old caches');
  event.waitUntil(
    Promise.all([
      // Delete old versioned caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== FONT_CACHE && k !== IMAGES_CACHE)
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      ),
      // Enable navigation preload for faster navigations
      self.registration.navigationPreload?.enable()
        .then(() => console.log('[SW] Navigation preload enabled.'))
        .catch(() => {}),
      // Claim all open clients immediately
      self.clients.claim(),
    ])
  );
});

/* ------------------------------------------------------------------ */
/*  Fetch — stratified caching                                          */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and analytics pings
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname === 'www.google-analytics.com') return;

  // Google Fonts — stale-while-revalidate with dedicated font cache
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE, 60 * 60 * 24 * 365));
    return;
  }

  // Maps API tiles — network first with image cache fallback
  if (url.hostname.includes('maps.googleapis.com') || url.hostname.includes('maps.gstatic.com')) {
    event.respondWith(networkFirstWithCache(request, IMAGES_CACHE));
    return;
  }

  // Navigation requests — use preload or cache-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Everything else — cache-first (core app shell)
  event.respondWith(cacheFirstWithNetwork(request, CACHE_NAME));
});

/* ------------------------------------------------------------------ */
/*  Strategy: Navigation with optional preload                          */
/* ------------------------------------------------------------------ */
async function handleNavigation(event) {
  try {
    // Try navigation preload response first (fastest)
    const preloadResp = await event.preloadResponse;
    if (preloadResp) return preloadResp;

    // Try network
    const networkResp = await fetch(event.request);
    if (networkResp.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResp.clone());
      return networkResp;
    }
  } catch (_) {
    // Offline — serve cached index.html
  }

  const cached = await caches.match(OFFLINE_URL);
  return cached || new Response('VenueIQ is offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/* ------------------------------------------------------------------ */
/*  Strategy: Cache-first, fall back to network                         */
/* ------------------------------------------------------------------ */
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResp = await fetch(request);
    if (networkResp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResp.clone());
    }
    return networkResp;
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

/* ------------------------------------------------------------------ */
/*  Strategy: Stale-while-revalidate                                    */
/* ------------------------------------------------------------------ */
async function staleWhileRevalidate(request, cacheName, maxAgeSeconds = 86400) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off network request in background
  const networkPromise = fetch(request)
    .then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        cache.put(request, clone);
      }
      return resp;
    })
    .catch(() => null);

  // Return cached immediately if fresh enough, else wait for network
  if (cached) {
    const dateHeader = cached.headers.get('date');
    const age = dateHeader ? (Date.now() - new Date(dateHeader).getTime()) / 1000 : 0;
    if (age < maxAgeSeconds) return cached;
  }

  return (await networkPromise) || cached || new Response('', { status: 503 });
}

/* ------------------------------------------------------------------ */
/*  Strategy: Network-first with cache fallback                         */
/* ------------------------------------------------------------------ */
async function networkFirstWithCache(request, cacheName) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(request, { cacheName });
    return cached || new Response('', { status: 503 });
  }
}

/* ------------------------------------------------------------------ */
/*  Push Notifications                                                   */
/* ------------------------------------------------------------------ */
self.addEventListener('push', (event) => {
  let payload = { title: 'VenueIQ Alert', body: 'New update from your venue.', icon: './assets/icon-192.png', badge: './assets/badge-72.png' };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch { /* JSON parse failed — use defaults */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    payload.icon    || './assets/icon-192.png',
      badge:   payload.badge   || './assets/badge-72.png',
      tag:     payload.tag     || 'venueiq-alert',
      vibrate: [200, 100, 200],
      requireInteraction: payload.requireInteraction || false,
      data:    { url: payload.url || './', timestamp: Date.now() },
      actions: [
        { action: 'view',    title: '📊 View Dashboard' },
        { action: 'dismiss', title: '✕ Dismiss' },
      ],
    })
  );
});

/* ------------------------------------------------------------------ */
/*  Notification Click                                                   */
/* ------------------------------------------------------------------ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Focus existing open window if available
        for (const client of clients) {
          if (client.url.includes('venueiq') && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
            return;
          }
        }
        // Open new window
        return self.clients.openWindow(targetUrl);
      })
  );
});

/* ------------------------------------------------------------------ */
/*  Background Sync — queue offline actions                             */
/* ------------------------------------------------------------------ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'venueiq-background-sync') {
    event.waitUntil(processPendingSync());
  }
});

async function processPendingSync() {
  console.log('[SW] Background sync triggered — processing pending actions.');
  // In production: flush IndexedDB queue to server
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

/* ------------------------------------------------------------------ */
/*  Periodic Background Sync — refresh live data periodically           */
/* ------------------------------------------------------------------ */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'venueiq-data-refresh') {
    event.waitUntil(refreshVenueData());
  }
});

async function refreshVenueData() {
  console.log('[SW] Periodic sync — refreshing cached data.');
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'DATA_REFRESH_AVAILABLE' }));
}

/* ------------------------------------------------------------------ */
/*  Message Handler — communication with main thread                    */
/* ------------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports?.[0]?.postMessage({ version: CACHE_NAME });
      break;

    case 'CLEAR_CACHE':
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => event.ports?.[0]?.postMessage({ cleared: true }));
      break;

    default:
      break;
  }
});

console.log(`[SW] VenueIQ Service Worker ${CACHE_NAME} loaded.`);
