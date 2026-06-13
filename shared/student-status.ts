export type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped";

export type StudentStatus = "active" | "inactive" | "archived";

export type StudentStatusEnrollment = {
  status: EnrollmentStatus;
  startDate?: string;
};

export type StudentEnrollmentCleanup =
  | { action: "preserve" }
  | { action: "delete" }
  | {
      action: "drop";
      startDate: string;
      endDate: string;
    };

export function requiresStudentStatusConfirmation(
  currentStatus: StudentStatus,
  nextStatus: StudentStatus,
) {
  return (
    currentStatus !== nextStatus &&
    (nextStatus === "inactive" || nextStatus === "archived")
  );
}

export function studentEnrollmentCleanup(
  enrollment: StudentStatusEnrollment,
  today: string,
): StudentEnrollmentCleanup {
  if (
    enrollment.status === "pending" ||
    enrollment.status === "waitlisted"
  ) {
    return { action: "delete" };
  }
  if (enrollment.status === "dropped") {
    return { action: "preserve" };
  }
  return {
    action: "drop",
    startDate:
      enrollment.startDate && enrollment.startDate <= today
        ? enrollment.startDate
        : today,
    endDate: today,
  };
}
