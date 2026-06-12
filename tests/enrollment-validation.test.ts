import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateEnrollmentDates } from "../convex/lib/enrollmentValidation.ts";

describe("validateEnrollmentDates", () => {
  it("rejects a dropped enrollment without an end date", () => {
    assert.throws(
      () =>
        validateEnrollmentDates({
          status: "dropped",
          startDate: "2026-06-01",
        }),
      /must have an end date/,
    );
  });

  it("rejects missing and malformed dates", () => {
    assert.throws(
      () =>
        validateEnrollmentDates({
          status: "enrolled",
          startDate: undefined,
        }),
      /start date must be a valid/,
    );
    assert.throws(
      () =>
        validateEnrollmentDates({
          status: "enrolled",
          startDate: "2026-02-30",
        }),
      /start date must be a valid/,
    );
    assert.throws(
      () =>
        validateEnrollmentDates({
          status: "enrolled",
          startDate: "2026-02-01",
          endDate: "not-a-date",
        }),
      /end date must be a valid/,
    );
  });

  it("rejects a reversed enrollment date range", () => {
    assert.throws(
      () =>
        validateEnrollmentDates({
          status: "enrolled",
          startDate: "2026-07-01",
          endDate: "2026-06-30",
        }),
      /start date must be on or before end date/,
    );
  });

  it("accepts valid open and closed enrollment ranges", () => {
    assert.doesNotThrow(() =>
      validateEnrollmentDates({
        status: "enrolled",
        startDate: "2026-06-01",
      }),
    );
    assert.doesNotThrow(() =>
      validateEnrollmentDates({
        status: "dropped",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      }),
    );
  });
});
