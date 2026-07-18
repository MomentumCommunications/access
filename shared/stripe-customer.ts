export type StripeCustomerUser = {
  id: string;
  stripeCustomerId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string | string[];
  phone?: string;
};

export type StripeCustomerCreateInput = {
  name?: string;
  email?: string;
  phone?: string;
  metadata: {
    accessUserId: string;
  };
};

function firstEmail(email?: string | string[]) {
  const value = Array.isArray(email) ? email[0] : email;
  return value?.trim() || undefined;
}

export function stripeCustomerCreateInput(
  user: StripeCustomerUser,
): StripeCustomerCreateInput {
  const fullName = [user.firstName, user.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return {
    name: fullName || user.name?.trim() || undefined,
    email: firstEmail(user.email),
    phone: user.phone?.trim() || undefined,
    metadata: {
      accessUserId: user.id,
    },
  };
}

export function stripeCustomerIdempotencyKey(userId: string) {
  return `access-user-${userId}`;
}

export async function ensureStripeCustomerForUser({
  user,
  createCustomer,
  persistStripeCustomerIdIfMissing,
}: {
  user: StripeCustomerUser;
  createCustomer: (
    input: StripeCustomerCreateInput,
    idempotencyKey: string,
  ) => Promise<{ id: string }>;
  persistStripeCustomerIdIfMissing: (
    customerId: string,
  ) => Promise<string>;
}) {
  if (user.stripeCustomerId) {
    return {
      stripeCustomerId: user.stripeCustomerId,
      created: false,
    };
  }

  const customer = await createCustomer(
    stripeCustomerCreateInput(user),
    stripeCustomerIdempotencyKey(user.id),
  );
  if (!customer.id?.trim()) {
    throw new Error("Stripe did not return a customer ID.");
  }
  const stripeCustomerId =
    await persistStripeCustomerIdIfMissing(customer.id);
  return {
    stripeCustomerId,
    created: true,
  };
}

export async function completeStripeBackedProfileSetup<TUserId, TResult>({
  saveProfile,
  ensureStripeCustomer,
  completeProfileStep,
}: {
  saveProfile: () => Promise<TUserId>;
  ensureStripeCustomer: () => Promise<TResult>;
  completeProfileStep: (userId: TUserId) => Promise<void>;
}) {
  const userId = await saveProfile();
  const result = await ensureStripeCustomer();
  await completeProfileStep(userId);
  return result;
}
