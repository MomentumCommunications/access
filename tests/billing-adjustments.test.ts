import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBillingAdjustments,
  applyTargetedBillingAdjustments,
  assertBillingAdjustmentEditable,
  assertBillingAdjustmentFinanciallyEditable,
  billingPeriodsOverlap,
  buildBillingAdjustmentActivityEvent,
  selectBillingAdjustments,
  validateBillingAdjustmentInput,
  type BillingAdjustmentLike,
} from "../shared/billing-adjustments.ts";

function adjustment(
  overrides: Partial<BillingAdjustmentLike> = {},
): BillingAdjustmentLike {
  return {
    id: "adjustment-1",
    scopeType: "household_tuition",
    scopeId: "household-1",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    kind: "discount",
    calculationType: "fixed_cents",
    amount: 1000,
    reasonCode: "goodwill",
    status: "active",
    createdAt: 1,
    ...overrides,
  };
}

describe("billing adjustment validation", () => {
  it("accepts valid fixed and percent adjustments", () => {
    assert.doesNotThrow(() => validateBillingAdjustmentInput(adjustment()));
    assert.doesNotThrow(() =>
      validateBillingAdjustmentInput(
        adjustment({ calculationType: "percent", amount: 1250 }),
      ),
    );
  });

  it("rejects invalid scope, calculation type, reason, and status-like input", () => {
    assert.throws(
      () =>
        validateBillingAdjustmentInput({
          ...adjustment(),
          scopeType: "student" as "household_tuition",
        }),
      /scope/,
    );
    assert.throws(
      () =>
        validateBillingAdjustmentInput({
          ...adjustment(),
          calculationType: "hours" as "fixed_cents",
        }),
      /calculation type/,
    );
    assert.throws(
      () =>
        validateBillingAdjustmentInput({
          ...adjustment(),
          reasonCode: "unknown" as "goodwill",
        }),
      /reason/,
    );
    assert.equal(
      applyBillingAdjustments(10000, [
        adjustment({ status: "voided" }),
      ]).adjustments.length,
      0,
    );
    assert.throws(
      () => assertBillingAdjustmentEditable("voided"),
      /cannot be edited/,
    );
  });

  it("rejects malformed or reversed billing periods", () => {
    assert.throws(
      () =>
        validateBillingAdjustmentInput(
          adjustment({ periodStart: "06/01/2026" }),
        ),
      /YYYY-MM-DD/,
    );
    assert.throws(
      () =>
        validateBillingAdjustmentInput(
          adjustment({
            periodStart: "2026-07-01",
            periodEnd: "2026-06-30",
          }),
        ),
      /cannot precede/,
    );
  });
});

describe("billing adjustment activity", () => {
  it("builds readable lifecycle events with actor and entity references", () => {
    const event = buildBillingAdjustmentActivityEvent({
      adjustmentId: "adjustment-1",
      actorId: "user-1",
      action: "created",
      metadata: {
        scopeId: "household-1",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      },
    });

    assert.equal(event.entityType, "billing_adjustment");
    assert.equal(event.entityId, "adjustment-1");
    assert.equal(event.actorId, "user-1");
    assert.equal(event.eventType, "billing_adjustment_created");
    assert.match(event.summary, /Created a billing adjustment/);
    assert.equal("createdAt" in event, false);
  });
});

