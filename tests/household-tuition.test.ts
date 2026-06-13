import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateHouseholdTuitions,
  type HouseholdTuitionStudentInput,
} from "../convex/lib/billing/householdTuition.ts";

function student(
  overrides: Partial<HouseholdTuitionStudentInput> = {},
): HouseholdTuitionStudentInput {
  return {
    studentId: "student-1",
    studentName: "Alex Avery",
    householdId: "household-1",
    householdName: "Avery household",
    householdLinkSource: "household",
    baseTuitionCents: 10000,
    pricingSource: "Summer 2026 v1",
    ...overrides,
  };
}

describe("aggregateHouseholdTuitions", () => {
  const siblingDiscount = {
    enabled: true,
    percentOffBasisPoints: 1000,
    appliesTo: "all_but_highest" as const,
  };

  it("groups multiple students in one household and sums base tuition", () => {
    const [result] = aggregateHouseholdTuitions([
      student(),
      student({
        studentId: "student-2",
        studentName: "Blair Avery",
        baseTuitionCents: 12500,
      }),
    ]);

    assert.equal(result.students.length, 2);
    assert.equal(result.subtotalBaseTuitionCents, 22500);
    assert.equal(result.totalTuitionCents, 22500);
    assert.equal(result.siblingDiscountCandidate, true);
  });

  it("keeps different households separate", () => {
    const results = aggregateHouseholdTuitions([
      student(),
      student({
        studentId: "student-2",
        studentName: "Bailey Brooks",
        householdId: "household-2",
        householdName: "Brooks household",
      }),
    ]);

    assert.deepEqual(
      results.map((result) => result.householdId),
      ["household-1", "household-2"],
    );
  });

  it("orders households and students deterministically", () => {
    const inputs = [
      student({
        studentId: "student-3",
        studentName: "Casey Avery",
      }),
      student({
        studentId: "student-2",
        studentName: "Bailey Brooks",
        householdId: "household-2",
        householdName: "Brooks household",
      }),
      student(),
    ];

    const forward = aggregateHouseholdTuitions(inputs);
    const reverse = aggregateHouseholdTuitions([...inputs].reverse());

    assert.deepEqual(forward, reverse);
    assert.deepEqual(
      forward[0].students.map((item) => item.studentName),
      ["Alex Avery", "Casey Avery"],
    );
  });

  it("keeps future adjustment hooks stable and empty", () => {
    const [result] = aggregateHouseholdTuitions([student()]);

    assert.deepEqual(result.scholarshipCandidates, []);
    assert.deepEqual(result.packageCandidates, []);
    assert.deepEqual(result.adjustments, []);
    assert.equal(result.siblingDiscountCandidate, false);
    assert.equal(result.hasIncompleteTuition, false);
  });

  it("does not count an unpriced student as tuition-bearing", () => {
    const [result] = aggregateHouseholdTuitions([
      student(),
      student({
        studentId: "student-2",
        studentName: "Blair Avery",
        baseTuitionCents: undefined,
        warning: "Missing pricing tier",
      }),
    ]);

    assert.equal(result.subtotalBaseTuitionCents, 10000);
    assert.equal(result.siblingDiscountCandidate, false);
    assert.equal(result.hasIncompleteTuition, true);
  });

  it("creates a deterministic standalone bucket when household linkage is missing", () => {
    const [result] = aggregateHouseholdTuitions([
      student({
        householdId: undefined,
        householdName: undefined,
        householdLinkSource: undefined,
      }),
    ]);

    assert.equal(result.householdId, "student:student-1");
    assert.equal(result.householdName, "Alex Avery (unlinked)");
    assert.equal(result.householdLinkSource, "student_fallback");
  });

  it("keeps one tuition-bearing student at full price", () => {
    const [result] = aggregateHouseholdTuitions(
      [student()],
      siblingDiscount,
    );

    assert.deepEqual(result.adjustments, []);
    assert.equal(result.totalTuitionCents, 10000);
  });

  it("discounts all but the largest tuition-bearing student", () => {
    const [result] = aggregateHouseholdTuitions(
      [
        student({ baseTuitionCents: 12000 }),
        student({
          studentId: "student-2",
          studentName: "Blair Avery",
          baseTuitionCents: 10000,
        }),
        student({
          studentId: "student-3",
          studentName: "Casey Avery",
          baseTuitionCents: 8000,
        }),
      ],
      siblingDiscount,
    );

    assert.deepEqual(
      result.adjustments.map(({ studentId, amountCents }) => ({
        studentId,
        amountCents,
      })),
      [
        { studentId: "student-2", amountCents: -1000 },
        { studentId: "student-3", amountCents: -800 },
      ],
    );
    assert.equal(result.subtotalBaseTuitionCents, 30000);
    assert.equal(result.totalTuitionCents, 28200);
  });

  it("breaks equal-tuition ties deterministically and ignores zero tuition", () => {
    const inputs = [
      student({
        studentId: "student-b",
        studentName: "Bailey Avery",
      }),
      student({
        studentId: "student-a",
        studentName: "Alex Avery",
      }),
      student({
        studentId: "student-zero",
        studentName: "Zero Avery",
        baseTuitionCents: 0,
      }),
    ];
    const forward = aggregateHouseholdTuitions(inputs, siblingDiscount);
    const reverse = aggregateHouseholdTuitions(
      [...inputs].reverse(),
      siblingDiscount,
    );

    assert.deepEqual(forward, reverse);
    assert.deepEqual(
      forward[0].adjustments.map((adjustment) => adjustment.studentId),
      ["student-b"],
    );
    assert.equal(forward[0].totalTuitionCents, 19000);
  });

  it("does not apply sibling adjustments when disabled", () => {
    const [result] = aggregateHouseholdTuitions(
      [
        student(),
        student({
          studentId: "student-2",
          studentName: "Blair Avery",
        }),
      ],
      { ...siblingDiscount, enabled: false },
    );

    assert.deepEqual(result.adjustments, []);
    assert.equal(result.totalTuitionCents, 20000);
  });

  it("rounds each sibling adjustment to the nearest cent", () => {
    const [result] = aggregateHouseholdTuitions(
      [
        student({ baseTuitionCents: 10001 }),
        student({
          studentId: "student-2",
          studentName: "Blair Avery",
          baseTuitionCents: 9999,
        }),
      ],
      {
        enabled: true,
        percentOffBasisPoints: 1250,
        appliesTo: "all_but_highest",
      },
    );

    assert.equal(result.adjustments[0].amountCents, -1250);
    assert.equal(result.totalTuitionCents, 18750);
  });
});
