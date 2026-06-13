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
});
