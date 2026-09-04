import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceReminderRecipientIds,
  canViewStaffAttendanceSession,
  compareAttendanceSessionsByOccurrence,
  isAttendanceClassEligible,
  isIncompleteAttendanceReminderEligible,
  isIncompleteAttendanceSession,
  isWeekdayIncompleteAttendanceSweepTime,
  matchesStaffAttendanceMode,
  zonedDateTimeParts,
} from "../shared/staff-attendance.ts";

describe("staff attendance session filtering", () => {
  it("excludes sessions for archived or missing classes", () => {
    assert.equal(isAttendanceClassEligible({ status: "published" }), true);
    assert.equal(isAttendanceClassEligible({ status: "draft" }), true);
    assert.equal(isAttendanceClassEligible({ status: "archived" }), false);
    assert.equal(isAttendanceClassEligible(null), false);
  });

  it("orders attendance sessions by date and start time", () => {
    const sessions = [
      { _id: "later-created", date: "2026-06-27", startTime: "18:00" },
      { _id: "next-day", date: "2026-06-28", startTime: "09:00" },
      { _id: "earlier-created", date: "2026-06-27", startTime: "09:30" },
      { _id: "middle", date: "2026-06-27", startTime: "14:00" },
    ];

    assert.deepEqual(
      sessions.sort(compareAttendanceSessionsByOccurrence).map(({ _id }) => _id),
      ["earlier-created", "middle", "later-created", "next-day"],
    );
  });

  it("uses the session id to keep matching occurrence times deterministic", () => {
    const sessions = [
      { _id: "session-b", date: "2026-06-27", startTime: "09:30" },
      { _id: "session-a", date: "2026-06-27", startTime: "09:30" },
    ];

    assert.deepEqual(
      sessions.sort(compareAttendanceSessionsByOccurrence).map(({ _id }) => _id),
      ["session-a", "session-b"],
    );
  });

  it("matches active sessions on the selected date in dated mode", () => {
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: true,
          date: "2026-06-27",
          enrollmentCount: 4,
          attendanceCount: 4,
        },
        { date: "2026-06-27", incomplete: false, today: "2026-06-28" },
      ),
      true,
    );
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: true,
          date: "2026-06-26",
          enrollmentCount: 4,
          attendanceCount: 4,
        },
        { date: "2026-06-27", incomplete: false, today: "2026-06-28" },
      ),
      false,
    );
  });

  it("matches only prior active incomplete sessions in incomplete mode", () => {
    assert.equal(
      isIncompleteAttendanceSession({
        active: true,
        date: "2026-06-26",
        enrollmentCount: 5,
        attendanceCount: 4,
      }),
      true,
    );
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: true,
          date: "2026-06-26",
          enrollmentCount: 5,
          attendanceCount: 4,
        },
        { date: "2026-01-01", incomplete: true, today: "2026-06-27" },
      ),
      true,
    );
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: true,
          date: "2026-06-27",
          enrollmentCount: 5,
          attendanceCount: 4,
        },
        { date: "2026-01-01", incomplete: true, today: "2026-06-27" },
      ),
      false,
    );
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: true,
          date: "2026-06-26",
          enrollmentCount: 5,
          attendanceCount: 5,
        },
        { date: "2026-01-01", incomplete: true, today: "2026-06-27" },
      ),
      false,
    );
    assert.equal(
      matchesStaffAttendanceMode(
        {
          active: false,
          date: "2026-06-26",
          enrollmentCount: 5,
          attendanceCount: 4,
        },
        { date: "2026-01-01", incomplete: true, today: "2026-06-27" },
      ),
      false,
    );
  });

  it("scopes staff sessions unless show all or admin access is enabled", () => {
    assert.equal(
      canViewStaffAttendanceSession({
        showAll: false,
        canAccess: true,
      }),
      true,
    );
    assert.equal(
      canViewStaffAttendanceSession({
        showAll: false,
        canAccess: false,
      }),
      false,
    );
    assert.equal(
      canViewStaffAttendanceSession({
        showAll: true,
        canAccess: false,
      }),
      true,
    );
    assert.equal(
      canViewStaffAttendanceSession({
        isAdmin: true,
        showAll: false,
        canAccess: false,
      }),
      true,
    );
  });

  it("runs incomplete attendance reminder sweeps only on weekday 9 PM ET", () => {
    assert.equal(
      isWeekdayIncompleteAttendanceSweepTime(
        new Date("2026-06-29T01:00:00.000Z"),
      ),
      false,
    );
    assert.equal(
      isWeekdayIncompleteAttendanceSweepTime(
        new Date("2026-06-30T01:00:00.000Z"),
      ),
      true,
    );
    assert.equal(
      isWeekdayIncompleteAttendanceSweepTime(
        new Date("2026-06-28T01:00:00.000Z"),
      ),
      false,
    );
    assert.equal(
      zonedDateTimeParts(new Date("2026-06-30T01:00:00.000Z")).date,
      "2026-06-29",
    );
  });

  it("matches incomplete attendance reminder eligibility", () => {
    const base = {
      active: true,
      status: "scheduled" as const,
      enrollmentCount: 5,
      attendanceCount: 4,
    };
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, date: "2026-06-28" },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      true,
    );
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, date: "2026-06-29", endTime: "20:30" },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      true,
    );
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, date: "2026-06-29", endTime: "21:30" },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      false,
    );
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, date: "2026-06-29" },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      false,
    );
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, status: "cancelled", date: "2026-06-28" },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      false,
    );
    assert.equal(
      isIncompleteAttendanceReminderEligible(
        { ...base, date: "2026-06-28", attendanceCount: 5 },
        { today: "2026-06-29", minutesSinceMidnight: 21 * 60 },
      ),
      false,
    );
  });

  it("dedupes attendance reminder recipients", () => {
    assert.deepEqual(
      attendanceReminderRecipientIds({
        sessionAssignedStaff: ["staff-1", "staff-2"],
        sessionSubstitute: "staff-1",
        classAssignedStaff: ["staff-2", "staff-3"],
      }),
      ["staff-1", "staff-2", "staff-3"],
    );
  });
});
