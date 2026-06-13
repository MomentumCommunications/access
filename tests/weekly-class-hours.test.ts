import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateWeeklyClassMinuteSegments,
  calculateWeeklyClassMinutes,
  weeklyMinutesToHours,
} from "../convex/lib/billing/weeklyClassHours.ts";

type Row = Parameters<typeof calculateWeeklyClassMinutes>[0][number];

function row(overrides: Partial<Row> = {}): Row {
  return {
    studentId: "student-1",
    enrollmentStatus: "enrolled",
    enrollmentStartDate: "2026-01-01",
    enrollmentEndDate: "2026-12-31",
    classStatus: "published",
    classStartDate: "2026-01-01",
    classEndDate: "2026-12-31",
    startTime: "16:00",
    endTime: "17:00",
    weekdays: ["monday"],
    ...overrides,
  };
}

describe("calculateWeeklyClassMinutes", () => {
  it("calculates one active 60-minute weekly class", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes([row()], "2026-06-15"),
      [{ studentId: "student-1", weeklyMinutes: 60 }],
    );
  });

  it("adds multiple active classes for one student", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row(),
          row({
            startTime: "17:00",
            endTime: "18:30",
            weekdays: ["wednesday"],
          }),
          row({
            startTime: "10:00",
            endTime: "10:45",
            weekdays: ["tuesday", "thursday"],
          }),
        ],
        "2026-06-15",
      ),
      [{ studentId: "student-1", weeklyMinutes: 240 }],
    );
  });

  it("does not count pending, waitlisted, or undated dropped enrollments", () => {
    const rows = ["pending", "waitlisted"].map(
      (enrollmentStatus) => row({ enrollmentStatus }),
    );
    rows.push(
      row({
        enrollmentStatus: "dropped",
        enrollmentEndDate: undefined,
      }),
    );

    assert.deepEqual(calculateWeeklyClassMinutes(rows, "2026-06-15"), []);
  });

  it("excludes inactive and archived students from tuition", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row({ studentId: "active", studentStatus: "active" }),
          row({ studentId: "inactive", studentStatus: "inactive" }),
          row({ studentId: "archived", studentStatus: "archived" }),
        ],
        "2026-06-15",
      ),
      [{ studentId: "active", weeklyMinutes: 60 }],
    );
  });

  it("does not include per-session classes in regular tuition hours", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row({
            studentId: "standard",
            classEnrollmentMode: "standard",
          }),
          row({
            studentId: "per-session",
            classEnrollmentMode: "per_session",
          }),
        ],
        "2026-06-15",
      ),
      [{ studentId: "standard", weeklyMinutes: 60 }],
    );
  });

  it("counts dropped enrollment through its inclusive end date", () => {
    const dropped = row({
      enrollmentStatus: "dropped",
      enrollmentEndDate: "2026-06-15",
    });

    assert.deepEqual(
      calculateWeeklyClassMinutes([dropped], "2026-06-15"),
      [{ studentId: "student-1", weeklyMinutes: 60 }],
    );
    assert.deepEqual(
      calculateWeeklyClassMinutes([dropped], "2026-06-16"),
      [],
    );
  });

  it("counts enrolled draft classes but not archived or incomplete classes", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row({ classStatus: "draft" }),
          row({ classStatus: "archived" }),
          row({ endTime: undefined }),
          row({ endTime: "15:00" }),
          row({ weekdays: [] }),
        ],
        "2026-06-15",
      ),
      [{ studentId: "student-1", weeklyMinutes: 60 }],
    );
  });

  it("calculates the reported mixed-duration example", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row({ startTime: "15:45", endTime: "16:31" }),
          row({ startTime: "13:00", endTime: "13:45" }),
          row({
            classStatus: "draft",
            startTime: "16:00",
            endTime: "16:45",
          }),
          row({ startTime: "18:00", endTime: "17:00" }),
        ],
        "2026-06-15",
      ),
      [{ studentId: "student-1", weeklyMinutes: 136 }],
    );
  });

  it("uses inclusive enrollment and class date boundaries", () => {
    const rows = [
      row({
        studentId: "before-enrollment",
        enrollmentStartDate: "2026-06-16",
      }),
      row({
        studentId: "after-enrollment",
        enrollmentEndDate: "2026-06-14",
      }),
      row({
        studentId: "before-class",
        classStartDate: "2026-06-16",
      }),
      row({
        studentId: "after-class",
        classEndDate: "2026-06-14",
      }),
      row({
        studentId: "starts-today",
        enrollmentStartDate: "2026-06-15",
        classStartDate: "2026-06-15",
      }),
      row({
        studentId: "ends-today",
        enrollmentEndDate: "2026-06-15",
        classEndDate: "2026-06-15",
      }),
    ];

    assert.deepEqual(
      calculateWeeklyClassMinutes(rows, "2026-06-15"),
      [
        { studentId: "ends-today", weeklyMinutes: 60 },
        { studentId: "starts-today", weeklyMinutes: 60 },
      ],
    );
  });

  it("calculates separate students independently", () => {
    assert.deepEqual(
      calculateWeeklyClassMinutes(
        [
          row({ studentId: "student-b" }),
          row({
            studentId: "student-a",
            startTime: "17:00",
            endTime: "18:30",
          }),
        ],
        "2026-06-15",
      ),
      [
        { studentId: "student-a", weeklyMinutes: 90 },
        { studentId: "student-b", weeklyMinutes: 60 },
      ],
    );
  });

  it("is stable regardless of input order", () => {
    const rows = [
      row({ studentId: "student-b" }),
      row({ studentId: "student-a", weekdays: ["monday", "wednesday"] }),
    ];

    assert.deepEqual(
      calculateWeeklyClassMinutes(rows, "2026-06-15"),
      calculateWeeklyClassMinutes([...rows].reverse(), "2026-06-15"),
    );
  });

  it("converts minutes to hours without rounding", () => {
    assert.equal(weeklyMinutesToHours(90), 1.5);
  });
});

