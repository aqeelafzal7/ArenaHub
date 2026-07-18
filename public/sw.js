self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // This dummy fetch handler is required by Chrome to pass PWA criteria
});
