import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateEnrollmentEstimate,
  enrollmentEstimateBillingNote,
  enrollmentSaveErrorMessage,
  enrollmentSaveButtonState,
  enrollmentSaveSuccessMessage,
  normalizeEnrollmentSelectionRequest,
  validateSpecificEnrollmentDateRange,
} from "../shared/class-enrollment-estimate.ts";

const tiers = [
  {
    label: "One hour",
    maxWeeklyMinutes: 60,
    monthlyAmountCents: 7500,
    sortOrder: 0,
  },
  {
    label: "Two hours",
    maxWeeklyMinutes: 120,
    monthlyAmountCents: 11200,
    sortOrder: 1,
  },
  {
    label: "Unlimited",
    monthlyAmountCents: 20000,
    sortOrder: 2,
  },
];

describe("class enrollment estimate", () => {
  it("recalculates monthly tuition for a recurring class selection", () => {
    const estimate = calculateEnrollmentEstimate({
      currentWeeklyMinutes: 60,
      selectedRecurringWeeklyMinutes: 45,
      selectedSessionChargesCents: [],
      tiers,
    });

    assert.equal(estimate.currentMonthlyTuitionCents, 7500);
    assert.equal(estimate.proposedMonthlyTuitionCents, 11200);
    assert.equal(estimate.estimatedDifferenceCents, 3700);
  });

  it("adds per-session selections to the proposed estimate", () => {
    const estimate = calculateEnrollmentEstimate({
      currentWeeklyMinutes: 60,
      selectedRecurringWeeklyMinutes: 0,
      selectedSessionChargesCents: [2500, 2500],
      tiers,
    });

    assert.equal(estimate.currentEstimatedTotalCents, 7500);
    assert.equal(estimate.proposedEstimatedTotalCents, 12500);
    assert.equal(estimate.estimatedDifferenceCents, 5000);
  });

  it("returns a useful fallback when pricing is unavailable", () => {
    const estimate = calculateEnrollmentEstimate({
      currentWeeklyMinutes: 60,
      selectedRecurringWeeklyMinutes: 45,
      selectedSessionChargesCents: [],
      tiers: [],
    });

    assert.equal(estimate.available, false);
    assert.match(estimate.warning || "", /not configured/);
  });

  it("keeps the billing disclaimer visible and explicit", () => {
    assert.match(enrollmentEstimateBillingNote, /Estimated total/);
    assert.match(enrollmentEstimateBillingNote, /prorations/);
    assert.match(enrollmentEstimateBillingNote, /discounts/);
  });

  it("normalizes multiple class and session selections for one save", () => {
    assert.deepEqual(
      normalizeEnrollmentSelectionRequest({
        recurringClassIds: ["class-b", "class-a", "class-a"],
        sessionIdsByClass: {
          "class-summer": ["session-2", "session-1", "session-1"],
          empty: [],
        },
      }),
      {
        recurringClassIds: ["class-a", "class-b"],
        sessionSelections: [
          {
            classId: "class-summer",
            sessionIds: ["session-1", "session-2"],
          },
        ],
      },
    );
  });

  it("disables saving without changes and reflects saving state", () => {
    assert.deepEqual(
      enrollmentSaveButtonState({ changeCount: 0, saving: false }),
      { disabled: true, label: "No changes to save" },
    );
    assert.deepEqual(
      enrollmentSaveButtonState({ changeCount: 2, saving: true }),
      { disabled: true, label: "Saving selections..." },
    );
    assert.deepEqual(
      enrollmentSaveButtonState({ changeCount: 2, saving: false }),
      { disabled: false, label: "Request enrollment" },
    );
  });

  it("provides clear success and failure feedback", () => {
    assert.equal(
      enrollmentSaveSuccessMessage({
        recurringRequestCount: 1,
        sessionRequestCount: 2,
      }),
      "3 enrollment selections were submitted.",
    );
    assert.equal(
      enrollmentSaveErrorMessage(new Error("A selected class is full.")),
      "A selected class is full.",
    );
    assert.equal(
      enrollmentSaveErrorMessage(null),
      "Enrollment selections could not be saved.",
    );
  });

  it("accepts open-ended specific enrollment dates", () => {
    assert.doesNotThrow(() =>
      validateSpecificEnrollmentDateRange({
        startDate: "2026-07-01",
        today: "2026-06-20",
      }),
    );
  });

  it("rejects past, reversed, and non-overlapping date ranges", () => {
    assert.throws(
      () =>
        validateSpecificEnrollmentDateRange({
          startDate: "2026-06-19",
          today: "2026-06-20",
        }),
      /cannot be before today/,
    );
    assert.throws(
      () =>
        validateSpecificEnrollmentDateRange({
          startDate: "2026-07-10",
          endDate: "2026-07-01",
          today: "2026-06-20",
        }),
      /on or after the start date/,
    );
    assert.throws(
      () =>
        validateSpecificEnrollmentDateRange({
          startDate: "2026-09-01",
          today: "2026-06-20",
          classEndDate: "2026-08-31",
          classTitle: "Ballet I",
        }),
      /ends before the requested start date/,
    );
  });
});
