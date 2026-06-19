import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLASS_WEEKDAY_LABELS,
  classMatchesWeekday,
} from "../shared/class-weekday-filter.ts";

describe("class weekday filter", () => {
  it("matches a class scheduled on the selected weekday", () => {
    assert.equal(
      classMatchesWeekday(
        { weekdays: ["monday", "wednesday"] },
        "wednesday",
      ),
      true,
    );
  });

  it("excludes classes on other days and classes without weekdays", () => {
    assert.equal(
      classMatchesWeekday({ weekdays: ["monday"] }, "friday"),
      false,
    );
    assert.equal(classMatchesWeekday({}, "friday"), false);
  });

  it("includes every class when no weekday is selected", () => {
    assert.equal(classMatchesWeekday({}, undefined), true);
  });

  it("provides readable labels for every filter option", () => {
    assert.equal(CLASS_WEEKDAY_LABELS.thursday, "Thursday");
  });
});
