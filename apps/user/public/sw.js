/* Service Worker for Web Push Notifications */

// iOS Safari requires explicit install/activate handlers
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Knock", body: event.data.text() };
  }

  const title = data.title ?? "Knock";
  const options = {
    body: data.body ?? "",
    icon: data.icon ?? "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: { url: data.url ?? "/" },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // ホーム画面アイコンのバッジカウントを更新
      if (navigator.setAppBadge) {
        return self.registration
          .getNotifications()
          .then((notifications) => navigator.setAppBadge(notifications.length));
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    Promise.all([
      // バッジをクリア
      navigator.clearAppBadge && navigator.clearAppBadge(),
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(url) && "focus" in client) {
              return client.focus();
            }
          }
          return clients.openWindow(url);
        }),
    ])
  );
});

// アプリがフォーカスされたらバッジをクリア
self.addEventListener("message", (event) => {
  if (event.data === "clear-badge" && navigator.clearAppBadge) {
    navigator.clearAppBadge();
  }
});
