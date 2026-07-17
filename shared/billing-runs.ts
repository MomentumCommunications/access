import {
  applyBillingAdjustments,
  applyTargetedBillingAdjustments,
  selectBillingAdjustments,
  type BillingAdjustmentLike,
  type BillingAdjustmentReasonCode,
} from "./billing-adjustments.ts";
import type { SiblingDiscountConfig } from "./tuition-pricing.ts";

export const billingRunSourceModes = ["tuition", "charges", "both"] as const;
export type BillingRunSourceMode = (typeof billingRunSourceModes)[number];

export type BillingRunTuitionSource = {
  householdId: string;
  householdName: string;
  householdLinkSource: string;
  totalTuitionCents: number;
  studentCount: number;
  hasIncompleteTuition: boolean;
  students?: {
    studentId: string;
    studentName: string;
    baseTuitionCents?: number;
  }[];
  siblingDiscount?: SiblingDiscountConfig;
  householdTuitionAdjustmentTotalCents?: number;
};

export type BillingRunChargeSource = {
  householdId: string;
  householdName: string;
  householdLinkSource: string;
  sourceType: "private" | "per_session";
  sourceId: string;
  amountCents?: number;
  studentId?: string;
  studentName?: string;
};

export type BillingRunSourceComponents = {
  tuitionStudents: {
    studentId: string;
    studentName: string;
    baseTuitionCents?: number;
  }[];
  privateStudents: {
    studentId: string;
    studentName: string;
    subtotalCents: number;
  }[];
  perSessionChargesCents: number;
  householdTuitionAdjustmentTotalCents: number;
  siblingDiscount?: SiblingDiscountConfig;
};

export type ResolvedSourceAdjustment = {
  adjustmentId: string;
  scopeType: "student_tuition" | "student_private_charges";
  scopeId: string;
  studentName: string;
  kind: "discount" | "surcharge";
  calculationType: "fixed_cents" | "percent";
  reasonCode: BillingAdjustmentReasonCode;
  note?: string;
  applicable: boolean;
  amountCents: number;
  percentageBaseCents?: number;
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
  sourceComponents: BillingRunSourceComponents;
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

export function billingRunItemOverlapsSource(
  item: { includeTuition: boolean; includeCharges: boolean },
  sourceMode: BillingRunSourceMode,
) {
  return (
    (item.includeTuition && includesTuition(sourceMode)) ||
    (item.includeCharges && includesCharges(sourceMode))
  );
}

export function selectMissingBillingRunBundles<
  TBundle extends { householdId: string },
>(
  bundles: TBundle[],
  existingItems: {
    householdId: string;
    includeTuition: boolean;
    includeCharges: boolean;
  }[],
  sourceMode: BillingRunSourceMode,
) {
  return bundles.filter(
    (bundle) =>
      !existingItems.some(
        (item) =>
          item.householdId === bundle.householdId &&
          billingRunItemOverlapsSource(item, sourceMode),
      ),
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
      sourceComponents: {
        tuitionStudents: [],
        privateStudents: [],
        perSessionChargesCents: 0,
        householdTuitionAdjustmentTotalCents: 0,
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
      bundle.sourceComponents.tuitionStudents = tuition.students || [];
      bundle.sourceComponents.siblingDiscount = tuition.siblingDiscount;
      bundle.sourceComponents.householdTuitionAdjustmentTotalCents =
        tuition.householdTuitionAdjustmentTotalCents || 0;
      if (includesCharges(sourceMode)) {
        for (const student of tuition.students || []) {
          if (
            !bundle.sourceComponents.privateStudents.some(
              (row) => row.studentId === student.studentId,
            )
          ) {
            bundle.sourceComponents.privateStudents.push({
              studentId: student.studentId,
              studentName: student.studentName,
              subtotalCents: 0,
            });
          }
        }
      }
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
        if (charge.amountCents !== undefined && charge.studentId) {
          const existing = bundle.sourceComponents.privateStudents.find(
            (row) => row.studentId === charge.studentId,
          );
          if (existing) {
            existing.subtotalCents += charge.amountCents;
          } else {
            bundle.sourceComponents.privateStudents.push({
              studentId: charge.studentId,
              studentName: charge.studentName || "Student",
              subtotalCents: charge.amountCents,
            });
          }
        }
      } else {
        bundle.sourceSummary.perSessionChargeCount += 1;
        bundle.sourceReferences.perSessionChargeIds.push(charge.sourceId);
        bundle.sourceComponents.perSessionChargesCents +=
          charge.amountCents || 0;
        if (
          charge.studentId &&
          !bundle.sourceComponents.privateStudents.some(
            (row) => row.studentId === charge.studentId,
          )
        ) {
          bundle.sourceComponents.privateStudents.push({
            studentId: charge.studentId,
            studentName: charge.studentName || "Student",
            subtotalCents: 0,
          });
        }
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
      sourceComponents: {
        ...bundle.sourceComponents,
        tuitionStudents: [...bundle.sourceComponents.tuitionStudents].sort(
          (left, right) =>
            left.studentName.localeCompare(right.studentName) ||
            left.studentId.localeCompare(right.studentId),
        ),
        privateStudents: [...bundle.sourceComponents.privateStudents].sort(
          (left, right) =>
            left.studentName.localeCompare(right.studentName) ||
            left.studentId.localeCompare(right.studentId),
        ),
      },
    }))
    .sort(
      (left, right) =>
        left.householdName.localeCompare(right.householdName) ||
        left.householdId.localeCompare(right.householdId),
    );
}

