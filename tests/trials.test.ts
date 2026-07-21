import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSingleTrialSession,
  isEligibleTrialSession,
  isTrialAccountReady,
  trialRequestNextStatus,
  validatePaidTrialPrice,
} from "../shared/trials.ts";

describe("paid trial request policy", () => {
  it("blocks pending onboarding but permits complete and legacy accounts", () => {
    assert.equal(isTrialAccountReady("pending"), false);
    assert.equal(isTrialAccountReady("complete"), true);
    assert.equal(isTrialAccountReady(undefined), true);
  });

  it("requires exactly one session", () => {
    assert.equal(assertSingleTrialSession(["session-1"]), "session-1");
    assert.throws(() => assertSingleTrialSession([]), /exactly one/);
    assert.throws(
      () => assertSingleTrialSession(["session-1", "session-2"]),
      /exactly one/,
    );
  });

  it("accepts only active upcoming sessions from the requested class", () => {
    const base = {
      sessionClassId: "class-1",
      requestedClassId: "class-1",
      sessionDate: "2026-08-10",
      today: "2026-08-01",
      active: true,
      status: "scheduled",
    };
    assert.equal(isEligibleTrialSession(base), true);
    assert.equal(
      isEligibleTrialSession({ ...base, sessionClassId: "class-2" }),
      false,
    );
    assert.equal(
      isEligibleTrialSession({ ...base, sessionDate: "2026-07-31" }),
      false,
    );
    assert.equal(isEligibleTrialSession({ ...base, active: false }), false);
    assert.equal(
      isEligibleTrialSession({ ...base, status: "cancelled" }),
      false,
    );
  });

  it("preserves rejected history and only reviews pending requests", () => {
    assert.equal(trialRequestNextStatus("pending", "approve"), "approved");
    assert.equal(trialRequestNextStatus("pending", "reject"), "rejected");
    assert.throws(
      () => trialRequestNextStatus("rejected", "approve"),
      /Only pending/,
    );
  });

  it("requires a positive whole-cent price", () => {
    assert.equal(validatePaidTrialPrice(2500), 2500);
    assert.throws(() => validatePaidTrialPrice(0), /positive/);
    assert.throws(() => validatePaidTrialPrice(10.5), /positive/);
  });
});
