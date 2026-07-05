import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEnrollmentReportsDashboard,
  enrollmentOverlapsRange,
  type EnrollmentReportRow,
} from "../shared/admin-reports.ts";

function ts(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getTime();
}

function row(overrides: Partial<EnrollmentReportRow> = {}): EnrollmentReportRow {
  return {
    enrollmentId: "enrollment-1",
    classId: "class-1",
    classTitle: "Ballet",
    classStatus: "published",
    studentId: "student-1",
    status: "enrolled",
    startDate: "2026-01-01",
    endDate: undefined,
    createdAt: ts("2026-01-01"),
    ...overrides,
  };
}

describe("admin enrollment reports", () => {
  it("counts enrollments that overlap month boundaries inclusively", () => {
    assert.equal(
      enrollmentOverlapsRange(
        row({ startDate: "2026-06-30", endDate: "2026-07-10" }),
        "2026-06-01",
        "2026-06-30",
      ),
      true,
    );
    assert.equal(
      enrollmentOverlapsRange(
        row({ startDate: "2026-05-10", endDate: "2026-06-01" }),
        "2026-06-01",
        "2026-06-30",
      ),
      true,
    );
    assert.equal(
      enrollmentOverlapsRange(
        row({ startDate: "2026-07-01", endDate: "2026-07-31" }),
        "2026-06-01",
        "2026-06-30",
      ),
      false,
    );
  });

  it("deduplicates active students per month", () => {
    const report = buildEnrollmentReportsDashboard(
      [
        row({ enrollmentId: "a", classId: "class-1", studentId: "student-1" }),
        row({ enrollmentId: "b", classId: "class-2", studentId: "student-1" }),
        row({ enrollmentId: "c", classId: "class-3", studentId: "student-2" }),
      ],
      { now: new Date("2026-06-15T12:00:00.000Z"), monthCount: 1 },
    );

    assert.deepEqual(report.months[0], {
      month: "2026-06",
      label: "Jun 2026",
      activeEnrollments: 3,
      activeStudents: 2,
      requests: 0,
    });
  });

  it("counts requests by creation month", () => {
    const report = buildEnrollmentReportsDashboard(
      [
        row({ enrollmentId: "a", createdAt: ts("2026-05-31") }),
        row({ enrollmentId: "b", createdAt: ts("2026-06-01") }),
        row({ enrollmentId: "c", createdAt: ts("2026-06-15") }),
      ],
      { now: new Date("2026-06-15T12:00:00.000Z"), monthCount: 2 },
    );

    assert.deepEqual(
      report.months.map(({ month, requests }) => ({ month, requests })),
      [
        { month: "2026-05", requests: 1 },
        { month: "2026-06", requests: 2 },
      ],
    );
  });

  it("includes declined rows in the current status mix", () => {
    const report = buildEnrollmentReportsDashboard(
      [
        row({ enrollmentId: "a", status: "declined" }),
        row({ enrollmentId: "b", status: "declined" }),
        row({ enrollmentId: "c", status: "pending" }),
      ],
      { now: new Date("2026-06-15T12:00:00.000Z"), monthCount: 1 },
    );

    assert.equal(
      report.statusCounts.find((status) => status.status === "declined")
        ?.count,
      2,
    );
  });

  it("calculates current active enrollments with present-time overlap", () => {
    const report = buildEnrollmentReportsDashboard(
      [
        row({ enrollmentId: "active", studentId: "student-1" }),
        row({
          enrollmentId: "future",
          studentId: "student-2",
          startDate: "2026-07-01",
        }),
        row({
          enrollmentId: "ended",
          studentId: "student-3",
          endDate: "2026-06-14",
        }),
        row({
          enrollmentId: "waitlisted",
          studentId: "student-4",
          status: "waitlisted",
        }),
      ],
      { now: new Date("2026-06-15T12:00:00.000Z"), monthCount: 1 },
    );

    assert.equal(report.kpis.currentActiveEnrollments, 1);
    assert.equal(report.kpis.currentActiveStudents, 1);
    assert.deepEqual(report.topClassesByActiveEnrollments, [
      { classId: "class-1", classTitle: "Ballet", count: 1 },
    ]);
  });

  it("ranks current waitlist pressure by class", () => {
    const report = buildEnrollmentReportsDashboard(
      [
        row({
          enrollmentId: "a",
          classId: "class-1",
          classTitle: "Ballet",
          status: "waitlisted",
        }),
        row({
          enrollmentId: "b",
          classId: "class-2",
          classTitle: "Jazz",
          status: "waitlisted",
        }),
        row({
          enrollmentId: "c",
          classId: "class-2",
          classTitle: "Jazz",
          status: "waitlisted",
        }),
      ],
      { now: new Date("2026-06-15T12:00:00.000Z"), monthCount: 1 },
    );

    assert.deepEqual(report.topClassesByWaitlist, [
      { classId: "class-2", classTitle: "Jazz", count: 2 },
      { classId: "class-1", classTitle: "Ballet", count: 1 },
    ]);
  });
});
