export const MAILCHIMP_RETRY_DELAYS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
] as const;

export type MailchimpClientCandidate = {
  email: string | string[] | undefined;
  firstName?: string;
  lastName?: string;
  onboardingStatus?: "pending" | "complete";
  roles: readonly string[];
};

export type MailchimpMember = {
  email: string;
  firstName: string;
  lastName: string;
};

export function normalizeMailchimpEmail(email: string | undefined) {
  const normalized = email?.trim().toLowerCase() || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

export function selectMailchimpClient(
  candidate: MailchimpClientCandidate,
): MailchimpMember | null {
  if (
    candidate.onboardingStatus !== "complete" ||
    candidate.roles.includes("staff") ||
    candidate.roles.includes("admin")
  ) {
    return null;
  }

  const rawEmail = Array.isArray(candidate.email)
    ? candidate.email[0]
    : candidate.email;
  const email = normalizeMailchimpEmail(rawEmail);
  if (!email) return null;

  return {
    email,
    firstName: candidate.firstName?.trim() || "",
    lastName: candidate.lastName?.trim() || "",
  };
}

export function mailchimpServerPrefix(apiKey: string) {
  const match = apiKey.trim().match(/-([a-z]{2}\d+)$/i);
  return match?.[1]?.toLowerCase() || null;
}

export function mailchimpMemberPayload(member: MailchimpMember) {
  return {
    email_address: member.email,
    status_if_new: "subscribed" as const,
    merge_fields: {
      FNAME: member.firstName,
      LNAME: member.lastName,
    },
  };
}

export function isRetryableMailchimpFailure(status?: number) {
  return status === undefined || status === 429 || status >= 500;
}

export function mailchimpRetryDelay(attempt: number) {
  return MAILCHIMP_RETRY_DELAYS_MS[attempt];
}
