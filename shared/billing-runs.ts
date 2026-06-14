import {
  applyBillingAdjustments,
  type BillingAdjustmentLike,
} from "./billing-adjustments.ts";

export const billingRunSourceModes = ["tuition", "charges", "both"] as const;
export type BillingRunSourceMode = (typeof billingRunSourceModes)[number];

export type BillingRunTuitionSource = {
  householdId: string;
  householdName: string;
  householdLinkSource: string;
  totalTuitionCents: number;
  studentCount: number;
  hasIncompleteTuition: boolean;
};

export type BillingRunChargeSource = {
  householdId: string;
  householdName: string;
  householdLinkSource: string;
  sourceType: "private" | "per_session";
  sourceId: string;
  amountCents?: number;
};

export type BillingRunBundle = {
  householdId: string;
  householdName: string;
  householdLinkSource: string;
  includeTuition: boolean;
  includeCharges: boolean;
  tuitionSubtotalCents: number;
  chargesSubtotalCents: number;
  subtotalBeforeRunAdjustmentsCents: number;
  sourceSummary: {
    tuitionStudentCount: number;
    tuitionIncomplete: boolean;
    privateChargeCount: number;
    perSessionChargeCount: number;
    unpricedChargeCount: number;
  };
  sourceReferences: {
    tuitionHouseholdId?: string;
    privateChargeIds: string[];
    perSessionChargeIds: string[];
  };
};

export function buildBillingRunItemSnapshot(
  bundle: BillingRunBundle,
  periodStart: string,
  periodEnd: string,
) {
  return {
    ...bundle,
    periodStart,
    periodEnd,
  };
}

function includesTuition(mode: BillingRunSourceMode) {
  return mode === "tuition" || mode === "both";
}

function includesCharges(mode: BillingRunSourceMode) {
  return mode === "charges" || mode === "both";
}

export function billingRunSourcesOverlap(
  left: BillingRunSourceMode,
  right: BillingRunSourceMode,
) {
  return (
    (includesTuition(left) && includesTuition(right)) ||
    (includesCharges(left) && includesCharges(right))
  );
}

export function buildBillingRunBundles({
  sourceMode,
  tuitionHouseholds,
  charges,
}: {
  sourceMode: BillingRunSourceMode;
  tuitionHouseholds: BillingRunTuitionSource[];
  charges: BillingRunChargeSource[];
}): BillingRunBundle[] {
  if (!billingRunSourceModes.includes(sourceMode)) {
    throw new Error("Billing run source mode is not supported.");
  }

  const grouped = new Map<string, BillingRunBundle>();
  const ensureBundle = ({
    householdId,
    householdName,
    householdLinkSource,
  }: {
    householdId: string;
    householdName: string;
    householdLinkSource: string;
  }) => {
    const existing = grouped.get(householdId);
    if (existing) return existing;
    const bundle: BillingRunBundle = {
      householdId,
      householdName,
      householdLinkSource,
      includeTuition: includesTuition(sourceMode),
      includeCharges: includesCharges(sourceMode),
      tuitionSubtotalCents: 0,
      chargesSubtotalCents: 0,
      subtotalBeforeRunAdjustmentsCents: 0,
      sourceSummary: {
        tuitionStudentCount: 0,
        tuitionIncomplete: false,
        privateChargeCount: 0,
        perSessionChargeCount: 0,
        unpricedChargeCount: 0,
      },
      sourceReferences: {
        privateChargeIds: [],
        perSessionChargeIds: [],
      },
    };
    grouped.set(householdId, bundle);
    return bundle;
  };

  if (includesTuition(sourceMode)) {
    for (const tuition of tuitionHouseholds) {
      const bundle = ensureBundle(tuition);
      bundle.tuitionSubtotalCents = tuition.totalTuitionCents;
      bundle.sourceSummary.tuitionStudentCount = tuition.studentCount;
      bundle.sourceSummary.tuitionIncomplete = tuition.hasIncompleteTuition;
      bundle.sourceReferences.tuitionHouseholdId = tuition.householdId;
    }
  }

  if (includesCharges(sourceMode)) {
    for (const charge of charges) {
      const bundle = ensureBundle(charge);
      if (charge.amountCents === undefined) {
        bundle.sourceSummary.unpricedChargeCount += 1;
      } else {
        bundle.chargesSubtotalCents += charge.amountCents;
      }
      if (charge.sourceType === "private") {
        bundle.sourceSummary.privateChargeCount += 1;
        bundle.sourceReferences.privateChargeIds.push(charge.sourceId);
      } else {
        bundle.sourceSummary.perSessionChargeCount += 1;
        bundle.sourceReferences.perSessionChargeIds.push(charge.sourceId);
      }
    }
  }

  return [...grouped.values()]
    .map((bundle) => ({
      ...bundle,
      subtotalBeforeRunAdjustmentsCents:
        bundle.tuitionSubtotalCents + bundle.chargesSubtotalCents,
      sourceReferences: {
        ...bundle.sourceReferences,
        privateChargeIds: [...bundle.sourceReferences.privateChargeIds].sort(),
        perSessionChargeIds: [
          ...bundle.sourceReferences.perSessionChargeIds,
        ].sort(),
      },
    }))
    .sort(
      (left, right) =>
        left.householdName.localeCompare(right.householdName) ||
        left.householdId.localeCompare(right.householdId),
    );
}

export function calculateBillingRunItemTotal(
  subtotalBeforeRunAdjustmentsCents: number,
  adjustments: BillingAdjustmentLike[],
) {
  const applied = applyBillingAdjustments(
    subtotalBeforeRunAdjustmentsCents,
    adjustments,
  );
  return {
    ...applied,
    adjustmentTotalCents: applied.adjustments.reduce(
      (total, adjustment) => total + adjustment.amountCents,
      0,
    ),
  };
}

export function resolveBillingRunGeneration<
  TRun extends { status: "draft" | "dispatched" },
>(existingRuns: TRun[]) {
  const draft = existingRuns.find((run) => run.status === "draft");
  if (draft) {
    return { action: "reuse_draft" as const, run: draft };
  }
  const dispatched = existingRuns.find((run) => run.status === "dispatched");
  if (dispatched) {
    return { action: "already_dispatched" as const, run: dispatched };
  }
  return { action: "create" as const };
}

export function selectBillingRunItemsForDispatch<
  TItem extends { id: string; status: "draft" | "dispatched" },
>(items: TItem[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return items.filter(
    (item) => item.status === "draft" && selected.has(item.id),
  );
}

export function pendingBillingRunItems<
  TItem extends { status: "draft" | "dispatched" },
>(items: TItem[]) {
  return items.filter((item) => item.status === "draft");
}
