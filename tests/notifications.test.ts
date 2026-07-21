import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrollmentOutcomeNotification,
  incompleteAttendanceNotification,
  markAllNotificationsRead,
  markNotificationRead,
  newUserNotification,
  notificationHasUnread,
  pendingEnrollmentNotification,
  pendingTrialNotification,
  trialOutcomeNotification,
} from "../shared/notifications.ts";

describe("notification event generation", () => {
  it("builds a new-user notification with an admin account destination", () => {
    assert.deepEqual(
      newUserNotification({
        userId: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
      {
        type: "user.registered",
        title: "New user registered",
        body: "Ada Lovelace created an Access account.",
        href: "/admin/accounts/user-1",
        actorUserId: "user-1",
        entityType: "user",
        entityId: "user-1",
        metadata: { email: "ada@example.com" },
      },
    );
  });

  it("builds a pending-enrollment notification with review metadata", () => {
    assert.deepEqual(
      pendingEnrollmentNotification({
        enrollmentId: "enrollment-1",
        requestedBy: "user-1",
        studentName: "Grace Hopper",
        className: "Jazz I",
        classId: "class-1",
        studentId: "student-1",
      }),
      {
        type: "enrollment.pending",
        title: "New pending enrollment",
        body: "Grace Hopper requested Jazz I.",
        href: "/admin/classes/enrollments",
        actorUserId: "user-1",
        entityType: "classEnrollment",
        entityId: "enrollment-1",
        metadata: {
          classId: "class-1",
          studentId: "student-1",
        },
      },
    );
  });

  it("builds member enrollment outcome notifications", () => {
    const input = {
      enrollmentId: "enrollment-1",
      actorUserId: "admin-1",
      studentName: "Grace Hopper",
      className: "Jazz I",
      classId: "class-1",
      studentId: "student-1",
    };

    assert.deepEqual(
      enrollmentOutcomeNotification({ ...input, outcome: "enrolled" }),
      {
        type: "enrollment.enrolled",
        title: "Enrollment approved",
        body: "Grace Hopper is now enrolled in Jazz I.",
        href: "/students/student-1",
        actorUserId: "admin-1",
        entityType: "classEnrollment",
        entityId: "enrollment-1",
        metadata: {
          classId: "class-1",
          studentId: "student-1",
          outcome: "enrolled",
        },
      },
    );
    assert.equal(
      enrollmentOutcomeNotification({ ...input, outcome: "waitlisted" }).body,
      "Grace Hopper was added to the waitlist for Jazz I.",
    );
    assert.equal(
      enrollmentOutcomeNotification({ ...input, outcome: "rejected" }).body,
      "Grace Hopper's enrollment request for Jazz I was not approved.",
    );
  });

  it("builds incomplete attendance notifications with dedupe metadata", () => {
    assert.deepEqual(
      incompleteAttendanceNotification({
        sessionId: "session-1",
        classId: "class-1",
        className: "Jazz I",
        sessionDate: "2026-06-29",
        attendanceCount: 4,
        enrollmentCount: 5,
      }),
      {
        type: "attendance.incomplete",
        title: "Attendance incomplete",
        body: "Jazz I still needs attendance for 2026-06-29.",
        href: "/staff/attendance/session-1",
        dedupeKey: "attendance.incomplete:session-1",
        entityType: "session",
        entityId: "session-1",
        metadata: {
          sessionId: "session-1",
          classId: "class-1",
          attendanceCount: 4,
          enrollmentCount: 5,
        },
      },
    );
  });

  it("builds paid trial request and approval notifications", () => {
    assert.deepEqual(
      pendingTrialNotification({
        trialRequestId: "trial-1",
        requestedBy: "user-1",
        studentName: "Grace Hopper",
        className: "Jazz I",
        sessionDate: "2026-08-10",
      }),
      {
        type: "trial.pending",
        title: "New paid trial request",
        body: "Grace Hopper requested a trial for Jazz I on 2026-08-10.",
        href: "/admin/classes/trials",
        actorUserId: "user-1",
        entityType: "trialRequest",
        entityId: "trial-1",
        metadata: { className: "Jazz I", sessionDate: "2026-08-10" },
      },
    );
    assert.equal(
      trialOutcomeNotification({
        trialRequestId: "trial-1",
        actorUserId: "admin-1",
        outcome: "approved",
        studentName: "Grace Hopper",
        className: "Jazz I",
        sessionDate: "2026-08-10",
      }).title,
      "Paid trial approved",
    );
  });
});

describe("notification read semantics", () => {
  it("reports unread state without changing notifications on view", () => {
    const notifications = [{ id: "one" }, { id: "two", readAt: 10 }];
    assert.equal(notificationHasUnread(notifications), true);
    assert.deepEqual(notifications, [
      { id: "one" },
      { id: "two", readAt: 10 },
    ]);
  });

  it("marks one notification as read", () => {
    assert.deepEqual(markNotificationRead({ id: "one" }, 20), {
      id: "one",
      readAt: 20,
    });
  });

  it("marks every current notification as read without replacing timestamps", () => {
    assert.deepEqual(
      markAllNotificationsRead(
        [{ id: "one" }, { id: "two", readAt: 10 }],
        20,
      ),
      [
        { id: "one", readAt: 20 },
        { id: "two", readAt: 10 },
      ],
    );
  });
});
