import {
  matchTuitionTier,
  type NormalizedTuitionTier,
} from "./tuition-pricing.ts";

export const enrollmentEstimateBillingNote =
  "Estimated total. Final billing may vary due to prorations, discounts, scholarships, or staff-reviewed adjustments.";

export type EnrollmentEstimateInput = {
  currentWeeklyMinutes: number;
  selectedRecurringWeeklyMinutes: number;
  selectedSessionChargesCents: number[];
  tiers: NormalizedTuitionTier[];
};

export type EnrollmentEstimate = {
  currentWeeklyMinutes: number;
  proposedWeeklyMinutes: number;
  currentMonthlyTuitionCents?: number;
  proposedMonthlyTuitionCents?: number;
  selectedSessionChargesCents: number;
  currentEstimatedTotalCents?: number;
  proposedEstimatedTotalCents?: number;
  estimatedDifferenceCents?: number;
  available: boolean;
  warning?: string;
};

export function calculateEnrollmentEstimate({
  currentWeeklyMinutes,
  selectedRecurringWeeklyMinutes,
  selectedSessionChargesCents,
  tiers,
}: EnrollmentEstimateInput): EnrollmentEstimate {
  const proposedWeeklyMinutes =
    currentWeeklyMinutes + selectedRecurringWeeklyMinutes;
  const currentTier = matchTuitionTier(tiers, currentWeeklyMinutes);
  const proposedTier = matchTuitionTier(tiers, proposedWeeklyMinutes);
  const sessionCharges = selectedSessionChargesCents.reduce(
    (total, amount) => total + amount,
    0,
  );
  const currentMonthlyTuitionCents =
    currentWeeklyMinutes === 0 ? 0 : currentTier?.monthlyAmountCents;
  const proposedMonthlyTuitionCents =
    proposedWeeklyMinutes === 0 ? 0 : proposedTier?.monthlyAmountCents;
  const available =
    currentMonthlyTuitionCents !== undefined &&
    proposedMonthlyTuitionCents !== undefined;

  if (!available) {
    return {
      currentWeeklyMinutes,
      proposedWeeklyMinutes,
      currentMonthlyTuitionCents,
      proposedMonthlyTuitionCents,
      selectedSessionChargesCents: sessionCharges,
      available: false,
      warning:
        tiers.length === 0
          ? "Tuition pricing is not configured yet."
          : "No tuition tier covers the proposed weekly class hours.",
    };
  }

  const currentEstimatedTotalCents = currentMonthlyTuitionCents;
  const proposedEstimatedTotalCents =
    proposedMonthlyTuitionCents + sessionCharges;

  return {
    currentWeeklyMinutes,
    proposedWeeklyMinutes,
    currentMonthlyTuitionCents,
    proposedMonthlyTuitionCents,
    selectedSessionChargesCents: sessionCharges,
    currentEstimatedTotalCents,
    proposedEstimatedTotalCents,
    estimatedDifferenceCents:
      proposedEstimatedTotalCents - currentEstimatedTotalCents,
    available: true,
  };
}

export function enrollmentSaveButtonState({
  changeCount,
  saving,
}: {
  changeCount: number;
  saving: boolean;
}) {
  return {
    disabled: changeCount === 0 || saving,
    label: saving
      ? "Saving selections..."
      : changeCount === 0
        ? "No changes to save"
        : "Request enrollment",
  };
}

export function enrollmentSaveSuccessMessage({
  recurringRequestCount,
  sessionRequestCount,
}: {
  recurringRequestCount: number;
  sessionRequestCount: number;
}) {
  const total = recurringRequestCount + sessionRequestCount;
  return `${total} enrollment ${
    total === 1 ? "selection was" : "selections were"
  } submitted.`;
}

export function enrollmentSaveErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Enrollment selections could not be saved.";
}

export function normalizeEnrollmentSelectionRequest({
  recurringClassIds,
  sessionIdsByClass,
}: {
  recurringClassIds: string[];
  sessionIdsByClass: Record<string, string[]>;
}) {
  return {
    recurringClassIds: [...new Set(recurringClassIds)].sort(),
    sessionSelections: Object.entries(sessionIdsByClass)
      .map(([classId, sessionIds]) => ({
        classId,
        sessionIds: [...new Set(sessionIds)].sort(),
      }))
      .filter((row) => row.sessionIds.length > 0)
      .sort((left, right) => left.classId.localeCompare(right.classId)),
  };
}
