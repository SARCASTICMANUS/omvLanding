// VAYY | frontend/public/sw.js
//
// This file is served verbatim from /public/ and is NOT processed by Vite, so it
// cannot use import.meta.env.BASE_URL. Instead we derive every URL from
// self.registration.scope, which equals the Vite `base` the worker was registered
// under: "/" both in local dev and in the production build.
//
// SCOPE NOTE: the SPA now mounts at the origin root, so this worker is registered
// with scope "/" and technically controls the whole origin — including the admin
// SPA at /zxcv/. That is safe ONLY because this worker registers no `fetch`
// handler (push / message / notificationclick below), so it never intercepts or
// caches network traffic. If you ever add a fetch handler, scope it with an
// explicit Service-Worker-Allowed path or a URL filter so it cannot start
// serving cached responses for /zxcv/.
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
      // Open the SPA root, not the domain root (keeps a sub-path mount working).
      return self.clients.openWindow(scope);
    })
  );
});
