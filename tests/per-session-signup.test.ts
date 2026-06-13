import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertClassModeChangeAllowed,
  calculatePerSessionChargeCandidates,
  isAttendanceExpectedForSession,
  occupiesSessionCapacity,
  planSessionSignupSync,
  resolvedClassEnrollmentMode,
  validateClassEnrollmentConfig,
  type PerSessionChargeInput,
} from "../shared/per-session-signup.ts";

function charge(
  overrides: Partial<PerSessionChargeInput> = {},
): PerSessionChargeInput {
  return {
    signupId: "signup-1",
    studentId: "student-1",
    studentStatus: "active",
    classId: "class-1",
    classMode: "per_session",
    sessionId: "session-1",
    sessionDate: "2026-07-10",
    sessionActive: true,
    sessionStatus: "scheduled",
    signupStatus: "enrolled",
    unitPriceCents: 5500,
    ...overrides,
  };
}

describe("per-session class configuration", () => {
  it("keeps legacy classes in standard enrollment mode", () => {
    assert.equal(resolvedClassEnrollmentMode(undefined), "standard");
  });

  it("requires and preserves a class-level per-session price", () => {
    assert.doesNotThrow(() =>
      validateClassEnrollmentConfig("per_session", 5500),
    );
    assert.throws(
      () => validateClassEnrollmentConfig("per_session", undefined),
      /require a valid/,
    );
    assert.throws(
      () => validateClassEnrollmentConfig("standard", 5500),
      /only be set/,
    );
  });

  it("blocks mode changes that would contradict active records", () => {
    assert.throws(
      () =>
        assertClassModeChangeAllowed({
          currentMode: "standard",
          nextMode: "per_session",
          hasActiveClassEnrollments: true,
          hasActiveSessionSignups: false,
        }),
      /active class enrollments/,
    );
    assert.throws(
      () =>
        assertClassModeChangeAllowed({
          currentMode: "per_session",
          nextMode: "standard",
          hasActiveClassEnrollments: false,
          hasActiveSessionSignups: true,
        }),
      /active session signups/,
    );
  });
});

describe("per-session participation and charges", () => {
  it("keeps standard attendance based on broad enrollment", () => {
    assert.equal(
      isAttendanceExpectedForSession({
        classMode: "standard",
        hasStandardEnrollment: true,
      }),
      true,
    );
  });

  it("expects attendance only for selected per-session signups", () => {
    assert.equal(
      isAttendanceExpectedForSession({
        classMode: "per_session",
        hasStandardEnrollment: true,
      }),
      false,
    );
    assert.equal(
      isAttendanceExpectedForSession({
        classMode: "per_session",
        hasStandardEnrollment: false,
        sessionSignupStatus: "enrolled",
      }),
      true,
    );
    assert.equal(
      isAttendanceExpectedForSession({
        classMode: "per_session",
        hasStandardEnrollment: false,
        sessionSignupStatus: "cancelled",
      }),
      false,
    );
  });

  it("counts pending and enrolled signups toward session capacity", () => {
    assert.equal(occupiesSessionCapacity("pending"), true);
    assert.equal(occupiesSessionCapacity("enrolled"), true);
    assert.equal(occupiesSessionCapacity("waitlisted"), false);
    assert.equal(occupiesSessionCapacity("cancelled"), false);
  });

  it("returns only enrolled selected-session charge candidates", () => {
    assert.deepEqual(
      calculatePerSessionChargeCandidates(
        [
          charge(),
          charge({
            signupId: "pending",
            signupStatus: "pending",
          }),
          charge({
            signupId: "unselected",
            sessionId: "session-2",
            sessionDate: "2026-07-11",
            signupStatus: "cancelled",
          }),
          charge({
            signupId: "standard",
            classMode: "standard",
          }),
          charge({
            signupId: "inactive-student",
            studentStatus: "inactive",
          }),
        ],
        "2026-07-01",
        "2026-07-31",
      ).map((row) => row.signupId),
      ["signup-1"],
    );
  });

  it("orders selected-session charges deterministically", () => {
    const rows = [
      charge({
        signupId: "signup-b",
        studentId: "student-b",
        sessionDate: "2026-07-11",
      }),
      charge({
        signupId: "signup-a",
        studentId: "student-a",
      }),
    ];

    assert.deepEqual(
      calculatePerSessionChargeCandidates(
        rows,
        "2026-07-01",
        "2026-07-31",
      ),
      calculatePerSessionChargeCandidates(
        [...rows].reverse(),
        "2026-07-01",
        "2026-07-31",
      ),
    );
  });

  it("persists selected sessions and cancels removed pending choices", () => {
    assert.deepEqual(
      planSessionSignupSync(
        [
          {
            signupId: "signup-1",
            sessionId: "session-1",
            status: "pending",
          },
          {
            signupId: "signup-2",
            sessionId: "session-2",
            status: "pending",
          },
        ],
        ["session-2", "session-3"],
        "pending",
        true,
      ),
      [
        { action: "cancel", signupId: "signup-1" },
        {
          action: "update",
          signupId: "signup-2",
          status: "pending",
        },
        {
          action: "create",
          sessionId: "session-3",
          status: "pending",
        },
      ],
    );
  });

  it("does not let a customer selection downgrade or remove confirmed dates", () => {
    assert.deepEqual(
      planSessionSignupSync(
        [
          {
            signupId: "confirmed",
            sessionId: "session-1",
            status: "enrolled",
          },
        ],
        [],
        "pending",
        true,
      ),
      [{ action: "preserve", signupId: "confirmed" }],
    );
  });
});
