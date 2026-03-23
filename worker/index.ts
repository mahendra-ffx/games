/**
 * worker/index.ts
 *
 * Custom service worker additions, merged into the next-pwa / Workbox SW.
 * Handles Web Push notifications and notification click routing.
 *
 * Compiled by @ducanh2912/next-pwa via customWorkerSrc: "worker".
 */

declare const self: ServiceWorkerGlobalScope;

// ── Push event ────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    renotify?: boolean;
  } = {};

  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title ?? "Canberra Times Games";
  const options: NotificationOptions = {
    body: data.body ?? "Your daily game is ready to play!",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { url: data.url ?? "/" },
    tag: data.tag ?? "ct-games-daily",
    renotify: data.renotify ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url: string = (event.notification.data as { url?: string })?.url ?? "/";

  event.waitUntil(
    (self.clients as Clients)
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if open
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        // Otherwise open new tab
        return (self.clients as Clients).openWindow(url);
      })
  );
});