describe("billing adjustment math", () => {
  it("applies fixed discounts and surcharges", () => {
    assert.equal(
      applyBillingAdjustments(10000, [adjustment()]).totalCents,
      9000,
    );
    assert.equal(
      applyBillingAdjustments(10000, [
        adjustment({ kind: "surcharge", amount: 500 }),
      ]).totalCents,
      10500,
    );
  });

  it("uses the post-pricing subtotal as a common percentage base", () => {
    const result = applyBillingAdjustments(18000, [
      adjustment({
        id: "discount",
        calculationType: "percent",
        amount: 1000,
      }),
      adjustment({
        id: "surcharge",
        kind: "surcharge",
        calculationType: "percent",
        amount: 500,
        createdAt: 2,
      }),
    ]);

    assert.deepEqual(
      result.adjustments.map((item) => ({
        id: item.id,
        amountCents: item.amountCents,
        percentageBaseCents: item.percentageBaseCents,
      })),
      [
        {
          id: "discount",
          amountCents: -1800,
          percentageBaseCents: 18000,
        },
        {
          id: "surcharge",
          amountCents: 900,
          percentageBaseCents: 18000,
        },
      ],
    );
    assert.equal(result.totalCents, 17100);
  });

  it("orders multiple adjustments deterministically and ignores voided rows", () => {
    const rows = [
      adjustment({ id: "later", createdAt: 2, amount: 200 }),
      adjustment({ id: "voided", status: "voided", createdAt: 3 }),
      adjustment({ id: "earlier", createdAt: 1, amount: 100 }),
    ];
    const forward = applyBillingAdjustments(10000, rows);
    const reverse = applyBillingAdjustments(10000, [...rows].reverse());

    assert.deepEqual(forward, reverse);
    assert.deepEqual(
      forward.adjustments.map((item) => item.id),
      ["earlier", "later"],
    );
    assert.equal(forward.totalCents, 9700);
  });
});

describe("billing adjustment query selection", () => {
  it("includes only the matching period and scope", () => {
    const rows = [
      adjustment(),
      adjustment({ id: "other-period", periodStart: "2026-07-01" }),
      adjustment({ id: "other-scope", scopeId: "household-2" }),
    ];

    assert.deepEqual(
      selectBillingAdjustments(
        rows,
        "household_tuition",
        "household-1",
        "2026-06-01",
        "2026-06-30",
      ).map((item) => item.id),
      ["adjustment-1"],
    );
  });

  it("uses inclusive overlap for recurring student adjustments", () => {
    const rows = [
      adjustment({
        scopeType: "student_tuition",
        scopeId: "student-1",
        periodStart: "2026-05-15",
        periodEnd: "2026-06-01",
      }),
      adjustment({
        id: "starts-last-day",
        scopeType: "student_tuition",
        scopeId: "student-1",
        periodStart: "2026-06-30",
        periodEnd: "2026-08-01",
      }),
      adjustment({
        id: "outside",
        scopeType: "student_tuition",
        scopeId: "student-1",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
      }),
    ];

    assert.equal(
      billingPeriodsOverlap(
        "2026-05-15",
        "2026-06-01",
        "2026-06-01",
        "2026-06-30",
      ),
      true,
    );
    assert.deepEqual(
      selectBillingAdjustments(
        rows,
        "student_tuition",
        "student-1",
        "2026-06-01",
        "2026-06-30",
      ).map((item) => item.id),
      ["adjustment-1", "starts-last-day"],
    );
  });
});

describe("targeted recurring adjustment math", () => {
  it("uses one common original base for percentages and full fixed amounts", () => {
    const result = applyTargetedBillingAdjustments(10000, [
      adjustment({
        id: "ten-percent",
        scopeType: "student_tuition",
        calculationType: "percent",
        amount: 1000,
      }),
      adjustment({
        id: "five-percent",
        scopeType: "student_tuition",
        calculationType: "percent",
        amount: 500,
        createdAt: 2,
      }),
      adjustment({
        id: "fixed",
        scopeType: "student_tuition",
        amount: 2500,
        createdAt: 3,
      }),
    ]);

    assert.deepEqual(
      result.adjustments.map((item) => item.amountCents),
      [-1000, -500, -2500],
    );
    assert.equal(result.totalCents, 6000);
  });

  it("records active adjustments as non-applicable on an empty subtotal", () => {
    const result = applyTargetedBillingAdjustments(0, [
      adjustment({ scopeType: "student_private_charges" }),
    ]);
    assert.equal(result.totalCents, 0);
    assert.deepEqual(result.adjustments[0], {
      ...adjustment({ scopeType: "student_private_charges" }),
      applicable: false,
      amountCents: 0,
      percentageBaseCents: undefined,
    });
  });

  it("requires void and recreate after dispatched usage", () => {
    assert.throws(
      () =>
        assertBillingAdjustmentFinanciallyEditable({
          status: "active",
          hasDispatchedUsage: true,
        }),
      /Void it and create a replacement/,
    );
    assert.doesNotThrow(() =>
      assertBillingAdjustmentFinanciallyEditable({
        status: "active",
        hasDispatchedUsage: false,
      }),
    );
  });
});
