export const REFERRAL_REWARD_CENTS = 5_000;
export const REFERRAL_DAILY_SEND_LIMIT = 10;
export const REFERRAL_SEND_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const REFERRAL_RECIPIENT_COOLDOWN_MS = 60_000;

export type ReferralStatus =
  | "invited"
  | "pending_review"
  | "credit_applied"
  | "not_eligible";
export const referralStatusLabels: Record<ReferralStatus, string> = {
  invited: "Invited",
  pending_review: "Pending review",
  credit_applied: "Credit applied",
  not_eligible: "Not eligible",
};

export function normalizeReferralEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
}

export function accountEmails(email?: string | string[]) {
  return (Array.isArray(email) ? email : email ? [email] : []).map((value) =>
    value.trim().toLowerCase(),
  );
}

// Legacy email arrays do not establish which address was verified.
export function verifiedReferralEmail(user: {
  email?: string | string[];
  emailVerificationTime?: number;
}) {
  return typeof user.email === "string" &&
    user.emailVerificationTime !== undefined
    ? user.email.trim().toLowerCase()
    : null;
}

export function assertReferralSendAllowed({
  recentCount,
  lastRecipientAttemptAt,
  now,
}: {
  recentCount: number;
  lastRecipientAttemptAt?: number;
  now: number;
}) {
  if (recentCount >= REFERRAL_DAILY_SEND_LIMIT) {
    throw new Error(
      "You can send up to 10 referral emails in 24 hours. Please try again later.",
    );
  }
  if (
    lastRecipientAttemptAt !== undefined &&
    now - lastRecipientAttemptAt < REFERRAL_RECIPIENT_COOLDOWN_MS
  ) {
    throw new Error(
      "Please wait 60 seconds before sending another invitation to this email.",
    );
  }
}

export function assertReferralDecision({
  current,
  next,
  connected,
  confirmed,
  note,
}: {
  current: ReferralStatus;
  next: Exclude<ReferralStatus, "invited">;
  connected: boolean;
  confirmed: boolean;
  note?: string;
}) {
  if (!connected)
    throw new Error(
      "This referral has not connected to a verified account yet.",
    );
  if ((note?.trim().length ?? 0) > 2_000)
    throw new Error("Keep the note under 2,000 characters.");
  if (current === next) return false;
  if (next === "pending_review") {
    if (current !== "credit_applied" && current !== "not_eligible")
      throw new Error("Only a decided referral can be reopened.");
    if (!note?.trim())
      throw new Error("Add a correction note before reopening this referral.");
  } else {
    if (current !== "pending_review")
      throw new Error("Reopen this referral before changing its decision.");
    if (next === "credit_applied" && !confirmed) {
      throw new Error(
        "Confirm that a full month was paid and the $50 credit was already applied.",
      );
    }
  }
  return true;
}
