export const ACCOUNT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AccountInvitationStatus =
  | "pending"
  | "consumed"
  | "expired"
  | "revoked"
  | "superseded";

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function effectiveInvitationStatus(
  status: AccountInvitationStatus,
  expiresAt: number,
  now: number,
): AccountInvitationStatus {
  return status === "pending" && expiresAt <= now ? "expired" : status;
}

export function replacementInvitationStatus(
  status: AccountInvitationStatus,
  expiresAt: number,
  now: number,
) {
  if (status !== "pending") return status;
  return expiresAt <= now ? ("expired" as const) : ("superseded" as const);
}

export function evaluateAccountInvitationClaim({
  status,
  expiresAt,
  invitedEmail,
  currentEmail,
  targetUserId,
  currentUserId,
  emailVerified,
  now,
}: {
  status: AccountInvitationStatus;
  expiresAt: number;
  invitedEmail: string;
  currentEmail: string;
  targetUserId: string;
  currentUserId: string;
  emailVerified: boolean;
  now: number;
}) {
  const effectiveStatus = effectiveInvitationStatus(status, expiresAt, now);
  if (effectiveStatus !== "pending") {
    return { ok: false as const, reason: effectiveStatus };
  }
  if (targetUserId !== currentUserId) {
    return { ok: false as const, reason: "wrong_account" as const };
  }
  if (
    !emailVerified ||
    normalizeInvitationEmail(currentEmail) !==
      normalizeInvitationEmail(invitedEmail)
  ) {
    return { ok: false as const, reason: "wrong_email" as const };
  }
  return { ok: true as const };
}

export function isWorkforceAccount(roles: readonly string[]) {
  return roles.includes("staff") || roles.includes("admin");
}

export function nextOnboardingDestination({
  roles,
  connectedStudentCount,
}: {
  roles: readonly string[];
  connectedStudentCount: number;
}) {
  if (roles.includes("admin")) return "/admin" as const;
  if (roles.includes("staff")) return "/staff" as const;
  return connectedStudentCount > 0
    ? ("/register/review" as const)
    : ("/register/students" as const);
}

export function shouldProvisionCustomerBilling({
  onboardingSource,
  roles,
}: {
  onboardingSource?: string;
  roles: readonly string[];
}) {
  return onboardingSource !== "imported" && !isWorkforceAccount(roles);
}
