import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMDYYYY, formatShortDate } from "../src/lib/date-utils.ts";

describe("date-only attendance labels", { concurrency: false }, () => {
  for (const timezone of ["America/New_York", "UTC", "Pacific/Auckland"]) {
    it(`preserves the session date in ${timezone}`, () => {
      const originalTimezone = process.env.TZ;
      process.env.TZ = timezone;

      try {
        const cases = [
          ["2026-11-09", "Mon, 11/9", "11/9/2026"],
          ["2026-03-08", "Sun, 3/8", "3/8/2026"],
          ["2026-11-01", "Sun, 11/1", "11/1/2026"],
          ["2026-04-01", "Wed, 4/1", "4/1/2026"],
          ["2026-12-31", "Thu, 12/31", "12/31/2026"],
          ["2027-01-01", "Fri, 1/1", "1/1/2027"],
        ];

        for (const [date, cardLabel, sessionDetailLabel] of cases) {
          assert.equal(formatShortDate(date), cardLabel, date);
          assert.equal(formatMDYYYY(date), sessionDetailLabel, date);
        }
      } finally {
        if (originalTimezone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTimezone;
        }
      }
    });
  }

  it("uses the existing missing-date placeholder", () => {
    assert.equal(formatShortDate(), "Not set");
    assert.equal(formatShortDate(""), "Not set");
  });
});
