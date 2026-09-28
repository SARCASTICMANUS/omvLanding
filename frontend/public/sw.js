// VAYY | frontend/public/sw.js
//
// This file is served verbatim from /public/ and is NOT processed by Vite, so it
// cannot use import.meta.env.BASE_URL. Instead we derive every URL from
// self.registration.scope, which equals the Vite `base` the worker was registered
// under: "/" in local dev, "/omv/" in the production build.
const scope = self.registration.scope;
const asset = (name) => new URL(name, scope).href;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notifications (if using WebPush in future)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'VAYY Notification';
  const options = {
    body: data.message || 'New update from VAYY',
    icon: asset('vite.svg'),
    badge: asset('vite.svg'),
    ...data.options
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle messages from the main thread (for local background alerts)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data.payload;
    self.registration.showNotification(title, {
      icon: asset('vite.svg'),
      badge: asset('vite.svg'),
      ...options
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      // Open the SPA root, not the domain root (keeps /omv/ in production).
      return self.clients.openWindow(scope);
    })
  );
});
