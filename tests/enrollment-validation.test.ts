import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveEnrollmentStatusDates,
  validateEnrollmentDates,
} from "../convex/lib/enrollmentValidation.ts";

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

describe("resolveEnrollmentStatusDates", () => {
  it("clears a stale drop end date when re-enrolling", () => {
    assert.deepEqual(
      resolveEnrollmentStatusDates({
        existingStatus: "dropped",
        nextStatus: "enrolled",
        existingStartDate: "2026-05-01",
        existingEndDate: "2026-05-31",
        today: "2026-06-12",
      }),
      {
        startDate: "2026-05-01",
        endDate: undefined,
      },
    );
  });

  it("allows an explicit re-enrollment end date", () => {
    assert.deepEqual(
      resolveEnrollmentStatusDates({
        existingStatus: "dropped",
        nextStatus: "enrolled",
        existingStartDate: "2026-05-01",
        existingEndDate: "2026-05-31",
        endDate: "2026-08-31",
        today: "2026-06-12",
      }),
      {
        startDate: "2026-05-01",
        endDate: "2026-08-31",
      },
    );
  });

  it("backfills a missing legacy start date during status updates", () => {
    assert.deepEqual(
      resolveEnrollmentStatusDates({
        existingStatus: "pending",
        nextStatus: "enrolled",
        today: "2026-06-12",
      }),
      {
        startDate: "2026-06-12",
        endDate: undefined,
      },
    );
    assert.deepEqual(
      resolveEnrollmentStatusDates({
        existingStatus: "enrolled",
        nextStatus: "dropped",
        today: "2026-06-12",
      }),
      {
        startDate: "2026-06-12",
        endDate: "2026-06-12",
      },
    );
    assert.deepEqual(
      resolveEnrollmentStatusDates({
        existingStatus: "enrolled",
        nextStatus: "waitlisted",
        existingEndDate: "2026-05-31",
        today: "2026-06-12",
      }),
      {
        startDate: "2026-05-31",
        endDate: "2026-05-31",
      },
    );
  });
});
