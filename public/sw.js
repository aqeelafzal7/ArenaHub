const CACHE_NAME = 'arenahub-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// A simple fetch listener is required to pass the PWA install criteria
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response("Offline")));
});
