/**
 * lib/push.ts
 *
 * Web Push (VAPID) subscription helpers.
 * Used by PushOptIn component to request permission and register the subscription.
 *
 * VAPID keys are generated once per project:
 *   npx web-push generate-vapid-keys
 * Store the public key in NEXT_PUBLIC_VAPID_PUBLIC_KEY and
 * the private key in VAPID_PRIVATE_KEY (server-side only).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Convert the VAPID base64 public key to Uint8Array as required by PushManager */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/** Returns true if the browser supports Web Push */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Requests notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Creates (or retrieves existing) push subscription via the service worker.
 * Returns null if unsupported or permission denied.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    });
  } catch {
    return null;
  }
}

/**
 * Registers a push subscription with our backend.
 * Returns true on success.
 */
export async function registerPushSubscription(
  subscription: PushSubscription,
  uid?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/push-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), uid }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Full opt-in flow: request permission → subscribe → register.
 * Returns true if the user is now subscribed.
 */
export async function optInToPush(uid?: string): Promise<boolean> {
  const permission = await requestPushPermission();
  if (permission !== "granted") return false;

  const sub = await subscribeToPush();
  if (!sub) return false;

  return registerPushSubscription(sub, uid);
}
