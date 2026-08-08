import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classMatchesRosterFilters,
  isPrintRosterEnrollment,
  isPrintRosterSessionSignup,
  isPrintRosterTrial,
} from "../shared/class-roster-printing.ts";

describe("class roster filters", () => {
  const classItem = {
    title: "Ballet Foundations",
    visibleToGroupIds: ["group-1"],
  };

  it("matches season, group, and case-insensitive title filters", () => {
    assert.equal(
      classMatchesRosterFilters(classItem, "season-1", {
        seasonId: "season-1",
        group: "group-1",
        titleQuery: "  BALLET ",
      }),
      true,
    );
    assert.equal(
      classMatchesRosterFilters(classItem, "season-2", {
        seasonId: "season-1",
      }),
      false,
    );
    assert.equal(
      classMatchesRosterFilters(classItem, "season-1", {
        group: "group-2",
      }),
      false,
    );
    assert.equal(
      classMatchesRosterFilters(classItem, "season-1", {
        titleQuery: "tap",
      }),
      false,
    );
  });

  it("supports the no-group filter", () => {
    assert.equal(
      classMatchesRosterFilters(
        { title: "Open Class" },
        undefined,
        { group: "none" },
      ),
      true,
    );
    assert.equal(
      classMatchesRosterFilters(classItem, undefined, { group: "none" }),
      false,
    );
  });
});

describe("class roster rows", () => {
  const upcomingSession = {
    date: "2026-09-10",
    active: true,
    status: "scheduled",
  };

  it("uses enrollment status without applying enrollment dates", () => {
    assert.equal(isPrintRosterEnrollment("enrolled"), true);
    assert.equal(isPrintRosterEnrollment("pending"), false);
    assert.equal(isPrintRosterEnrollment("dropped"), false);
  });

  it("includes only upcoming regular pending or enrolled signups", () => {
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "enrolled" },
        upcomingSession,
        "2026-09-01",
      ),
      true,
    );
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "pending", trialRequestId: "trial-1" },
        upcomingSession,
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "cancelled" },
        upcomingSession,
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "enrolled" },
        { ...upcomingSession, date: "2026-08-31" },
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "enrolled" },
        { ...upcomingSession, active: false },
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterSessionSignup(
        { status: "enrolled" },
        null,
        "2026-09-01",
      ),
      true,
    );
  });

  it("includes only current pending and approved trials", () => {
    assert.equal(
      isPrintRosterTrial(
        { status: "pending" },
        upcomingSession,
        "2026-09-01",
      ),
      true,
    );
    assert.equal(
      isPrintRosterTrial(
        { status: "approved" },
        upcomingSession,
        "2026-09-01",
      ),
      true,
    );
    assert.equal(
      isPrintRosterTrial(
        { status: "rejected" },
        upcomingSession,
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterTrial(
        { status: "approved" },
        { ...upcomingSession, status: "cancelled" },
        "2026-09-01",
      ),
      false,
    );
    assert.equal(
      isPrintRosterTrial({ status: "approved" }, null, "2026-09-01"),
      true,
    );
  });
});
