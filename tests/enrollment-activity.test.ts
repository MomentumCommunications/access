import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEnrollmentDeletedEvent } from "../shared/enrollment-activity.ts";

describe("enrollment activity", () => {
  it("preserves the deleted pending enrollment context", () => {
    assert.deepEqual(
      buildEnrollmentDeletedEvent({
        enrollmentId: "enrollment-1",
        studentId: "student-1",
        studentName: "Alex Example",
        classId: "class-1",
        className: "Ballet",
        requestedBy: "requester-1",
        actorId: "admin-1",
        startDate: "2026-07-01",
      }),
      {
        entityType: "student",
        entityId: "student-1",
        actorId: "admin-1",
        eventType: "enrollment_deleted",
        summary:
          "Deleted Alex Example's pending enrollment request for Ballet.",
        metadata: {
          enrollmentId: "enrollment-1",
          classId: "class-1",
          requestedBy: "requester-1",
          status: "pending",
          startDate: "2026-07-01",
          endDate: undefined,
        },
      },
    );
  });
});
