export type TrialRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type TrialReviewAction = "approve" | "reject";

export function assertSingleTrialSession(sessionIds: readonly string[]) {
  if (new Set(sessionIds).size !== 1) {
    throw new Error("Select exactly one trial session.");
  }
  return sessionIds[0];
}

export function trialRequestNextStatus(
  current: TrialRequestStatus,
  action: TrialReviewAction,
) {
  if (current !== "pending") {
    throw new Error("Only pending trial requests can be reviewed.");
  }
  return action === "approve" ? "approved" : "rejected";
}

export function isEligibleTrialSession({
  sessionClassId,
  requestedClassId,
  sessionDate,
  today,
  active,
  status,
}: {
  sessionClassId: string;
  requestedClassId: string;
  sessionDate: string;
  today: string;
  active: boolean;
  status: string;
}) {
  return (
    sessionClassId === requestedClassId &&
    active &&
    status !== "cancelled" &&
    sessionDate >= today
  );
}

export function validatePaidTrialPrice(unitPriceCents: number) {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Enter a positive trial price.");
  }
  return unitPriceCents;
}
