export function buildEnrollmentDeletedEvent({
  enrollmentId,
  studentId,
  studentName,
  classId,
  className,
  requestedBy,
  actorId,
  startDate,
  endDate,
}: {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  requestedBy?: string;
  actorId: string;
  startDate?: string;
  endDate?: string;
}) {
  return {
    entityType: "student",
    entityId: studentId,
    actorId,
    eventType: "enrollment_deleted",
    summary: `Deleted ${studentName}'s pending enrollment request for ${className}.`,
    metadata: {
      enrollmentId,
      classId,
      requestedBy,
      status: "pending",
      startDate,
      endDate,
    },
  };
}

export function buildEnrollmentDeclinedEvent({
  enrollmentId,
  studentId,
  studentName,
  classId,
  className,
  requestedBy,
  actorId,
  startDate,
  endDate,
}: {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  requestedBy?: string;
  actorId: string;
  startDate?: string;
  endDate?: string;
}) {
  return {
    entityType: "student",
    entityId: studentId,
    actorId,
    eventType: "enrollment_declined",
    summary: `Declined ${studentName}'s pending enrollment request for ${className}.`,
    metadata: {
      enrollmentId,
      classId,
      requestedBy,
      status: "declined",
      previousStatus: "pending",
      startDate,
      endDate,
    },
  };
}
