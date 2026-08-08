import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePeriodTuitions,
  calculatePeriodTuitionsWithExclusions,
  type TuitionCalculationInput,
} from "../convex/lib/billing/tuitionCalculation.ts";
import {
  matchTuitionTier,
  type NormalizedTuitionTier,
} from "../shared/tuition-pricing.ts";

const tiers: NormalizedTuitionTier[] = [
  {
    label: "One hour",
    maxWeeklyMinutes: 60,
    monthlyAmountCents: 10000,
    sortOrder: 0,
  },
  {
    label: "Two hours",
    maxWeeklyMinutes: 120,
    monthlyAmountCents: 18000,
    sortOrder: 1,
  },
  {
    label: "Unlimited",
    monthlyAmountCents: 25000,
    sortOrder: 2,
  },
];

function row(
  overrides: Partial<TuitionCalculationInput> = {},
): TuitionCalculationInput {
  return {
    studentId: "student-1",
    enrollmentStatus: "enrolled",
    enrollmentStartDate: "2026-01-01",
    enrollmentEndDate: "2026-12-31",
    classStatus: "published",
    classStartDate: "2026-01-01",
    classEndDate: "2026-12-31",
    startTime: "16:00",
    endTime: "17:00",
    weekdays: ["monday"],
    prorateTuition: true,
    ...overrides,
  };
}

describe("matchTuitionTier", () => {
  it("matches inclusive thresholds and the unlimited fallback", () => {
    assert.equal(matchTuitionTier(tiers, 60)?.label, "One hour");
    assert.equal(matchTuitionTier(tiers, 61)?.label, "Two hours");
    assert.equal(matchTuitionTier(tiers, 600)?.label, "Unlimited");
    assert.equal(matchTuitionTier(tiers, 0), undefined);
  });

  it("uses a finite final tier as the open-ended pricing cap", () => {
    const finiteTiers = tiers.slice(0, 2);
    assert.equal(matchTuitionTier(finiteTiers, 120)?.label, "Two hours");
    assert.equal(matchTuitionTier(finiteTiers, 121)?.label, "Two hours");
    assert.equal(matchTuitionTier(finiteTiers, 600)?.label, "Two hours");
    assert.equal(matchTuitionTier([], 600), undefined);
  });
});

