export type TuitionEnrollmentSnapshot = {
  enrollmentId: string;
  studentId: string;
  classId: string;
  classTitle?: string;
  fingerprint: string;
};

export type BillingCoverageStatus =
  | "billed"
  | "partially_covered"
  | "not_billed"
  | "needs_review";

export type BillingAttributionQuality =
  | "exact"
  | "student_only"
  | "household_only";

type TuitionEnrollmentSnapshotInput = {
  enrollmentId?: string;
  studentId: string;
  classId?: string;
  classTitle?: string;
  enrollmentStatus: string;
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  prorateTuition?: boolean;
  classStatus: string;
  classStartDate?: string;
  classEndDate?: string;
  startTime?: string;
  endTime?: string;
  weekdays?: string[];
};

export function tuitionEnrollmentFingerprint(
  input: TuitionEnrollmentSnapshotInput,
) {
  return JSON.stringify([
    input.enrollmentStatus,
    input.enrollmentStartDate ?? null,
    input.enrollmentEndDate ?? null,
    input.prorateTuition !== false,
    input.classStatus,
    input.classStartDate ?? null,
    input.classEndDate ?? null,
    input.startTime ?? null,
    input.endTime ?? null,
    [...(input.weekdays ?? [])].sort(),
  ]);
}

export function buildTuitionEnrollmentSnapshot(
  input: TuitionEnrollmentSnapshotInput,
): TuitionEnrollmentSnapshot | null {
  if (!input.enrollmentId || !input.classId) return null;
  return {
    enrollmentId: input.enrollmentId,
    studentId: input.studentId,
    classId: input.classId,
    classTitle: input.classTitle,
    fingerprint: tuitionEnrollmentFingerprint(input),
  };
}

export function resolveBillingRunAuditAttribution({
  enrollmentSnapshots,
  tuitionStudentIds,
}: {
  enrollmentSnapshots?: TuitionEnrollmentSnapshot[];
  tuitionStudentIds?: string[];
}): {
  attributionQuality: BillingAttributionQuality;
  enrollmentSnapshots: TuitionEnrollmentSnapshot[];
  historicalStudentIds: string[];
} {
  if (enrollmentSnapshots?.length) {
    return {
      attributionQuality: "exact",
      enrollmentSnapshots,
      historicalStudentIds: [],
    };
  }
  const historicalStudentIds = [...new Set(tuitionStudentIds ?? [])].sort();
  return {
    attributionQuality:
      historicalStudentIds.length > 0 ? "student_only" : "household_only",
    enrollmentSnapshots: [],
    historicalStudentIds,
  };
}

export function billingRunItemHasTuitionCoverage(item: {
  includeTuition: boolean;
  sourceSummary: { tuitionStudentCount: number };
  sourceReferences: { tuitionHouseholdId?: string };
  tuitionEnrollmentSnapshots?: TuitionEnrollmentSnapshot[];
}) {
  return (
    item.includeTuition &&
    (item.sourceSummary.tuitionStudentCount > 0 ||
      item.sourceReferences.tuitionHouseholdId !== undefined ||
      (item.tuitionEnrollmentSnapshots?.length ?? 0) > 0)
  );
}

export function resolveBillingCoverageStatus({
  expected,
  covered,
  hasHistoricalCoverage,
}: {
  expected: TuitionEnrollmentSnapshot[];
  covered: TuitionEnrollmentSnapshot[];
  hasHistoricalCoverage: boolean;
}): BillingCoverageStatus {
  if (expected.length === 0) {
    if (hasHistoricalCoverage) return "needs_review";
    return covered.length > 0 ? "billed" : "not_billed";
  }
  const coveredByEnrollment = new Map<string, Set<string>>();
  for (const snapshot of covered) {
    const fingerprints =
      coveredByEnrollment.get(snapshot.enrollmentId) ?? new Set<string>();
    fingerprints.add(snapshot.fingerprint);
    coveredByEnrollment.set(snapshot.enrollmentId, fingerprints);
  }
  const matchingCount = expected.filter((snapshot) => {
    return coveredByEnrollment
      .get(snapshot.enrollmentId)
      ?.has(snapshot.fingerprint);
  }).length;
  const changed = expected.some((snapshot) => {
    const fingerprints = coveredByEnrollment.get(snapshot.enrollmentId);
    return fingerprints !== undefined && !fingerprints.has(snapshot.fingerprint);
  });

  if (changed || (hasHistoricalCoverage && matchingCount < expected.length)) {
    return "needs_review";
  }
  if (matchingCount === 0) return "not_billed";
  if (matchingCount < expected.length) return "partially_covered";
  return "billed";
}
