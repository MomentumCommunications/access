import type { BillingAdjustmentReasonCode } from "./billing-adjustments.ts";

export type StripeCollectionMethod =
  | "charge_automatically"
  | "send_invoice";

export type HouseholdStripeBillingTarget =
  | {
      status: "ready";
      householdId: string;
      billingResponsibleUserId: string;
      stripeCustomerId: string;
      autopayEnabled: boolean;
    }
  | {
      status:
        | "missing_household"
        | "missing_billing_responsibility"
        | "missing_stripe_customer";
      householdId: string;
      billingResponsibleUserId?: string;
      reason: string;
    };

type BillingPayer = {
  id: string;
  householdId: string;
  userId: string;
  active: boolean;
  isPrimary: boolean;
  autopayEnabled?: boolean;
  createdAt: number;
};

type BillingUser = {
  id: string;
  stripeCustomerId?: string;
};

export function resolveHouseholdStripeBillingTarget({
  householdId,
  householdExists,
  payers,
  users,
}: {
  householdId: string;
  householdExists: boolean;
  payers: BillingPayer[];
  users: BillingUser[];
}): HouseholdStripeBillingTarget {
  if (!householdExists) {
    return {
      status: "missing_household",
      householdId,
      reason: "The billing run item is not connected to a valid household.",
    };
  }

  const payer = payers
    .filter(
      (candidate) =>
        candidate.householdId === householdId &&
        candidate.active &&
        candidate.isPrimary,
    )
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )[0];
  if (!payer) {
    return {
      status: "missing_billing_responsibility",
      householdId,
      reason: "The household does not have an active primary payer.",
    };
  }

  const user = users.find((candidate) => candidate.id === payer.userId);
  const stripeCustomerId = user?.stripeCustomerId?.trim();
  if (!stripeCustomerId) {
    return {
      status: "missing_stripe_customer",
      householdId,
      billingResponsibleUserId: payer.userId,
      reason: "The household payer does not have a Stripe customer.",
    };
  }

  return {
    status: "ready",
    householdId,
    billingResponsibleUserId: payer.userId,
    stripeCustomerId,
    autopayEnabled: payer.autopayEnabled === true,
  };
}

export type PaymentMethodReadiness =
  | {
      status: "ready";
      hasUsableDefaultPaymentMethod: boolean;
    }
  | {
      status: "lookup_failed";
      reason: string;
    };

export function resolveInvoiceCollectionMethod({
  autopayEnabled,
  readiness,
}: {
  autopayEnabled: boolean;
  readiness?: PaymentMethodReadiness;
}):
  | {
      status: "ready";
      collectionMethod: StripeCollectionMethod;
      reason:
        | "autopay_disabled"
        | "autopay_enabled_with_payment_method"
        | "autopay_enabled_missing_payment_method";
    }
  | {
      status: "blocked";
      reason: "stripe_payment_method_lookup_failed";
      message: string;
    } {
  if (!autopayEnabled) {
    return {
      status: "ready",
      collectionMethod: "send_invoice",
      reason: "autopay_disabled",
    };
  }
  if (!readiness || readiness.status === "lookup_failed") {
    return {
      status: "blocked",
      reason: "stripe_payment_method_lookup_failed",
      message:
        readiness?.status === "lookup_failed"
          ? readiness.reason
          : "Stripe payment-method readiness could not be determined.",
    };
  }
  if (readiness.hasUsableDefaultPaymentMethod) {
    return {
      status: "ready",
      collectionMethod: "charge_automatically",
      reason: "autopay_enabled_with_payment_method",
    };
  }
  return {
    status: "ready",
    collectionMethod: "send_invoice",
    reason: "autopay_enabled_missing_payment_method",
  };
}

const adjustmentReasonLabels: Record<
  BillingAdjustmentReasonCode,
  string
> = {
  scholarship: "Scholarship",
  goodwill: "Goodwill",
  manual_correction: "Manual correction",
  waiver: "Waiver",
  surcharge: "Surcharge",
  other: "Other",
};

export type StripeInvoiceLine = {
  key: string;
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
};

