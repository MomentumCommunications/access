import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesDailyPrivateLesson } from "../shared/private-daily.ts";

describe("daily private lesson filtering", () => {
  it("matches the selected calendar date in the private timezone", () => {
    const startsAt = new Date("2026-09-11T01:00:00.000Z").getTime();

    assert.equal(
      matchesDailyPrivateLesson(
        {
          startsAt,
          status: "scheduled",
          timezone: "America/New_York",
        },
        { date: "2026-09-10", incomplete: false, now: startsAt },
      ),
      true,
    );
    assert.equal(
      matchesDailyPrivateLesson(
        { startsAt, status: "scheduled", timezone: "Europe/London" },
        { date: "2026-09-10", incomplete: false, now: startsAt },
      ),
      false,
    );
  });

  it("includes only past scheduled lessons in incomplete mode", () => {
    const now = new Date("2026-09-10T18:00:00.000Z").getTime();
    const past = now - 1;
    const future = now + 1;

    assert.equal(
      matchesDailyPrivateLesson(
        { startsAt: past, status: "scheduled", timezone: "America/New_York" },
        { date: "2026-09-10", incomplete: true, now },
      ),
      true,
    );
    for (const lesson of [
      { startsAt: future, status: "scheduled" as const },
      { startsAt: past, status: "completed" as const },
      { startsAt: past, status: "cancelled" as const },
    ]) {
      assert.equal(
        matchesDailyPrivateLesson(
          { ...lesson, timezone: "America/New_York" },
          { date: "2026-09-10", incomplete: true, now },
        ),
        false,
      );
    }
  });
});
