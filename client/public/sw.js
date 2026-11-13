/*
 * NEXUS service worker: shows Web Push notifications and opens the dashboard on tap (a tile's notification
 * scrolls to that tile). No offline caching: the dashboard needs the server anyway, and a cached copy would
 * hide updates.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'NEXUS', body: event.data?.text() ?? '' };
  }
  // the red number on the home screen icon (iOS 16.4+, Chromium): unread bell items
  const badge = 'setAppBadge' in self.navigator && Number.isFinite(data.badge) ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {}) : null;
  event.waitUntil(
    Promise.all([badge, self.registration.showNotification(data.title || 'NEXUS', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/' },
    })]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        await win.focus();
        win.postMessage({ type: 'open', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