export function buildBillingRunStripeInvoiceLines({
  item,
  adjustments,
}: {
  item: {
    id: string;
    periodStart: string;
    periodEnd: string;
    tuitionSubtotalCents: number;
    chargesSubtotalCents: number;
    sourceSummary: {
      tuitionStudentCount: number;
      privateChargeCount: number;
      perSessionChargeCount: number;
    };
  };
  adjustments: {
    id: string;
    reasonCode: BillingAdjustmentReasonCode;
    note?: string;
    amountCents: number;
  }[];
}) {
  const lines: StripeInvoiceLine[] = [];
  const period = `${item.periodStart} through ${item.periodEnd}`;

  if (item.tuitionSubtotalCents !== 0) {
    lines.push({
      key: "tuition",
      amountCents: item.tuitionSubtotalCents,
      description: `Tuition - ${period} (${item.sourceSummary.tuitionStudentCount} student${item.sourceSummary.tuitionStudentCount === 1 ? "" : "s"})`,
      metadata: {
        access_line_type: "tuition",
        billing_run_item_id: item.id,
      },
    });
  }
  if (item.chargesSubtotalCents !== 0) {
    const details = [
      item.sourceSummary.privateChargeCount
        ? `${item.sourceSummary.privateChargeCount} private`
        : "",
      item.sourceSummary.perSessionChargeCount
        ? `${item.sourceSummary.perSessionChargeCount} per-session`
        : "",
    ].filter(Boolean);
    lines.push({
      key: "charges",
      amountCents: item.chargesSubtotalCents,
      description: `Charges - ${period}${details.length ? ` (${details.join(", ")})` : ""}`,
      metadata: {
        access_line_type: "charges",
        billing_run_item_id: item.id,
      },
    });
  }

  for (const adjustment of [...adjustments].sort(
    (left, right) => left.id.localeCompare(right.id),
  )) {
    const label = adjustmentReasonLabels[adjustment.reasonCode];
    lines.push({
      key: `adjustment-${adjustment.id}`,
      amountCents: adjustment.amountCents,
      description: `Adjustment - ${label}${adjustment.note ? `: ${adjustment.note}` : ""}`,
      metadata: {
        access_line_type: "adjustment",
        billing_adjustment_id: adjustment.id,
        billing_run_item_id: item.id,
      },
    });
  }

  return lines;
}

export function billingRunInvoiceIdempotencyKey(itemId: string) {
  return `access-billing-run-item-${itemId}-invoice-v1`;
}

export function billingRunInvoiceLineIdempotencyKey(
  itemId: string,
  lineKey: string,
) {
  return `access-billing-run-item-${itemId}-line-${lineKey}-v1`;
}

export async function dispatchBillingRunItemToStripe({
  item,
  target,
  readiness,
  existingStripeInvoiceId,
  createInvoice,
  retrieveInvoice,
  createInvoiceLine,
  onInvoiceResolved,
}: {
  item: {
    id: string;
    billingRunId: string;
    householdId: string;
    householdName: string;
    periodStart: string;
    periodEnd: string;
    tuitionSubtotalCents: number;
    chargesSubtotalCents: number;
    sourceSummary: {
      tuitionStudentCount: number;
      privateChargeCount: number;
      perSessionChargeCount: number;
    };
    adjustments: {
      id: string;
      reasonCode: BillingAdjustmentReasonCode;
      note?: string;
      amountCents: number;
    }[];
  };
  target: Extract<HouseholdStripeBillingTarget, { status: "ready" }>;
  readiness?: PaymentMethodReadiness;
  existingStripeInvoiceId?: string;
  createInvoice: (input: {
    customer: string;
    collectionMethod: StripeCollectionMethod;
    description: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }) => Promise<{
    id: string;
    status?: string | null;
    customer?: string | { id: string } | null;
  }>;
  retrieveInvoice: (
    invoiceId: string,
  ) => Promise<{
    id: string;
    status?: string | null;
    customer?: string | { id: string } | null;
  }>;
  createInvoiceLine: (input: {
    invoiceId: string;
    customer: string;
    line: StripeInvoiceLine;
    periodStart: string;
    periodEnd: string;
    idempotencyKey: string;
  }) => Promise<void>;
  onInvoiceResolved?: (input: {
    stripeInvoiceId: string;
    collectionMethod: StripeCollectionMethod;
  }) => void | Promise<void>;
}) {
  const collection = resolveInvoiceCollectionMethod({
    autopayEnabled: target.autopayEnabled,
    readiness,
  });
  if (collection.status === "blocked") {
    throw new Error(collection.message);
  }

  const metadata = {
    access_billing_run_id: item.billingRunId,
    access_billing_run_item_id: item.id,
    access_household_id: item.householdId,
    access_period_start: item.periodStart,
    access_period_end: item.periodEnd,
  };
  const invoice = existingStripeInvoiceId
    ? await retrieveInvoice(existingStripeInvoiceId)
    : await createInvoice({
        customer: target.stripeCustomerId,
        collectionMethod: collection.collectionMethod,
        description: `${item.householdName} billing for ${item.periodStart} through ${item.periodEnd}`,
        metadata,
        idempotencyKey: billingRunInvoiceIdempotencyKey(item.id),
      });
  if (invoice.status && invoice.status !== "draft") {
    throw new Error("The existing Stripe invoice is no longer a draft.");
  }
  const invoiceCustomer =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (
    invoiceCustomer &&
    invoiceCustomer !== target.stripeCustomerId
  ) {
    throw new Error("The existing Stripe invoice belongs to another customer.");
  }
  await onInvoiceResolved?.({
    stripeInvoiceId: invoice.id,
    collectionMethod: collection.collectionMethod,
  });

  const lines = buildBillingRunStripeInvoiceLines({
    item,
    adjustments: item.adjustments,
  });
  for (const line of lines) {
    await createInvoiceLine({
      invoiceId: invoice.id,
      customer: target.stripeCustomerId,
      line,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      idempotencyKey: billingRunInvoiceLineIdempotencyKey(
        item.id,
        line.key,
      ),
    });
  }

  return {
    stripeInvoiceId: invoice.id,
    stripeCustomerId: target.stripeCustomerId,
    collectionMethod: collection.collectionMethod,
    autopayEnabled: target.autopayEnabled,
    lineCount: lines.length,
  };
}
