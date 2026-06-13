import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Doc } from "../convex/_generated/dataModel.ts";
import {
  expandClassSchedule,
  hasCompleteSchedule,
  isDateBetween,
  isGeneratedSessionProtected,
} from "../convex/lib/scheduling.ts";

type ClassSchedule = Parameters<typeof expandClassSchedule>[0];

function classSchedule(
  overrides: Partial<ClassSchedule> = {},
): ClassSchedule {
  return {
    _id: "class-id" as ClassSchedule["_id"],
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    startTime: "16:00",
    endTime: "17:00",
    weekdays: ["monday"],
    timezone: "America/New_York",
    scheduleVersion: 1,
    ...overrides,
  };
}

function holiday(
  startDate: string,
  endDate = startDate,
): Doc<"holidays"> {
  return {
    _id: `holiday-${startDate}` as Doc<"holidays">["_id"],
    _creationTime: 0,
    name: "Studio closed",
    startDate,
    endDate,
  };
}

describe("hasCompleteSchedule", () => {
  it("accepts a schedule with dates, times, and at least one weekday", () => {
    assert.equal(hasCompleteSchedule(classSchedule()), true);
  });

  it("rejects schedules missing any required recurrence field", () => {
    assert.equal(
      hasCompleteSchedule(classSchedule({ startDate: undefined })),
      false,
    );
    assert.equal(
      hasCompleteSchedule(classSchedule({ endDate: undefined })),
      false,
    );
    assert.equal(
      hasCompleteSchedule(classSchedule({ startTime: undefined })),
      false,
    );
    assert.equal(
      hasCompleteSchedule(classSchedule({ endTime: undefined })),
      false,
    );
    assert.equal(hasCompleteSchedule(classSchedule({ weekdays: [] })), false);
  });
});

describe("expandClassSchedule", () => {
  it("generates only the selected weekdays", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-06-01",
        endDate: "2026-06-14",
        weekdays: ["monday", "wednesday"],
      }),
      [],
    );

    assert.deepEqual(dates, [
      "2026-06-01",
      "2026-06-03",
      "2026-06-08",
      "2026-06-10",
    ]);
  });

  it("includes start and end dates when they fall on selected weekdays", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-06-01",
        endDate: "2026-06-08",
        weekdays: ["monday"],
      }),
      [],
    );

    assert.deepEqual(dates, ["2026-06-01", "2026-06-08"]);
  });

  it("excludes a single-day holiday", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-06-01",
        endDate: "2026-06-15",
        weekdays: ["monday"],
      }),
      [holiday("2026-06-08")],
    );

    assert.deepEqual(dates, ["2026-06-01", "2026-06-15"]);
  });

  it("excludes every selected weekday inside a multi-day holiday", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-06-01",
        endDate: "2026-06-14",
        weekdays: ["monday", "wednesday", "friday"],
      }),
      [holiday("2026-06-03", "2026-06-10")],
    );

    assert.deepEqual(dates, ["2026-06-01", "2026-06-12"]);
  });

  it("returns no dates for an incomplete schedule", () => {
    const dates = expandClassSchedule(
      classSchedule({ startTime: undefined }),
      [],
    );

    assert.deepEqual(dates, []);
  });

  it("generates selected weekdays across a year boundary", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-12-28",
        endDate: "2027-01-04",
        weekdays: ["monday"],
      }),
      [],
    );

    assert.deepEqual(dates, ["2026-12-28", "2027-01-04"]);
  });

  it("generates a selected leap day", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2028-02-28",
        endDate: "2028-03-01",
        weekdays: ["tuesday"],
      }),
      [],
    );

    assert.deepEqual(dates, ["2028-02-29"]);
  });

  it("handles overlapping holidays without duplicate dates", () => {
    const dates = expandClassSchedule(
      classSchedule({
        startDate: "2026-06-01",
        endDate: "2026-06-15",
        weekdays: ["monday", "wednesday"],
      }),
      [
        holiday("2026-06-03", "2026-06-10"),
        holiday("2026-06-08", "2026-06-12"),
      ],
    );

    assert.deepEqual(dates, ["2026-06-01", "2026-06-15"]);
    assert.equal(new Set(dates).size, dates.length);
  });
});

describe("isDateBetween", () => {
  it("treats enrollment start and end dates as inclusive", () => {
    assert.equal(isDateBetween("2026-06-01", "2026-06-01", "2026-06-30"), true);
    assert.equal(isDateBetween("2026-06-30", "2026-06-01", "2026-06-30"), true);
  });

  it("rejects dates outside the enrollment range", () => {
    assert.equal(
      isDateBetween("2026-05-31", "2026-06-01", "2026-06-30"),
      false,
    );
    assert.equal(
      isDateBetween("2026-07-01", "2026-06-01", "2026-06-30"),
      false,
    );
  });

  it("supports open-ended enrollment ranges", () => {
    assert.equal(isDateBetween("2026-05-31", undefined, "2026-06-30"), true);
    assert.equal(isDateBetween("2026-07-01", "2026-06-01", undefined), true);
    assert.equal(isDateBetween("2026-07-01", undefined, undefined), true);
  });
});

describe("isGeneratedSessionProtected", () => {
  const today = "2026-06-15";

  it("protects past generated sessions", () => {
    assert.equal(
      isGeneratedSessionProtected(
        { date: "2026-06-14", hasManualOverride: false },
        today,
        false,
      ),
      true,
    );
  });

  it("protects sessions with attendance or a manual override", () => {
    assert.equal(
      isGeneratedSessionProtected(
        { date: "2026-06-20", hasManualOverride: false },
        today,
        true,
      ),
      true,
    );
    assert.equal(
      isGeneratedSessionProtected(
        { date: "2026-06-20", hasManualOverride: true },
        today,
        false,
      ),
      true,
    );
  });

  it("protects generated sessions with selected-session signups", () => {
    assert.equal(
      isGeneratedSessionProtected(
        { date: "2026-06-20", hasManualOverride: false },
        today,
        false,
        true,
      ),
      true,
    );
  });

  it("leaves today and future untouched sessions eligible for synchronization", () => {
    assert.equal(
      isGeneratedSessionProtected(
        { date: today, hasManualOverride: false },
        today,
        false,
      ),
      false,
    );
    assert.equal(
      isGeneratedSessionProtected(
        { date: "2026-06-20", hasManualOverride: false },
        today,
        false,
      ),
      false,
    );
  });
});
