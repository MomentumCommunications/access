const NOTIFICATION_TAG_PREFIX = "access-notification-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }

  const notificationId = String(payload.notificationId || "");
  const href =
    typeof payload.href === "string" &&
    payload.href.startsWith("/") &&
    !payload.href.startsWith("//")
      ? payload.href
      : "/home";
  const clickUrl = notificationId
    ? `/notifications/${encodeURIComponent(notificationId)}`
    : href;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(
        typeof payload.title === "string"
          ? payload.title
          : "Access Momentum",
        {
          body:
            typeof payload.body === "string"
              ? payload.body
              : "You have a new Access update.",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/notification-badge.svg",
          tag: `${NOTIFICATION_TAG_PREFIX}${notificationId}`,
          data: { notificationId, clickUrl },
        },
      ),
      setBadge(Number(payload.unreadCount) || 0),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.clickUrl || "/home";
  const destination = new URL(clickUrl, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          await existing.navigate(destination);
          return await existing.focus();
        }
        return await self.clients.openWindow(destination);
      }),
  );
});

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "SET_BADGE") {
    event.waitUntil(setBadge(Number(message.unreadCount) || 0));
  }
  if (message.type === "CLOSE_NOTIFICATION") {
    event.waitUntil(closeNotification(String(message.notificationId || "")));
  }
  if (message.type === "CLOSE_ALL_NOTIFICATIONS") {
    event.waitUntil(closeAllNotifications());
  }
});

async function setBadge(unreadCount) {
  if (unreadCount > 0 && self.navigator.setAppBadge) {
    await self.navigator.setAppBadge(unreadCount);
  } else if (self.navigator.clearAppBadge) {
    await self.navigator.clearAppBadge();
  }
}

async function closeNotification(notificationId) {
  const notifications = await self.registration.getNotifications({
    tag: `${NOTIFICATION_TAG_PREFIX}${notificationId}`,
  });
  notifications.forEach((notification) => notification.close());
}

async function closeAllNotifications() {
  const notifications = await self.registration.getNotifications();
  notifications.forEach((notification) => notification.close());
}