describe("calculatePeriodTuitions", () => {
  it("prices an enrollment active for the entire period", () => {
    assert.equal(
      calculatePeriodTuitions(
        [row()],
        tiers,
        "2026-06-01",
        "2026-06-30",
      )[0].totalTuitionCents,
      10000,
    );
  });

  it("prorates a mid-period enrollment by calendar days", () => {
    const result = calculatePeriodTuitions(
      [row({ enrollmentStartDate: "2026-06-16" })],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 5000);
    assert.deepEqual(
      result.segments.map(({ days, weeklyMinutes }) => ({
        days,
        weeklyMinutes,
      })),
      [
        { days: 15, weeklyMinutes: 0 },
        { days: 15, weeklyMinutes: 60 },
      ],
    );
  });

  it("treats a legacy missing tuition treatment as prorated", () => {
    const result = calculatePeriodTuitions(
      [
        row({
          enrollmentStartDate: "2026-06-16",
          prorateTuition: undefined,
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 5000);
  });

  it("charges the full period when enrollment proration is disabled", () => {
    const result = calculatePeriodTuitions(
      [
        row({
          enrollmentStartDate: "2026-06-16",
          prorateTuition: false,
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 10000);
    assert.deepEqual(result.segments, [
      {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        days: 30,
        weeklyMinutes: 60,
        tierLabel: "One hour",
        monthlyAmountCents: 10000,
        weightedAmountCents: 10000,
      },
    ]);
  });

  it("charges an overlapping dropped enrollment for the full period", () => {
    const result = calculatePeriodTuitions(
      [
        row({
          enrollmentStatus: "dropped",
          enrollmentEndDate: "2026-06-15",
          prorateTuition: false,
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 10000);
  });

  it("prices nonlinear tier changes before applying day weights", () => {
    const result = calculatePeriodTuitions(
      [
        row(),
        row({
          enrollmentStartDate: "2026-06-16",
          startTime: "17:00",
          endTime: "18:00",
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 14000);
    assert.deepEqual(
      result.segments.map(({ tierLabel, days }) => ({ tierLabel, days })),
      [
        { tierLabel: "One hour", days: 15 },
        { tierLabel: "Two hours", days: 15 },
      ],
    );
  });

  it("charges the full period across overlapping class boundaries", () => {
    const result = calculatePeriodTuitions(
      [
        row({
          classStartDate: "2026-06-16",
          enrollmentStartDate: "2026-06-16",
          prorateTuition: false,
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 10000);
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].days, 30);
  });

  it("keeps class boundaries date-weighted for prorated enrollments", () => {
    const result = calculatePeriodTuitions(
      [row({ classStartDate: "2026-06-16" })],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 5000);
  });

  it("prices hours above a finite final tier at that tier", () => {
    const result = calculatePeriodTuitions(
      [row({ startTime: "16:00", endTime: "19:00" })],
      tiers.slice(0, 2),
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 18000);
    assert.equal(result.warning, undefined);
    assert.equal(result.segments[0].tierLabel, "Two hours");
  });

  it("returns a warning when tuition pricing is not configured", () => {
    const result = calculatePeriodTuitions(
      [row()],
      [],
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, undefined);
    assert.match(result.warning!, /No tuition tier/);
  });

  it("does not pull a non-overlapping full-period enrollment into the period", () => {
    assert.deepEqual(
      calculatePeriodTuitions(
        [
          row({
            enrollmentStartDate: "2026-07-01",
            prorateTuition: false,
          }),
        ],
        tiers,
        "2026-06-01",
        "2026-06-30",
      ),
      [],
    );
  });

  it("does not bill a full-period class outside the period", () => {
    assert.deepEqual(
      calculatePeriodTuitions(
        [
          row({
            classStartDate: "2026-07-01",
            prorateTuition: false,
          }),
        ],
        tiers,
        "2026-06-01",
        "2026-06-30",
      ),
      [],
    );
  });

  it("does not bill non-overlapping class and enrollment ranges", () => {
    assert.deepEqual(
      calculatePeriodTuitions(
        [
          row({
            enrollmentStartDate: "2026-06-01",
            enrollmentEndDate: "2026-06-10",
            classStartDate: "2026-06-11",
            prorateTuition: false,
          }),
        ],
        tiers,
        "2026-06-01",
        "2026-06-30",
      ),
      [],
    );
  });

  it("combines full-period and prorated enrollments by actual segments", () => {
    const result = calculatePeriodTuitions(
      [
        row({
          classStartDate: "2026-06-16",
          enrollmentStartDate: "2026-06-16",
          prorateTuition: false,
        }),
        row({
          enrollmentStartDate: "2026-06-16",
          startTime: "17:00",
          endTime: "18:00",
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    )[0];

    assert.equal(result.totalTuitionCents, 14000);
    assert.deepEqual(
      result.segments.map(({ days, weeklyMinutes }) => ({
        days,
        weeklyMinutes,
      })),
      [
        { days: 15, weeklyMinutes: 60 },
        { days: 15, weeklyMinutes: 120 },
      ],
    );
  });

  it("surfaces invalid enrollment rows instead of silently omitting them", () => {
    const result = calculatePeriodTuitionsWithExclusions(
      [
        row({
          enrollmentId: "enrollment-1",
          classId: "class-1",
          classTitle: "Technique",
          enrollmentStatus: "dropped",
          enrollmentEndDate: undefined,
          prorateTuition: false,
        }),
        row({
          enrollmentId: "enrollment-2",
          classId: "class-2",
          enrollmentStartDate: "2026-99-01",
        }),
        row({
          enrollmentId: "enrollment-3",
          classId: "class-3",
          enrollmentStartDate: "2026-07-01",
          enrollmentEndDate: "2026-06-01",
        }),
      ],
      tiers,
      "2026-06-01",
      "2026-06-30",
    );

    assert.deepEqual(result.tuitions, []);
    assert.deepEqual(
      result.excludedEnrollments.map(({ enrollmentId, code }) => ({
        enrollmentId,
        code,
      })),
      [
        {
          enrollmentId: "enrollment-1",
          code: "dropped_missing_end_date",
        },
        { enrollmentId: "enrollment-2", code: "invalid_start_date" },
        { enrollmentId: "enrollment-3", code: "reversed_date_range" },
      ],
    );
  });
});
