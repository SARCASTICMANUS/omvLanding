// VAYY | frontend/public/sw.js
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
    icon: '/vite.svg',
    badge: '/vite.svg',
    ...data.options
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle messages from the main thread (for local background alerts)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data.payload;
    self.registration.showNotification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
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
      return self.clients.openWindow('/');
    })
  );
});
