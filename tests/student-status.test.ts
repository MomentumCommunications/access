import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requiresStudentStatusConfirmation,
  studentEnrollmentCleanup,
} from "../shared/student-status.ts";

describe("student status policy", () => {
  it("requires confirmation only when moving to inactive or archived", () => {
    assert.equal(
      requiresStudentStatusConfirmation("active", "inactive"),
      true,
    );
    assert.equal(
      requiresStudentStatusConfirmation("active", "archived"),
      true,
    );
    assert.equal(
      requiresStudentStatusConfirmation("inactive", "active"),
      false,
    );
    assert.equal(
      requiresStudentStatusConfirmation("inactive", "inactive"),
      false,
    );
  });

  it("drops enrolled rows today and keeps their valid historical start", () => {
    assert.deepEqual(
      studentEnrollmentCleanup(
        { status: "enrolled", startDate: "2026-05-01" },
        "2026-06-12",
      ),
      {
        action: "drop",
        startDate: "2026-05-01",
        endDate: "2026-06-12",
      },
    );
  });

  it("normalizes future or missing starts when dropping today", () => {
    assert.deepEqual(
      studentEnrollmentCleanup(
        { status: "enrolled", startDate: "2026-07-01" },
        "2026-06-12",
      ),
      {
        action: "drop",
        startDate: "2026-06-12",
        endDate: "2026-06-12",
      },
    );
    assert.deepEqual(
      studentEnrollmentCleanup({ status: "enrolled" }, "2026-06-12"),
      {
        action: "drop",
        startDate: "2026-06-12",
        endDate: "2026-06-12",
      },
    );
  });

  it("deletes requests and preserves dropped history", () => {
    assert.deepEqual(
      studentEnrollmentCleanup({ status: "pending" }, "2026-06-12"),
      { action: "delete" },
    );
    assert.deepEqual(
      studentEnrollmentCleanup({ status: "waitlisted" }, "2026-06-12"),
      { action: "delete" },
    );
    assert.deepEqual(
      studentEnrollmentCleanup({ status: "dropped" }, "2026-06-12"),
      { action: "preserve" },
    );
  });
});
