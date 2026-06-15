export type EnrollmentSelectionStatus =
  | "active"
  | "pending"
  | "waitlisted"
  | "selected"
  | "full"
  | "ineligible"
  | "managed"
  | "available";

export type ExistingEnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped";

export type ExistingSessionSignupStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "cancelled";

export type EnrollmentSelectionDraft = {
  recurringClassIds: string[];
  sessionIdsByClass: Record<string, string[]>;
};

export type EnrollmentReviewClass = {
  classId: string;
  title: string;
  mode: "standard" | "per_session";
  enrollmentStatus?: ExistingEnrollmentStatus;
  sessions: Array<{
    sessionId: string;
    label: string;
    signupStatus?: ExistingSessionSignupStatus;
  }>;
};

export type EnrollmentReview = {
  currentActive: Array<{ classId: string; title: string; detail?: string }>;
  currentPending: Array<{ classId: string; title: string; detail?: string }>;
  selectedRecurring: Array<{ classId: string; title: string }>;
  selectedPerSession: Array<{
    classId: string;
    title: string;
    sessions: Array<{ sessionId: string; label: string }>;
  }>;
  changeCount: number;
};

export const emptyEnrollmentSelectionDraft = (): EnrollmentSelectionDraft => ({
  recurringClassIds: [],
  sessionIdsByClass: {},
});

export function enrollmentReviewTriggerLabel(changeCount: number) {
  return changeCount === 0
    ? "Review classes"
    : `Review ${changeCount} ${
        changeCount === 1 ? "selection" : "selections"
      }`;
}

export function recurringClassSelectionStatus({
  enrollmentStatus,
  selected,
  full,
  ageEligible,
  canManage,
}: {
  enrollmentStatus?: ExistingEnrollmentStatus;
  selected: boolean;
  full: boolean;
  ageEligible: boolean;
  canManage: boolean;
}): EnrollmentSelectionStatus {
  if (enrollmentStatus === "enrolled") return "active";
  if (enrollmentStatus === "pending") return "pending";
  if (enrollmentStatus === "waitlisted") return "waitlisted";
  if (!canManage) return "managed";
  if (!ageEligible) return "ineligible";
  if (selected) return "selected";
  if (full) return "full";
  return "available";
}

export function sessionSelectionStatus({
  signupStatus,
  selected,
  full,
  ageEligible,
  canManage,
}: {
  signupStatus?: ExistingSessionSignupStatus;
  selected: boolean;
  full: boolean;
  ageEligible: boolean;
  canManage: boolean;
}): EnrollmentSelectionStatus {
  if (signupStatus === "enrolled") return "active";
  if (signupStatus === "pending") return "pending";
  if (signupStatus === "waitlisted") return "waitlisted";
  if (!canManage) return "managed";
  if (!ageEligible) return "ineligible";
  if (selected) return "selected";
  if (full) return "full";
  return "available";
}

export function toggleRecurringClassSelection(
  draft: EnrollmentSelectionDraft,
  classId: string,
) {
  const selected = new Set(draft.recurringClassIds);
  if (selected.has(classId)) {
    selected.delete(classId);
  } else {
    selected.add(classId);
  }
  return {
    ...draft,
    recurringClassIds: [...selected].sort(),
  };
}

export function toggleSessionSelection(
  draft: EnrollmentSelectionDraft,
  classId: string,
  sessionId: string,
) {
  const selected = new Set(draft.sessionIdsByClass[classId] || []);
  if (selected.has(sessionId)) {
    selected.delete(sessionId);
  } else {
    selected.add(sessionId);
  }
  const sessionIdsByClass = { ...draft.sessionIdsByClass };
  if (selected.size === 0) {
    delete sessionIdsByClass[classId];
  } else {
    sessionIdsByClass[classId] = [...selected].sort();
  }
  return { ...draft, sessionIdsByClass };
}

export function buildEnrollmentReview(
  classes: EnrollmentReviewClass[],
  draft: EnrollmentSelectionDraft,
): EnrollmentReview {
  const recurringSelections = new Set(draft.recurringClassIds);
  const currentActive: EnrollmentReview["currentActive"] = [];
  const currentPending: EnrollmentReview["currentPending"] = [];
  const selectedRecurring: EnrollmentReview["selectedRecurring"] = [];
  const selectedPerSession: EnrollmentReview["selectedPerSession"] = [];

  for (const row of classes) {
    if (row.mode === "standard") {
      if (row.enrollmentStatus === "enrolled") {
        currentActive.push({ classId: row.classId, title: row.title });
      } else if (
        row.enrollmentStatus === "pending" ||
        row.enrollmentStatus === "waitlisted"
      ) {
        currentPending.push({
          classId: row.classId,
          title: row.title,
          detail:
            row.enrollmentStatus === "waitlisted" ? "Waitlisted" : undefined,
        });
      }
      if (recurringSelections.has(row.classId)) {
        selectedRecurring.push({ classId: row.classId, title: row.title });
      }
      continue;
    }

    const activeCount = row.sessions.filter(
      (session) => session.signupStatus === "enrolled",
    ).length;
    const pendingCount = row.sessions.filter(
      (session) =>
        session.signupStatus === "pending" ||
        session.signupStatus === "waitlisted",
    ).length;
    if (activeCount > 0) {
      currentActive.push({
        classId: row.classId,
        title: row.title,
        detail: `${activeCount} confirmed ${
          activeCount === 1 ? "date" : "dates"
        }`,
      });
    }
    if (pendingCount > 0) {
      currentPending.push({
        classId: row.classId,
        title: row.title,
        detail: `${pendingCount} pending ${
          pendingCount === 1 ? "date" : "dates"
        }`,
      });
    }

    const selectedIds = new Set(draft.sessionIdsByClass[row.classId] || []);
    const selectedSessions = row.sessions
      .filter((session) => selectedIds.has(session.sessionId))
      .map((session) => ({
        sessionId: session.sessionId,
        label: session.label,
      }));
    if (selectedSessions.length > 0) {
      selectedPerSession.push({
        classId: row.classId,
        title: row.title,
        sessions: selectedSessions,
      });
    }
  }

  const byTitle = <T extends { title: string; classId: string }>(a: T, b: T) =>
    a.title.localeCompare(b.title) || a.classId.localeCompare(b.classId);
  currentActive.sort(byTitle);
  currentPending.sort(byTitle);
  selectedRecurring.sort(byTitle);
  selectedPerSession.sort(byTitle);

  return {
    currentActive,
    currentPending,
    selectedRecurring,
    selectedPerSession,
    changeCount:
      selectedRecurring.length +
      selectedPerSession.reduce(
        (total, row) => total + row.sessions.length,
        0,
      ),
  };
}
