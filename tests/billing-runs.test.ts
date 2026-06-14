import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BillingAdjustmentLike } from "../shared/billing-adjustments.ts";
import {
  billingRunSourcesOverlap,
  buildBillingRunBundles,
  buildBillingRunItemSnapshot,
  calculateBillingRunItemTotal,
  pendingBillingRunItems,
  resolveBillingRunGeneration,
  selectBillingRunItemsForDispatch,
} from "../shared/billing-runs.ts";

const tuition = [
  {
    householdId: "household-a",
    householdName: "Able family",
    householdLinkSource: "household",
    totalTuitionCents: 12000,
    studentCount: 2,
    hasIncompleteTuition: false,
  },
];

const charges = [
  {
    householdId: "household-a",
    householdName: "Able family",
    householdLinkSource: "household",
    sourceType: "private" as const,
    sourceId: "private-1",
    amountCents: 4000,
  },
  {
    householdId: "household-b",
    householdName: "Baker family",
    householdLinkSource: "household",
    sourceType: "per_session" as const,
    sourceId: "signup-group-1",
    amountCents: 2500,
  },
];

describe("billing run bundle generation", () => {
  it("generates tuition-only household items", () => {
    const result = buildBillingRunBundles({
      sourceMode: "tuition",
      tuitionHouseholds: tuition,
      charges,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].householdId, "household-a");
    assert.equal(result[0].tuitionSubtotalCents, 12000);
    assert.equal(result[0].chargesSubtotalCents, 0);
    assert.equal(result[0].subtotalBeforeRunAdjustmentsCents, 12000);
  });

  it("generates charges-only items including charge-only households", () => {
    const result = buildBillingRunBundles({
      sourceMode: "charges",
      tuitionHouseholds: tuition,
      charges,
    });

    assert.deepEqual(
      result.map((row) => [row.householdId, row.chargesSubtotalCents]),
      [
        ["household-a", 4000],
        ["household-b", 2500],
      ],
    );
  });

  it("combines tuition and charges by household", () => {
    const result = buildBillingRunBundles({
      sourceMode: "both",
      tuitionHouseholds: tuition,
      charges,
    });

    assert.deepEqual(
      result.map((row) => ({
        householdId: row.householdId,
        tuition: row.tuitionSubtotalCents,
        charges: row.chargesSubtotalCents,
        total: row.subtotalBeforeRunAdjustmentsCents,
      })),
      [
        {
          householdId: "household-a",
          tuition: 12000,
          charges: 4000,
          total: 16000,
        },
        {
          householdId: "household-b",
          tuition: 0,
          charges: 2500,
          total: 2500,
        },
      ],
    );
  });

  it("keeps unpriced charge references visible without inventing an amount", () => {
    const [result] = buildBillingRunBundles({
      sourceMode: "charges",
      tuitionHouseholds: [],
      charges: [{ ...charges[0], amountCents: undefined }],
    });

    assert.equal(result.chargesSubtotalCents, 0);
    assert.equal(result.sourceSummary.unpricedChargeCount, 1);
    assert.deepEqual(result.sourceReferences.privateChargeIds, ["private-1"]);
  });

  it("is deterministic regardless of input order", () => {
    assert.deepEqual(
      buildBillingRunBundles({
        sourceMode: "both",
        tuitionHouseholds: tuition,
        charges,
      }),
      buildBillingRunBundles({
        sourceMode: "both",
        tuitionHouseholds: [...tuition].reverse(),
        charges: [...charges].reverse(),
      }),
    );
  });

  it("includes the selected period in the persisted item snapshot", () => {
    const [bundle] = buildBillingRunBundles({
      sourceMode: "tuition",
      tuitionHouseholds: tuition,
      charges: [],
    });

    const snapshot = buildBillingRunItemSnapshot(
      bundle,
      "2026-07-01",
      "2026-07-31",
    );

    assert.equal(snapshot.periodStart, "2026-07-01");
    assert.equal(snapshot.periodEnd, "2026-07-31");
  });
});

describe("billing run adjustment math", () => {
  it("applies run-stage adjustments after reviewed source totals", () => {
    const adjustments: BillingAdjustmentLike[] = [
      {
        id: "discount",
        scopeType: "billing_run_item",
        scopeId: "item-1",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        kind: "discount",
        calculationType: "percent",
        amount: 1000,
        reasonCode: "goodwill",
        status: "active",
        createdAt: 1,
      },
      {
        id: "fee",
        scopeType: "billing_run_item",
        scopeId: "item-1",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        kind: "surcharge",
        calculationType: "fixed_cents",
        amount: 500,
        reasonCode: "surcharge",
        status: "active",
        createdAt: 2,
      },
    ];

    const result = calculateBillingRunItemTotal(20000, adjustments);
    assert.equal(result.adjustmentTotalCents, -1500);
    assert.equal(result.totalCents, 18500);
  });
});

describe("billing run duplicate generation", () => {
  it("reuses a draft and does not create a duplicate", () => {
    assert.deepEqual(
      resolveBillingRunGeneration([{ id: "draft", status: "draft" }]),
      {
        action: "reuse_draft",
        run: { id: "draft", status: "draft" },
      },
    );
  });

  it("treats an already-dispatched mode as immutable history", () => {
    assert.deepEqual(
      resolveBillingRunGeneration([
        { id: "sent", status: "dispatched" },
      ]),
      {
        action: "already_dispatched",
        run: { id: "sent", status: "dispatched" },
      },
    );
  });

  it("allows separate source runs but blocks overlapping source modes", () => {
    assert.equal(billingRunSourcesOverlap("tuition", "charges"), false);
    assert.equal(billingRunSourcesOverlap("tuition", "both"), true);
    assert.equal(billingRunSourcesOverlap("charges", "both"), true);
    assert.equal(billingRunSourcesOverlap("both", "both"), true);
  });
});

describe("billing run dispatch selection", () => {
  const items = [
    { id: "checked", status: "draft" as const },
    { id: "unchecked", status: "draft" as const },
    { id: "sent", status: "dispatched" as const },
  ];

  it("dispatches only checked draft items", () => {
    assert.deepEqual(
      selectBillingRunItemsForDispatch(items, ["checked", "sent"]),
      [{ id: "checked", status: "draft" }],
    );
  });

  it("filters dispatched items from the pending workflow", () => {
    assert.deepEqual(pendingBillingRunItems(items), [
      { id: "checked", status: "draft" },
      { id: "unchecked", status: "draft" },
    ]);
  });
});
