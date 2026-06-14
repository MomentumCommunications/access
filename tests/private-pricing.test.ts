import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePrivateChargeCents,
  replaceActivePrivateRate,
  resolvePrivateCharge,
  selectActivePrivateRate,
  validatePrivateParticipantCount,
} from "../shared/private-pricing.ts";

const rates = [
  {
    id: "solo",
    participants: 1 as const,
    hourlyPriceCents: 6000,
    active: true,
    activatedAt: 1,
  },
  {
    id: "duet",
    participants: 2 as const,
    hourlyPriceCents: 4000,
    active: true,
    activatedAt: 1,
  },
  {
    id: "trio",
    participants: 3 as const,
    hourlyPriceCents: 2500,
    active: true,
    activatedAt: 1,
  },
];

describe("private pricing configuration", () => {
  it("accepts solo, duet, and trio participant counts", () => {
    assert.doesNotThrow(() => validatePrivateParticipantCount(1));
    assert.doesNotThrow(() => validatePrivateParticipantCount(2));
    assert.doesNotThrow(() => validatePrivateParticipantCount(3));
    assert.throws(
      () => validatePrivateParticipantCount(4),
      /1, 2, or 3/,
    );
  });

  it("selects the matching active rate", () => {
    assert.equal(selectActivePrivateRate(rates, 1)?.id, "solo");
    assert.equal(selectActivePrivateRate(rates, 2)?.id, "duet");
    assert.equal(selectActivePrivateRate(rates, 3)?.id, "trio");
  });

  it("deactivates the previous rate when a replacement is added", () => {
    const replacement = {
      id: "duet-v2",
      participants: 2 as const,
      hourlyPriceCents: 4500,
      active: true,
      activatedAt: 10,
    };
    const next = replaceActivePrivateRate(rates, replacement, 10);

    assert.equal(next.filter((rate) => rate.active && rate.participants === 2).length, 1);
    assert.equal(selectActivePrivateRate(next, 2)?.id, "duet-v2");
    assert.deepEqual(
      next.find((rate) => rate.id === "duet"),
      { ...rates[1], active: false, inactivatedAt: 10 },
    );
  });
});

describe("private charge calculation", () => {
  it("uses solo, duet, and trio rates from the default participant count", () => {
    assert.equal(
      resolvePrivateCharge({
        billable: true,
        participants: 1,
        durationMinutes: 60,
        rates,
      }).amountCents,
      6000,
    );
    assert.equal(
      resolvePrivateCharge({
        billable: true,
        participants: 2,
        durationMinutes: 60,
        rates,
      }).amountCents,
      4000,
    );
    assert.equal(
      resolvePrivateCharge({
        billable: true,
        participants: 3,
        durationMinutes: 60,
        rates,
      }).amountCents,
      2500,
    );
  });

  it("prorates lesson duration to the nearest cent", () => {
    assert.equal(calculatePrivateChargeCents(2500, 30), 1250);
    assert.equal(calculatePrivateChargeCents(2500, 45), 1875);
  });

  it("does not produce a charge for non-billable participation", () => {
    assert.equal(
      resolvePrivateCharge({
        billable: false,
        participants: 1,
        durationMinutes: 60,
        rates,
      }).amountCents,
      undefined,
    );
  });

  it("uses the billable flag for attended, excused, and no-show outcomes", () => {
    for (let caseIndex = 0; caseIndex < 3; caseIndex += 1) {
      const result = resolvePrivateCharge({
        billable: true,
        participants: 3,
        durationMinutes: 30,
        rates,
      });
      assert.equal(result.amountCents, 1250);
    }
  });

  it("keeps a stored charge stable after active rates change", () => {
    const snapshot = { privateRateId: "trio", priceCents: 1250 };
    const changedRates = replaceActivePrivateRate(
      rates,
      {
        id: "trio-v2",
        participants: 3,
        hourlyPriceCents: 3000,
        active: true,
        activatedAt: 20,
      },
      20,
    );

    assert.deepEqual(
      resolvePrivateCharge({
        billable: true,
        participants: 3,
        durationMinutes: 30,
        rates: changedRates,
        snapshot,
      }),
      { amountCents: 1250, rateId: "trio", warning: undefined },
    );
  });

  it("returns a clear warning when a rate is missing", () => {
    assert.match(
      resolvePrivateCharge({
        billable: true,
        participants: 2,
        durationMinutes: 60,
        rates: rates.filter((rate) => rate.participants !== 2),
      }).warning || "",
      /No active private rate/,
    );
  });
});
