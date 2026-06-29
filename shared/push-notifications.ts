export const PUSH_NOTIFICATION_TYPES = new Set([
  "user.registered",
  "enrollment.pending",
  "enrollment.enrolled",
  "enrollment.waitlisted",
  "enrollment.rejected",
  "attendance.incomplete",
]);

export const PUSH_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];

export function shouldSendPush(type: string) {
  return PUSH_NOTIFICATION_TYPES.has(type);
}

export function pushRetryDelay(attemptCount: number) {
  return PUSH_RETRY_DELAYS_MS[attemptCount - 1];
}

export function classifyPushFailure(statusCode?: number) {
  if (statusCode === 404 || statusCode === 410) return "expired" as const;
  if (statusCode === 408 || statusCode === 429 || (statusCode ?? 0) >= 500) {
    return "retryable" as const;
  }
  return "permanent" as const;
}

export function safeInternalPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const url = new URL(path, "https://access.invalid");
    return url.origin === "https://access.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

export function shouldShowPushPrompt(
  state:
    | "loading"
    | "unsupported"
    | "missing_config"
    | "service_worker_error"
    | "requires_install"
    | "denied"
    | "prompt"
    | "enabled",
  dismissed: boolean,
) {
  return (
    !dismissed && (state === "prompt" || state === "requires_install")
  );
}

export function selectPushTargets<
  T extends {
    id: string;
    recipientUserId: string;
    disabledAt?: number;
  },
>(subscriptions: readonly T[], recipientUserId: string, requestedId?: string) {
  return subscriptions.filter(
    (subscription) =>
      subscription.recipientUserId === recipientUserId &&
      subscription.disabledAt === undefined &&
      (!requestedId || subscription.id === requestedId),
  );
}

export function canManagePushSubscription(
  subscription: { recipientUserId: string } | null | undefined,
  currentUserId: string,
) {
  return subscription?.recipientUserId === currentUserId;
}
