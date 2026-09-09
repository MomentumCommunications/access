import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingRunItemHasTuitionCoverage,
  buildTuitionEnrollmentSnapshot,
  resolveBillingCoverageStatus,
  resolveBillingRunAuditAttribution,
  tuitionEnrollmentFingerprint,
  type TuitionEnrollmentSnapshot,
} from "../shared/billing-audit.ts";

function snapshot(
  enrollmentId: string,
  fingerprint = `fingerprint-${enrollmentId}`,
): TuitionEnrollmentSnapshot {
  return {
    enrollmentId,
    studentId: `student-${enrollmentId}`,
    classId: `class-${enrollmentId}`,
    fingerprint,
  };
}

describe("tuition enrollment audit snapshots", () => {
  const input = {
    enrollmentId: "enrollment-1",
    studentId: "student-1",
    classId: "class-1",
    classTitle: "Ballet",
    enrollmentStatus: "enrolled",
    enrollmentStartDate: "2026-09-01",
    prorateTuition: false,
    classStatus: "published",
    classStartDate: "2026-08-01",
    startTime: "16:00",
    endTime: "17:00",
    weekdays: ["wednesday", "monday"],
  };

  it("builds deterministic snapshots without depending on weekday order", () => {
    const built = buildTuitionEnrollmentSnapshot(input);
    assert.ok(built);
    assert.equal(
      built.fingerprint,
      tuitionEnrollmentFingerprint({
        ...input,
        weekdays: [...input.weekdays].reverse(),
      }),
    );
  });

  it("changes the fingerprint when billing-relevant enrollment data changes", () => {
    assert.notEqual(
      tuitionEnrollmentFingerprint(input),
      tuitionEnrollmentFingerprint({ ...input, prorateTuition: true }),
    );
  });

  it("treats legacy missing tuition treatment as effectively prorated", () => {
    assert.equal(
      tuitionEnrollmentFingerprint({ ...input, prorateTuition: undefined }),
      tuitionEnrollmentFingerprint({ ...input, prorateTuition: true }),
    );
  });
});

describe("billing coverage resolution", () => {
  it("distinguishes billed, partial, and unbilled exact coverage", () => {
    const expected = [snapshot("a"), snapshot("b")];
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: expected,
        hasHistoricalCoverage: false,
      }),
      "billed",
    );
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: [expected[0]],
        hasHistoricalCoverage: false,
      }),
      "partially_covered",
    );
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: [],
        hasHistoricalCoverage: false,
      }),
      "not_billed",
    );
  });

  it("requires review for changed snapshots or qualified historical coverage", () => {
    const expected = [snapshot("a")];
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: [snapshot("a", "changed")],
        hasHistoricalCoverage: false,
      }),
      "needs_review",
    );
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: [],
        hasHistoricalCoverage: true,
      }),
      "needs_review",
    );
  });

  it("accepts a matching correction even when an older fingerprint remains", () => {
    const expected = [snapshot("a", "current")];
    assert.equal(
      resolveBillingCoverageStatus({
        expected,
        covered: [snapshot("a", "current"), snapshot("a", "old")],
        hasHistoricalCoverage: false,
      }),
      "billed",
    );
  });

  it("keeps historical household coverage qualified when obligations cannot be reconstructed", () => {
    assert.equal(
      resolveBillingCoverageStatus({
        expected: [],
        covered: [],
        hasHistoricalCoverage: true,
      }),
      "needs_review",
    );
  });
});

describe("historical billing attribution", () => {
  it("uses exact snapshots when modern run items provide them", () => {
    const enrollmentSnapshots = [snapshot("a")];
    assert.deepEqual(
      resolveBillingRunAuditAttribution({
        enrollmentSnapshots,
        tuitionStudentIds: ["student-legacy"],
      }),
      {
        attributionQuality: "exact",
        enrollmentSnapshots,
        historicalStudentIds: [],
      },
    );
  });

  it("falls back to unique student IDs and then the household", () => {
    assert.deepEqual(
      resolveBillingRunAuditAttribution({
        tuitionStudentIds: ["student-b", "student-a", "student-b"],
      }),
      {
        attributionQuality: "student_only",
        enrollmentSnapshots: [],
        historicalStudentIds: ["student-a", "student-b"],
      },
    );
    assert.deepEqual(resolveBillingRunAuditAttribution({}), {
      attributionQuality: "household_only",
      enrollmentSnapshots: [],
      historicalStudentIds: [],
    });
  });
});

describe("billing run tuition audit eligibility", () => {
  it("does not audit charge-only households from a combined run", () => {
    assert.equal(
      billingRunItemHasTuitionCoverage({
        includeTuition: true,
        sourceSummary: { tuitionStudentCount: 0 },
        sourceReferences: {},
        tuitionEnrollmentSnapshots: [],
      }),
      false,
    );
  });

  it("keeps real tuition sources eligible even when adjustments reduce tuition to zero", () => {
    assert.equal(
      billingRunItemHasTuitionCoverage({
        includeTuition: true,
        sourceSummary: { tuitionStudentCount: 1 },
        sourceReferences: { tuitionHouseholdId: "household-1" },
        tuitionEnrollmentSnapshots: [],
      }),
      true,
    );
  });
});
