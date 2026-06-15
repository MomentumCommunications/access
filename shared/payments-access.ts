export type PaymentsAccessStatus =
  | "ready"
  | "not_billable"
  | "missing_stripe_customer"
  | "missing_household"
  | "missing_billing_responsibility";

type HouseholdMembership = {
  id: string;
  householdId: string;
  createdAt: number;
};

type Household = {
  id: string;
};

type HouseholdPayer = {
  id: string;
  householdId: string;
  userId: string;
  active: boolean;
  isPrimary: boolean;
  createdAt: number;
};

export type PaymentsAccessResult = {
  status: PaymentsAccessStatus;
  householdId?: string;
  billingResponsibleUserId?: string;
  stripeCustomerId?: string;
};

const portalAccessErrorMessages = {
  unauthenticated: "Sign in to manage payments.",
  missing_household: "No household is connected to this account.",
  missing_billing_responsibility:
    "This household does not have a primary payment account.",
  not_billable: "This account is not the household payment account.",
  missing_stripe_customer: "Billing access is not ready for this account.",
} as const;

export function resolvePaymentsAccess({
  userId,
  stripeCustomerId,
  memberships,
  households,
  payers,
}: {
  userId: string;
  stripeCustomerId?: string;
  memberships: HouseholdMembership[];
  households: Household[];
  payers: HouseholdPayer[];
}): PaymentsAccessResult {
  const householdIds = new Set(households.map((household) => household.id));
  const membership = memberships
    .filter((candidate) => householdIds.has(candidate.householdId))
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left.householdId.localeCompare(right.householdId) ||
        left.id.localeCompare(right.id),
    )[0];

  if (!membership) {
    return { status: "missing_household" };
  }

  const primaryPayer = payers
    .filter(
      (payer) =>
        payer.householdId === membership.householdId &&
        payer.active &&
        payer.isPrimary,
    )
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )[0];

  if (!primaryPayer) {
    return {
      status: "missing_billing_responsibility",
      householdId: membership.householdId,
    };
  }

  if (primaryPayer.userId !== userId) {
    return {
      status: "not_billable",
      householdId: membership.householdId,
      billingResponsibleUserId: primaryPayer.userId,
    };
  }

  if (!stripeCustomerId?.trim()) {
    return {
      status: "missing_stripe_customer",
      householdId: membership.householdId,
      billingResponsibleUserId: primaryPayer.userId,
    };
  }

  return {
    status: "ready",
    householdId: membership.householdId,
    billingResponsibleUserId: primaryPayer.userId,
    stripeCustomerId: stripeCustomerId.trim(),
  };
}

export function validateStripePortalReturnUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Stripe portal return URL.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/payments" ||
    url.searchParams.get("portal") !== "returned"
  ) {
    throw new Error("Invalid Stripe portal return URL.");
  }

  return url.toString();
}

export async function createStripePortalSessionForAccess({
  access,
  returnUrl,
  createSession,
}: {
  access:
    | PaymentsAccessResult
    | { status: "unauthenticated" };
  returnUrl: string;
  createSession: (args: {
    customer: string;
    returnUrl: string;
  }) => Promise<{ url?: string | null }>;
}) {
  if (access.status !== "ready") {
    throw new Error(portalAccessErrorMessages[access.status]);
  }
  if (!access.stripeCustomerId) {
    throw new Error(
      portalAccessErrorMessages.missing_stripe_customer,
    );
  }

  const session = await createSession({
    customer: access.stripeCustomerId,
    returnUrl: validateStripePortalReturnUrl(returnUrl),
  });
  if (!session.url) {
    throw new Error("Stripe did not return a portal URL.");
  }
  return { url: session.url };
}
