import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableTuitionMonths,
  billingMonthPeriod,
  isPrivateConnectedToHousehold,
  resolveTuitionPlanMonth,
  selectHouseholdTuitionBreakdown,
  tuitionMonthNavigation,
} from "../shared/tuition-plan.ts";

describe("customer tuition plan months", () => {
  it("returns available enrollment months in ascending order", () => {
    assert.deepEqual(
      availableTuitionMonths(
        [
          {
            enrollmentStartDate: "2026-03-15",
            enrollmentEndDate: "2026-05-01",
          },
          {
            classStartDate: "2026-01-01",
            classEndDate: "2026-02-28",
          },
        ],
        "2026-04",
      ),
      ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
    );
  });

  it("keeps a future open-ended arrangement available at its start month", () => {
    assert.deepEqual(
      availableTuitionMonths(
        [{ enrollmentStartDate: "2026-09-12" }],
        "2026-06",
      ),
      ["2026-09"],
    );
  });

  it("uses the requested month, then current month, then nearest history", () => {
    const months = ["2026-01", "2026-02", "2026-04"];
    assert.equal(
      resolveTuitionPlanMonth({
        availableMonths: months,
        requestedMonth: "2026-02",
        currentMonth: "2026-04",
      }),
      "2026-02",
    );
    assert.equal(
      resolveTuitionPlanMonth({
        availableMonths: months,
        requestedMonth: "2025-12",
        currentMonth: "2026-04",
      }),
      "2026-04",
    );
    assert.equal(
      resolveTuitionPlanMonth({
        availableMonths: months,
        currentMonth: "2026-03",
      }),
      "2026-02",
    );
  });

  it("disables navigation cleanly at month boundaries", () => {
    assert.deepEqual(
      tuitionMonthNavigation(["2026-01", "2026-02"], "2026-01"),
      {
        previousMonth: undefined,
        nextMonth: "2026-02",
      },
    );
    assert.deepEqual(
      tuitionMonthNavigation(["2026-01", "2026-02"], "2026-02"),
      {
        previousMonth: "2026-01",
        nextMonth: undefined,
      },
    );
  });

  it("creates inclusive calendar-month periods", () => {
    assert.deepEqual(billingMonthPeriod("2028-02"), {
      periodStart: "2028-02-01",
      periodEnd: "2028-02-29",
    });
  });
});

describe("customer tuition plan scoping", () => {
  it("selects only the signed-in household breakdown", () => {
    const rows = [
      { householdId: "household-a", total: 100 },
      { householdId: "household-b", total: 200 },
    ];
    assert.deepEqual(
      selectHouseholdTuitionBreakdown(rows, "household-a"),
      rows[0],
    );
    assert.equal(
      selectHouseholdTuitionBreakdown(rows, "household-c"),
      undefined,
    );
  });

  it("includes private arrangements only for household students", () => {
    const householdStudents = new Set(["student-a", "student-b"]);
    assert.equal(
      isPrivateConnectedToHousehold(
        ["student-a", "student-other"],
        householdStudents,
      ),
      true,
    );
    assert.equal(
      isPrivateConnectedToHousehold(["student-other"], householdStudents),
      false,
    );
  });
});
