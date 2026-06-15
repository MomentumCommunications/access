export type ClassEnrollmentMode = "standard" | "per_session";

export type SessionSignupStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "cancelled";

export function resolvedClassEnrollmentMode(
  mode?: ClassEnrollmentMode,
): ClassEnrollmentMode {
  return mode || "standard";
}

export function validateClassEnrollmentConfig(
  mode: ClassEnrollmentMode,
  perSessionPriceCents?: number,
) {
  if (mode === "standard") {
    if (perSessionPriceCents !== undefined) {
      throw new Error(
        "Per-session pricing can only be set for per-session classes.",
      );
    }
    return;
  }

  if (
    perSessionPriceCents === undefined ||
    !Number.isSafeInteger(perSessionPriceCents) ||
    perSessionPriceCents < 0
  ) {
    throw new Error(
      "Per-session classes require a valid nonnegative session price.",
    );
  }
}

export function assertClassModeChangeAllowed({
  currentMode,
  nextMode,
  hasActiveClassEnrollments,
  hasActiveSessionSignups,
}: {
  currentMode: ClassEnrollmentMode;
  nextMode: ClassEnrollmentMode;
  hasActiveClassEnrollments: boolean;
  hasActiveSessionSignups: boolean;
}) {
  if (currentMode === nextMode) return;
  if (nextMode === "per_session" && hasActiveClassEnrollments) {
    throw new Error(
      "Drop or resolve active class enrollments before enabling per-session signup.",
    );
  }
  if (nextMode === "standard" && hasActiveSessionSignups) {
    throw new Error(
      "Cancel or resolve active session signups before returning to standard enrollment.",
    );
  }
}

export function isActiveSessionSignup(status: SessionSignupStatus) {
  return status !== "cancelled";
}

export function occupiesSessionCapacity(status: SessionSignupStatus) {
  return status === "pending" || status === "enrolled";
}

export function planSessionSignupSync(
  existing: Array<{
    signupId: string;
    sessionId: string;
    status: SessionSignupStatus;
  }>,
  selectedSessionIds: string[],
  nextStatus: SessionSignupStatus,
  preserveEnrolledSelections: boolean,
) {
  const selected = new Set(selectedSessionIds);
  const actions: Array<
    | { action: "create"; sessionId: string; status: SessionSignupStatus }
    | {
        action: "update";
        signupId: string;
        status: SessionSignupStatus;
      }
    | { action: "cancel"; signupId: string }
    | { action: "preserve"; signupId: string }
  > = [];

  for (const signup of existing) {
    if (selected.has(signup.sessionId)) {
      actions.push({
        action: "update",
        signupId: signup.signupId,
        status:
          preserveEnrolledSelections &&
          nextStatus === "pending" &&
          (signup.status === "enrolled" || signup.status === "waitlisted")
            ? signup.status
            : nextStatus,
      });
      selected.delete(signup.sessionId);
    } else if (
      preserveEnrolledSelections &&
      signup.status === "enrolled"
    ) {
      actions.push({ action: "preserve", signupId: signup.signupId });
    } else {
      actions.push({ action: "cancel", signupId: signup.signupId });
    }
  }

  for (const sessionId of [...selected].sort()) {
    actions.push({ action: "create", sessionId, status: nextStatus });
  }
  return actions;
}

export function isAttendanceExpectedForSession({
  classMode,
  hasStandardEnrollment,
  sessionSignupStatus,
}: {
  classMode: ClassEnrollmentMode;
  hasStandardEnrollment: boolean;
  sessionSignupStatus?: SessionSignupStatus;
}) {
  return classMode === "per_session"
    ? sessionSignupStatus === "pending" ||
        sessionSignupStatus === "enrolled"
    : hasStandardEnrollment;
}

export type PerSessionChargeInput = {
  signupId: string;
  studentId: string;
  studentStatus: string;
  classId: string;
  classMode: ClassEnrollmentMode;
  sessionId: string;
  sessionDate: string;
  sessionActive: boolean;
  sessionStatus: string;
  signupStatus: SessionSignupStatus;
  unitPriceCents: number;
};

export function calculatePerSessionChargeCandidates(
  rows: PerSessionChargeInput[],
  periodStart: string,
  periodEnd: string,
) {
  return rows
    .filter(
      (row) =>
        row.classMode === "per_session" &&
        row.studentStatus === "active" &&
        row.signupStatus === "enrolled" &&
        row.sessionActive &&
        row.sessionStatus !== "cancelled" &&
        row.sessionDate >= periodStart &&
        row.sessionDate <= periodEnd,
    )
    .sort(
      (left, right) =>
        left.sessionDate.localeCompare(right.sessionDate) ||
        left.studentId.localeCompare(right.studentId) ||
        left.signupId.localeCompare(right.signupId),
    );
}
