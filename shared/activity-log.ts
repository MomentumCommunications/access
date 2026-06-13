export type SessionSelectionChange = {
  addedSessionIds: string[];
  removedSessionIds: string[];
  resultingSessionIds: string[];
};

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort();
}

export function getSessionSelectionChange(
  previousSessionIds: string[],
  nextSessionIds: string[],
): SessionSelectionChange | null {
  const previous = sortedUnique(previousSessionIds);
  const next = sortedUnique(nextSessionIds);
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  const addedSessionIds = next.filter((sessionId) => !previousSet.has(sessionId));
  const removedSessionIds = previous.filter(
    (sessionId) => !nextSet.has(sessionId),
  );

  if (addedSessionIds.length === 0 && removedSessionIds.length === 0) {
    return null;
  }

  return {
    addedSessionIds,
    removedSessionIds,
    resultingSessionIds: next,
  };
}

export function buildPerSessionSignupEvent({
  studentId,
  studentName,
  classId,
  className,
  actorId,
  change,
}: {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  actorId?: string;
  change: SessionSelectionChange;
}) {
  const changes = [
    change.addedSessionIds.length > 0
      ? `added ${change.addedSessionIds.length}`
      : null,
    change.removedSessionIds.length > 0
      ? `removed ${change.removedSessionIds.length}`
      : null,
  ].filter(Boolean);

  return {
    entityType: "student",
    entityId: studentId,
    actorId,
    eventType: "per_session_signup_updated",
    summary: `Updated ${studentName}'s ${className} session selections: ${changes.join(
      ", ",
    )}.`,
    metadata: {
      classId,
      addedSessionIds: change.addedSessionIds,
      removedSessionIds: change.removedSessionIds,
      resultingSessionIds: change.resultingSessionIds,
    },
  };
}
