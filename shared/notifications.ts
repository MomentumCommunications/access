export type NotificationEventInput = {
  type: string;
  title: string;
  body: string;
  href: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export function newUserNotification({
  userId,
  name,
  email,
}: {
  userId: string;
  name?: string;
  email?: string;
}): NotificationEventInput {
  const identity = name?.trim() || email?.trim() || "A new user";
  return {
    type: "user.registered",
    title: "New user registered",
    body: `${identity} created an Access account.`,
    href: `/admin/accounts/${userId}`,
    actorUserId: userId,
    entityType: "user",
    entityId: userId,
    metadata: { email },
  };
}

export function pendingEnrollmentNotification({
  enrollmentId,
  requestedBy,
  studentName,
  className,
  classId,
  studentId,
}: {
  enrollmentId: string;
  requestedBy?: string;
  studentName: string;
  className: string;
  classId: string;
  studentId: string;
}): NotificationEventInput {
  return {
    type: "enrollment.pending",
    title: "New pending enrollment",
    body: `${studentName} requested ${className}.`,
    href: "/admin/classes/enrollments",
    actorUserId: requestedBy,
    entityType: "classEnrollment",
    entityId: enrollmentId,
    metadata: { classId, studentId },
  };
}

export type EnrollmentOutcome = "enrolled" | "waitlisted" | "rejected";

export function enrollmentOutcomeNotification({
  enrollmentId,
  actorUserId,
  outcome,
  studentName,
  className,
  classId,
  studentId,
}: {
  enrollmentId: string;
  actorUserId?: string;
  outcome: EnrollmentOutcome;
  studentName: string;
  className: string;
  classId: string;
  studentId: string;
}): NotificationEventInput {
  const content: Record<
    EnrollmentOutcome,
    { title: string; body: string }
  > = {
    enrolled: {
      title: "Enrollment approved",
      body: `${studentName} is now enrolled in ${className}.`,
    },
    waitlisted: {
      title: "Enrollment waitlisted",
      body: `${studentName} was added to the waitlist for ${className}.`,
    },
    rejected: {
      title: "Enrollment request declined",
      body: `${studentName}'s enrollment request for ${className} was not approved.`,
    },
  };

  return {
    type: `enrollment.${outcome}`,
    ...content[outcome],
    href: `/students/${studentId}`,
    actorUserId,
    entityType: "classEnrollment",
    entityId: enrollmentId,
    metadata: { classId, studentId, outcome },
  };
}

export function notificationHasUnread(
  notifications: Array<{ readAt?: number }>,
) {
  return notifications.some((notification) => notification.readAt === undefined);
}

export function markNotificationRead<T extends { readAt?: number }>(
  notification: T,
  readAt: number,
): T & { readAt: number } {
  return notification.readAt === undefined
    ? { ...notification, readAt }
    : (notification as T & { readAt: number });
}

export function markAllNotificationsRead<T extends { readAt?: number }>(
  notifications: T[],
  readAt: number,
) {
  return notifications.map((notification) =>
    markNotificationRead(notification, readAt),
  );
}
