export const SECURITY_CODE_TTL_MS = 15 * 60 * 1000;
export const SECURITY_CODE_MAX_ATTEMPTS = 5;
export const SECURITY_SEND_COOLDOWN_MS = 60 * 1000;
export const SECURITY_SEND_WINDOW_MS = 60 * 60 * 1000;
export const SECURITY_SEND_MAX_PER_WINDOW = 5;

export type SecurityChallengeStatus =
  | "pending"
  | "confirming"
  | "consumed"
  | "expired"
  | "superseded"
  | "too_many_attempts";

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase();
}

export function activeChallengeStatus(
  status: SecurityChallengeStatus,
  expiresAt: number,
  now: number,
): SecurityChallengeStatus {
  if (
    (status === "pending" || status === "confirming") &&
    expiresAt <= now
  ) {
    return "expired";
  }
  return status;
}

export function nextAttemptState({
  attemptCount,
  maxAttempts,
  matches,
}: {
  attemptCount: number;
  maxAttempts: number;
  matches: boolean;
}) {
  if (matches) {
    return {
      attemptCount,
      status: "confirming" as const,
    };
  }

  const nextAttemptCount = attemptCount + 1;
  return {
    attemptCount: nextAttemptCount,
    status:
      nextAttemptCount >= maxAttempts
        ? ("too_many_attempts" as const)
        : ("pending" as const),
  };
}

export function evaluateSendThrottle({
  now,
  windowStartedAt,
  sendCount,
  lastSentAt,
}: {
  now: number;
  windowStartedAt?: number;
  sendCount?: number;
  lastSentAt?: number;
}) {
  if (
    lastSentAt !== undefined &&
    now - lastSentAt < SECURITY_SEND_COOLDOWN_MS
  ) {
    return {
      allowed: false as const,
      retryAt: lastSentAt + SECURITY_SEND_COOLDOWN_MS,
    };
  }

  const isCurrentWindow =
    windowStartedAt !== undefined &&
    now - windowStartedAt < SECURITY_SEND_WINDOW_MS;
  const currentCount = isCurrentWindow ? (sendCount ?? 0) : 0;
  if (currentCount >= SECURITY_SEND_MAX_PER_WINDOW) {
    return {
      allowed: false as const,
      retryAt: windowStartedAt! + SECURITY_SEND_WINDOW_MS,
    };
  }

  return {
    allowed: true as const,
    windowStartedAt: isCurrentWindow ? windowStartedAt! : now,
    sendCount: currentCount + 1,
    lastSentAt: now,
  };
}
