import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Doc } from "../convex/_generated/dataModel.ts";
import { expandPrivateLessonStarts } from "../convex/lib/privateScheduling.ts";

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

describe("expandPrivateLessonStarts", () => {
  it("converts a recurring local time to absolute timestamps", () => {
    const starts = expandPrivateLessonStarts(
      {
        startDate: "2026-06-01",
        endDate: "2026-06-15",
        startTime: "16:30",
        weekdays: ["monday"],
        timezone: "America/New_York",
      },
      [],
    );

    assert.deepEqual(
      starts.map((startsAt) => new Date(startsAt).toISOString()),
      [
        "2026-06-01T20:30:00.000Z",
        "2026-06-08T20:30:00.000Z",
        "2026-06-15T20:30:00.000Z",
      ],
    );
  });

  it("keeps the local time stable across daylight-saving changes", () => {
    const starts = expandPrivateLessonStarts(
      {
        startDate: "2026-03-02",
        endDate: "2026-03-09",
        startTime: "16:00",
        weekdays: ["monday"],
        timezone: "America/New_York",
      },
      [],
    );

    assert.deepEqual(
      starts.map((startsAt) => new Date(startsAt).toISOString()),
      ["2026-03-02T21:00:00.000Z", "2026-03-09T20:00:00.000Z"],
    );
  });

  it("uses the shared holiday exclusions", () => {
    const starts = expandPrivateLessonStarts(
      {
        startDate: "2026-06-01",
        endDate: "2026-06-15",
        startTime: "16:30",
        weekdays: ["monday"],
        timezone: "America/New_York",
      },
      [holiday("2026-06-08")],
    );

    assert.deepEqual(
      starts.map((startsAt) => new Date(startsAt).toISOString()),
      ["2026-06-01T20:30:00.000Z", "2026-06-15T20:30:00.000Z"],
    );
  });
});