describe("calculateWeeklyClassMinuteSegments", () => {
  it("returns one segment for an enrollment active all period", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [row()],
        "2026-06-01",
        "2026-06-30",
      ),
      [
        {
          studentId: "student-1",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          periodDays: 30,
          segments: [
            {
              startDate: "2026-06-01",
              endDate: "2026-06-30",
              days: 30,
              weeklyMinutes: 60,
            },
          ],
        },
      ],
    );
  });

  it("segments a future enrollment start and preserves the zero period", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [row({ enrollmentStartDate: "2026-06-15" })],
        "2026-06-01",
        "2026-06-30",
      )[0]?.segments,
      [
        {
          startDate: "2026-06-01",
          endDate: "2026-06-14",
          days: 14,
          weeklyMinutes: 0,
        },
        {
          startDate: "2026-06-15",
          endDate: "2026-06-30",
          days: 16,
          weeklyMinutes: 60,
        },
      ],
    );
  });

  it("segments inclusive enrollment and class end dates", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [
          row({
            studentId: "enrollment-end",
            enrollmentEndDate: "2026-06-14",
          }),
          row({
            studentId: "class-end",
            classEndDate: "2026-06-20",
          }),
        ],
        "2026-06-01",
        "2026-06-30",
      ),
      [
        {
          studentId: "class-end",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          periodDays: 30,
          segments: [
            {
              startDate: "2026-06-01",
              endDate: "2026-06-20",
              days: 20,
              weeklyMinutes: 60,
            },
            {
              startDate: "2026-06-21",
              endDate: "2026-06-30",
              days: 10,
              weeklyMinutes: 0,
            },
          ],
        },
        {
          studentId: "enrollment-end",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          periodDays: 30,
          segments: [
            {
              startDate: "2026-06-01",
              endDate: "2026-06-14",
              days: 14,
              weeklyMinutes: 60,
            },
            {
              startDate: "2026-06-15",
              endDate: "2026-06-30",
              days: 16,
              weeklyMinutes: 0,
            },
          ],
        },
      ],
    );
  });

  it("tracks changing totals from overlapping classes", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [
          row(),
          row({
            enrollmentStartDate: "2026-06-10",
            enrollmentEndDate: "2026-06-20",
            startTime: "17:00",
            endTime: "18:30",
          }),
        ],
        "2026-06-01",
        "2026-06-30",
      )[0]?.segments,
      [
        {
          startDate: "2026-06-01",
          endDate: "2026-06-09",
          days: 9,
          weeklyMinutes: 60,
        },
        {
          startDate: "2026-06-10",
          endDate: "2026-06-20",
          days: 11,
          weeklyMinutes: 150,
        },
        {
          startDate: "2026-06-21",
          endDate: "2026-06-30",
          days: 10,
          weeklyMinutes: 60,
        },
      ],
    );
  });

  it("counts a dropped enrollment through its end date", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [
          row({
            enrollmentStatus: "dropped",
            enrollmentEndDate: "2026-06-14",
          }),
        ],
        "2026-06-01",
        "2026-06-30",
      )[0]?.segments,
      [
        {
          startDate: "2026-06-01",
          endDate: "2026-06-14",
          days: 14,
          weeklyMinutes: 60,
        },
        {
          startDate: "2026-06-15",
          endDate: "2026-06-30",
          days: 16,
          weeklyMinutes: 0,
        },
      ],
    );
  });

  it("excludes ineligible rows and students with no active interval", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [
          row({ enrollmentStatus: "pending" }),
          row({ enrollmentStatus: "waitlisted" }),
          row({
            enrollmentStatus: "dropped",
            enrollmentEndDate: undefined,
          }),
          row({ classStatus: "archived" }),
          row({ endTime: undefined }),
          row({ enrollmentStartDate: "2026-07-01" }),
        ],
        "2026-06-01",
        "2026-06-30",
      ),
      [],
    );
  });

  it("merges adjacent boundaries when the total is unchanged", () => {
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        [
          row({ enrollmentEndDate: "2026-06-14" }),
          row({
            enrollmentStartDate: "2026-06-15",
            startTime: "17:00",
            endTime: "18:00",
          }),
        ],
        "2026-06-01",
        "2026-06-30",
      )[0]?.segments,
      [
        {
          startDate: "2026-06-01",
          endDate: "2026-06-30",
          days: 30,
          weeklyMinutes: 60,
        },
      ],
    );
  });

  it("orders students and results deterministically", () => {
    const rows = [
      row({ studentId: "student-b" }),
      row({ studentId: "student-a" }),
    ];

    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        rows,
        "2026-06-01",
        "2026-06-30",
      ),
      calculateWeeklyClassMinuteSegments(
        [...rows].reverse(),
        "2026-06-01",
        "2026-06-30",
      ),
    );
    assert.deepEqual(
      calculateWeeklyClassMinuteSegments(
        rows,
        "2026-06-01",
        "2026-06-30",
      ).map(({ studentId }) => studentId),
      ["student-a", "student-b"],
    );
  });

  it("rejects invalid or reversed billing periods", () => {
    assert.throws(() =>
      calculateWeeklyClassMinuteSegments(
        [row()],
        "2026-06-31",
        "2026-07-01",
      ),
    );
    assert.throws(() =>
      calculateWeeklyClassMinuteSegments(
        [row()],
        "2026-07-01",
        "2026-06-30",
      ),
    );
  });
});
