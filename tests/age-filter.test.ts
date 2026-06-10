import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAgeOnDate,
  classMatchesAge,
} from "../convex/lib/age.ts";

describe("calculateAgeOnDate", () => {
  it("accounts for whether the birthday has passed", () => {
    assert.equal(calculateAgeOnDate("2016-06-09", "2026-06-09"), 10);
    assert.equal(calculateAgeOnDate("2016-06-10", "2026-06-09"), 9);
  });

  it("returns null for missing, invalid, or future birth dates", () => {
    assert.equal(calculateAgeOnDate(undefined, "2026-06-09"), null);
    assert.equal(calculateAgeOnDate("not-a-date", "2026-06-09"), null);
    assert.equal(calculateAgeOnDate("2016-02-31", "2026-06-09"), null);
    assert.equal(calculateAgeOnDate("2027-01-01", "2026-06-09"), null);
  });
});

describe("classMatchesAge", () => {
  it("treats minimum and maximum ages as inclusive", () => {
    assert.equal(classMatchesAge({ minAge: 8, maxAge: 10 }, 8), true);
    assert.equal(classMatchesAge({ minAge: 8, maxAge: 10 }, 10), true);
    assert.equal(classMatchesAge({ minAge: 8, maxAge: 10 }, 11), false);
  });

  it("only includes unrestricted classes when age is unknown", () => {
    assert.equal(classMatchesAge({}, null), true);
    assert.equal(classMatchesAge({ minAge: 5 }, null), false);
    assert.equal(classMatchesAge({ maxAge: 12 }, null), false);
  });
});
