import { makeFunctionReference } from "convex/server";

export type PushDeviceState =
  | "loading"
  | "unsupported"
  | "missing_config"
  | "service_worker_error"
  | "requires_install"
  | "denied"
  | "prompt"
  | "enabled";

type RegisterPushArgs = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export const registerPushSubscriptionRef = makeFunctionReference<
  "mutation",
  RegisterPushArgs,
  string
>("pushSubscriptions:register");

export const disablePushSubscriptionRef = makeFunctionReference<
  "mutation",
  { endpoint: string },
  boolean
>("pushSubscriptions:disable");

export const currentPushStatusRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { activeDeviceCount: number }
>("pushSubscriptions:currentStatus");

export const pushConfigurationRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { publicKey: string | null } | null
>("pushSubscriptions:configuration");

export const buildWebPushPublicKey =
  import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() || "";

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function readyRegistration() {
  const registration = await registerPushServiceWorker();
  if (!registration) return null;
  return await navigator.serviceWorker.ready;
}

function resolveWebPushPublicKey(publicKey?: string | null) {
  return publicKey?.trim() || buildWebPushPublicKey;
}

export async function getPushDeviceState(
  publicKey?: string | null,
): Promise<PushDeviceState> {
  if (typeof window === "undefined") return "loading";
  if (isIosDevice() && !isStandaloneApp()) return "requires_install";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (!resolveWebPushPublicKey(publicKey)) return "missing_config";
  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await readyRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "enabled" : "prompt";
  } catch {
    return "service_worker_error";
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function enableDevicePush(
  register: (args: RegisterPushArgs) => Promise<unknown>,
  publicKey?: string | null,
) {
  const resolvedPublicKey = resolveWebPushPublicKey(publicKey);
  const state = await getPushDeviceState(resolvedPublicKey);
  if (state === "requires_install") {
    throw new Error("Add Access to your Home Screen before enabling alerts.");
  }
  if (state === "unsupported") {
    throw new Error("This browser does not support device notifications.");
  }
  if (state === "missing_config") {
    throw new Error("Device notifications are not configured yet.");
  }
  if (state === "service_worker_error") {
    throw new Error(
      "The notification service could not start. Refresh Access and try again.",
    );
  }
  if (state === "denied") {
    throw new Error("Notifications are blocked in your device settings.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await readyRegistration();
  if (!registration) throw new Error("Could not start device notifications.");
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(resolvedPublicKey),
    }));
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    await subscription.unsubscribe();
    throw new Error("The browser returned an incomplete push subscription.");
  }

  await register({
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    userAgent: navigator.userAgent,
  });
  return subscription;
}

export async function disableDevicePush(
  disable: (args: { endpoint: string }) => Promise<unknown>,
) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    await clearAppBadge();
    return;
  }

  try {
    await disable({ endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe();
    await clearAppBadge();
    postServiceWorkerMessage({ type: "CLOSE_ALL_NOTIFICATIONS" });
  }
}

export async function setAppBadge(unreadCount: number) {
  const badgeNavigator = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (unreadCount > 0) {
      await badgeNavigator.setAppBadge?.(unreadCount);
    } else {
      await badgeNavigator.clearAppBadge?.();
    }
  } catch {
    // Badging is advisory and unavailable on some otherwise supported devices.
  }
  postServiceWorkerMessage({ type: "SET_BADGE", unreadCount });
}

export async function clearAppBadge() {
  await setAppBadge(0);
}

export function closeSystemNotification(notificationId: string) {
  postServiceWorkerMessage({
    type: "CLOSE_NOTIFICATION",
    notificationId,
  });
}

export function closeAllSystemNotifications() {
  postServiceWorkerMessage({ type: "CLOSE_ALL_NOTIFICATIONS" });
}

function postServiceWorkerMessage(message: Record<string, unknown>) {
  navigator.serviceWorker?.controller?.postMessage(message);
}
