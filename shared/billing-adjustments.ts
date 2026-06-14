export const billingAdjustmentScopeTypes = [
  "household_tuition",
  "billing_run_item",
] as const;
export const billingAdjustmentKinds = ["discount", "surcharge"] as const;
export const billingAdjustmentCalculationTypes = [
  "fixed_cents",
  "percent",
] as const;
export const billingAdjustmentReasonCodes = [
  "scholarship",
  "goodwill",
  "manual_correction",
  "waiver",
  "surcharge",
  "other",
] as const;
export const billingAdjustmentStatuses = ["active", "voided"] as const;

export type BillingAdjustmentScopeType =
  (typeof billingAdjustmentScopeTypes)[number];
export type BillingAdjustmentKind = (typeof billingAdjustmentKinds)[number];
export type BillingAdjustmentCalculationType =
  (typeof billingAdjustmentCalculationTypes)[number];
export type BillingAdjustmentReasonCode =
  (typeof billingAdjustmentReasonCodes)[number];
export type BillingAdjustmentStatus =
  (typeof billingAdjustmentStatuses)[number];

export type BillingAdjustmentInput = {
  scopeType: BillingAdjustmentScopeType;
  scopeId: string;
  periodStart: string;
  periodEnd: string;
  kind: BillingAdjustmentKind;
  calculationType: BillingAdjustmentCalculationType;
  amount: number;
  reasonCode: BillingAdjustmentReasonCode;
  note?: string;
};

export type BillingAdjustmentLike = BillingAdjustmentInput & {
  id: string;
  status: BillingAdjustmentStatus;
  createdAt: number;
};

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function validateBillingAdjustmentInput(
  adjustment: BillingAdjustmentInput,
) {
  if (!billingAdjustmentScopeTypes.includes(adjustment.scopeType)) {
    throw new Error("Billing adjustment scope is not supported.");
  }
  if (!adjustment.scopeId.trim()) {
    throw new Error("Billing adjustment scope is required.");
  }
  if (
    !isValidIsoDate(adjustment.periodStart) ||
    !isValidIsoDate(adjustment.periodEnd)
  ) {
    throw new Error("Billing adjustment dates must use valid YYYY-MM-DD values.");
  }
  if (adjustment.periodEnd < adjustment.periodStart) {
    throw new Error("Billing adjustment end date cannot precede its start date.");
  }
  if (!billingAdjustmentKinds.includes(adjustment.kind)) {
    throw new Error("Billing adjustment kind is not supported.");
  }
  if (
    !billingAdjustmentCalculationTypes.includes(adjustment.calculationType)
  ) {
    throw new Error("Billing adjustment calculation type is not supported.");
  }
  if (!billingAdjustmentReasonCodes.includes(adjustment.reasonCode)) {
    throw new Error("Billing adjustment reason is not supported.");
  }
  if (!Number.isSafeInteger(adjustment.amount) || adjustment.amount <= 0) {
    throw new Error("Billing adjustment amount must be a positive integer.");
  }
  if (
    adjustment.calculationType === "percent" &&
    adjustment.amount > 10_000
  ) {
    throw new Error("Percentage adjustments cannot exceed 100%.");
  }
  if (adjustment.note && adjustment.note.length > 1000) {
    throw new Error("Billing adjustment note must be 1000 characters or fewer.");
  }
}

export function assertBillingAdjustmentEditable(
  status: BillingAdjustmentStatus,
) {
  if (status === "voided") {
    throw new Error("Voided billing adjustments cannot be edited.");
  }
}

export function buildBillingAdjustmentActivityEvent({
  adjustmentId,
  actorId,
  action,
  metadata,
}: {
  adjustmentId: string;
  actorId: string;
  action: "created" | "updated" | "voided";
  metadata: Record<string, unknown>;
}) {
  return {
    entityType: "billing_adjustment",
    entityId: adjustmentId,
    actorId,
    eventType: `billing_adjustment_${action}`,
    summary: `${
      action === "created"
        ? "Created"
        : action === "updated"
          ? "Updated"
          : "Voided"
    } a billing adjustment.`,
    metadata,
  };
}

export function selectBillingAdjustments(
  adjustments: BillingAdjustmentLike[],
  scopeType: BillingAdjustmentScopeType,
  scopeId: string,
  periodStart: string,
  periodEnd: string,
) {
  return adjustments
    .filter(
      (adjustment) =>
        adjustment.scopeType === scopeType &&
        adjustment.scopeId === scopeId &&
        adjustment.periodStart === periodStart &&
        adjustment.periodEnd === periodEnd,
    )
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
}

export function applyBillingAdjustments(
  percentageBaseCents: number,
  adjustments: BillingAdjustmentLike[],
) {
  if (!Number.isSafeInteger(percentageBaseCents)) {
    throw new Error("Billing adjustment base must be an integer cent value.");
  }
  const activeAdjustments = adjustments
    .filter((adjustment) => adjustment.status === "active")
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )
    .map((adjustment) => {
      const absoluteAmountCents =
        adjustment.calculationType === "fixed_cents"
          ? adjustment.amount
          : Math.round((percentageBaseCents * adjustment.amount) / 10_000);
      return {
        ...adjustment,
        amountCents:
          adjustment.kind === "discount"
            ? -absoluteAmountCents
            : absoluteAmountCents,
        percentageBaseCents:
          adjustment.calculationType === "percent"
            ? percentageBaseCents
            : undefined,
      };
    });

  return {
    percentageBaseCents,
    adjustments: activeAdjustments,
    totalCents:
      percentageBaseCents +
      activeAdjustments.reduce(
        (total, adjustment) => total + adjustment.amountCents,
        0,
      ),
  };
}
