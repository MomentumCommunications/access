export type TuitionTreatmentEnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "declined";

export function canEditEnrollmentTuitionTreatment(
  status: TuitionTreatmentEnrollmentStatus,
) {
  return status === "enrolled" || status === "dropped";
}

export function enrollmentTuitionTreatmentPatch(
  prorateTuition: boolean,
  updatedAt: number,
) {
  return { prorateTuition, updatedAt };
}
