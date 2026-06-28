import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canViewStaffAttendanceSession,
  isIncompleteAttendanceSession,
  matchesStaffAttendanceMode,
} from "../shared/staff-attendance.ts";

describe("staff attendance session filtering", () => {
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
});
