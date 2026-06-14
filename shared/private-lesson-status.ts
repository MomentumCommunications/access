export type PrivateLessonStatus = "scheduled" | "completed" | "cancelled";

export type PrivateParticipantTransition =
  | "mark_attended_billable"
  | "mark_cancelled"
  | "reset_scheduled"
  | "preserve";

export function privateParticipantTransition(
  previousStatus: PrivateLessonStatus,
  nextStatus: PrivateLessonStatus,
): PrivateParticipantTransition {
  if (previousStatus === nextStatus) return "preserve";
  if (nextStatus === "completed") return "mark_attended_billable";
  if (nextStatus === "cancelled") return "mark_cancelled";
  return "reset_scheduled";
}

export function privateParticipantPatch(
  transition: PrivateParticipantTransition,
  snapshot?: {
    appliedPrivateRateId: string;
    appliedPriceCents: number;
  } | null,
) {
  if (transition === "mark_attended_billable") {
    return {
      status: "attended" as const,
      billable: true,
      appliedPrivateRateId: snapshot?.appliedPrivateRateId,
      appliedPriceCents: snapshot?.appliedPriceCents,
    };
  }
  if (transition === "mark_cancelled") {
    return {
      status: "cancelled" as const,
      billable: false,
      appliedPrivateRateId: undefined,
      appliedPriceCents: undefined,
    };
  }
  if (transition === "reset_scheduled") {
    return {
      status: "scheduled" as const,
      billable: false,
      appliedPrivateRateId: undefined,
      appliedPriceCents: undefined,
    };
  }
  return null;
}
