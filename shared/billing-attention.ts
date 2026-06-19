export type BillingAttentionStatus =
  | "delinquent"
  | "missing_default_payment_method"
  | "ok";

export type BillingAttentionResult =
  | { status: BillingAttentionStatus }
  | { status: "ineligible" | "unavailable" };

export function resolveStripeBillingAttention(customer: {
  delinquent?: boolean | null;
  invoice_settings?: {
    default_payment_method?: unknown;
  } | null;
}): BillingAttentionStatus {
  if (customer.delinquent === true) {
    return "delinquent";
  }

  if (!customer.invoice_settings?.default_payment_method) {
    return "missing_default_payment_method";
  }

  return "ok";
}

export function billingAttentionPortalHref() {
  return "/payments" as const;
}

export async function loadStripeBillingAttention({
  retrieveCustomer,
}: {
  retrieveCustomer: () => Promise<{
    deleted?: boolean;
    delinquent?: boolean | null;
    invoice_settings?: {
      default_payment_method?: unknown;
    } | null;
  }>;
}): Promise<BillingAttentionResult> {
  try {
    const customer = await retrieveCustomer();
    if (customer.deleted) {
      return { status: "ineligible" };
    }
    return { status: resolveStripeBillingAttention(customer) };
  } catch {
    return { status: "unavailable" };
  }
}
