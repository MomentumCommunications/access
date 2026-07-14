import {
  matchTuitionTier,
  type NormalizedTuitionTier,
} from "./tuition-pricing.ts";

export const enrollmentEstimateBillingNote =
  "Estimated total. Final billing may vary due to prorations, discounts, or staff-reviewed adjustments.";

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

function isValidDateValue(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateSpecificEnrollmentDateRange({
  startDate,
  endDate,
  today,
  classStartDate,
  classEndDate,
  classTitle = "The selected class",
}: {
  startDate?: string;
  endDate?: string;
  today: string;
  classStartDate?: string;
  classEndDate?: string;
  classTitle?: string;
}) {
  if (startDate === undefined && endDate === undefined) return;
  if (!isValidDateValue(startDate)) {
    throw new Error("Choose a valid enrollment start date.");
  }
  if (endDate !== undefined && !isValidDateValue(endDate)) {
    throw new Error("Choose a valid enrollment end date.");
  }
  if (startDate < today) {
    throw new Error("Enrollment start date cannot be before today.");
  }
  if (endDate !== undefined && endDate < startDate) {
    throw new Error("Enrollment end date must be on or after the start date.");
  }
  if (classEndDate && startDate > classEndDate) {
    throw new Error(`${classTitle} ends before the requested start date.`);
  }
  if (endDate && classStartDate && endDate < classStartDate) {
    throw new Error(`${classTitle} begins after the requested end date.`);
  }
}