function siblingAdjustmentTotal(
  students: { studentId: string; studentName: string; subtotalCents: number }[],
  siblingDiscount?: SiblingDiscountConfig,
) {
  if (
    !siblingDiscount?.enabled ||
    siblingDiscount.appliesTo !== "all_but_highest" ||
    siblingDiscount.percentOffBasisPoints <= 0
  ) {
    return 0;
  }
  const eligible = students
    .filter((student) => student.subtotalCents > 0)
    .sort(
      (left, right) =>
        right.subtotalCents - left.subtotalCents ||
        left.studentName.localeCompare(right.studentName) ||
        left.studentId.localeCompare(right.studentId),
    );
  return eligible.slice(1).reduce(
    (total, student) =>
      total -
      Math.round(
        (student.subtotalCents *
          siblingDiscount.percentOffBasisPoints) /
          10_000,
      ),
    0,
  );
}

export function resolveBillingRunSourceAdjustments({
  periodStart,
  periodEnd,
  components,
  adjustments,
}: {
  periodStart: string;
  periodEnd: string;
  components: BillingRunSourceComponents;
  adjustments: BillingAdjustmentLike[];
}) {
  const resolved: ResolvedSourceAdjustment[] = [];
  const tuitionStudents = components.tuitionStudents.map((student) => {
    const base = student.baseTuitionCents || 0;
    const applied = applyTargetedBillingAdjustments(
      base,
      selectBillingAdjustments(
        adjustments,
        "student_tuition",
        student.studentId,
        periodStart,
        periodEnd,
      ),
    );
    resolved.push(
      ...applied.adjustments.map((adjustment) => ({
        adjustmentId: adjustment.id,
        scopeType: "student_tuition" as const,
        scopeId: student.studentId,
        studentName: student.studentName,
        kind: adjustment.kind,
        calculationType: adjustment.calculationType,
        reasonCode: adjustment.reasonCode,
        note: adjustment.note,
        applicable: adjustment.applicable,
        amountCents: adjustment.amountCents,
        percentageBaseCents: adjustment.percentageBaseCents,
      })),
    );
    return {
      studentId: student.studentId,
      studentName: student.studentName,
      subtotalCents: applied.totalCents,
    };
  });
  const adjustedTuitionBeforeHousehold =
    tuitionStudents.reduce(
      (total, student) => total + student.subtotalCents,
      0,
    ) +
    siblingAdjustmentTotal(tuitionStudents, components.siblingDiscount) +
    components.householdTuitionAdjustmentTotalCents;

  let adjustedPrivateSubtotalCents = 0;
  for (const student of components.privateStudents) {
    const applied = applyTargetedBillingAdjustments(
      student.subtotalCents,
      selectBillingAdjustments(
        adjustments,
        "student_private_charges",
        student.studentId,
        periodStart,
        periodEnd,
      ),
    );
    adjustedPrivateSubtotalCents += applied.totalCents;
    resolved.push(
      ...applied.adjustments.map((adjustment) => ({
        adjustmentId: adjustment.id,
        scopeType: "student_private_charges" as const,
        scopeId: student.studentId,
        studentName: student.studentName,
        kind: adjustment.kind,
        calculationType: adjustment.calculationType,
        reasonCode: adjustment.reasonCode,
        note: adjustment.note,
        applicable: adjustment.applicable,
        amountCents: adjustment.amountCents,
        percentageBaseCents: adjustment.percentageBaseCents,
      })),
    );
  }

  const sourceAdjustmentTotalCents = resolved.reduce(
    (total, adjustment) => total + adjustment.amountCents,
    0,
  );
  const tuitionAdjustmentTotalCents = resolved
    .filter((adjustment) => adjustment.scopeType === "student_tuition")
    .reduce((total, adjustment) => total + adjustment.amountCents, 0);
  const privateAdjustmentTotalCents = resolved
    .filter(
      (adjustment) =>
        adjustment.scopeType === "student_private_charges",
    )
    .reduce((total, adjustment) => total + adjustment.amountCents, 0);
  const tuitionSubtotalCents =
    adjustedTuitionBeforeHousehold - tuitionAdjustmentTotalCents;
  const chargesSubtotalCents =
    adjustedPrivateSubtotalCents -
    privateAdjustmentTotalCents +
    components.perSessionChargesCents;

  return {
    tuitionSubtotalCents,
    chargesSubtotalCents,
    sourceAdjustments: resolved.sort(
      (left, right) =>
        left.adjustmentId.localeCompare(right.adjustmentId) ||
        left.scopeType.localeCompare(right.scopeType),
    ),
    sourceAdjustmentTotalCents,
    subtotalAfterSourceAdjustmentsCents:
      tuitionSubtotalCents +
      chargesSubtotalCents +
      sourceAdjustmentTotalCents,
  };
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
  TItem extends {
    id: string;
    status: "draft" | "dispatch_failed" | "dispatched";
  },
>(items: TItem[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return items.filter(
    (item) => item.status !== "dispatched" && selected.has(item.id),
  );
}

export function pendingBillingRunItems<
  TItem extends {
    status: "draft" | "dispatch_failed" | "dispatched";
  },
>(items: TItem[]) {
  return items.filter((item) => item.status !== "dispatched");
}
