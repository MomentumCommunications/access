export type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped";

export type EnrollmentDateInput = {
  status: EnrollmentStatus;
  startDate?: string;
  endDate?: string;
};

export function isValidIsoDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export function validateEnrollmentDates({
  status,
  startDate,
  endDate,
}: EnrollmentDateInput) {
  if (!isValidIsoDate(startDate)) {
    throw new Error("Enrollment start date must be a valid YYYY-MM-DD date.");
  }
  if (endDate !== undefined && !isValidIsoDate(endDate)) {
    throw new Error("Enrollment end date must be a valid YYYY-MM-DD date.");
  }
  if (status === "dropped" && endDate === undefined) {
    throw new Error("Dropped enrollments must have an end date.");
  }
  if (endDate !== undefined && startDate > endDate) {
    throw new Error("Enrollment start date must be on or before end date.");
  }
}
