import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BillingAdjustmentLike } from "../shared/billing-adjustments.ts";
import {
  billingRunSourcesOverlap,
  buildBillingRunBundles,
  buildBillingRunItemSnapshot,
  calculateBillingRunItemTotal,
  resolveBillingRunSourceAdjustments,
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

describe("recurring student adjustments in billing runs", () => {
  const components = {
    tuitionStudents: [
      {
        studentId: "student-a",
        studentName: "Alex Avery",
        baseTuitionCents: 12000,
      },
      {
        studentId: "student-b",
        studentName: "Blair Avery",
        baseTuitionCents: 10000,
      },
    ],
    privateStudents: [
      {
        studentId: "student-a",
        studentName: "Alex Avery",
        subtotalCents: 4000,
      },
    ],
    perSessionChargesCents: 3000,
    householdTuitionAdjustmentTotalCents: 0,
    siblingDiscount: {
      enabled: true,
      percentOffBasisPoints: 1000,
      appliesTo: "all_but_highest" as const,
    },
  };

  it("applies tuition adjustments before sibling math", () => {
    const result = resolveBillingRunSourceAdjustments({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      components,
      adjustments: [
        {
          id: "student-discount",
          scopeType: "student_tuition",
          scopeId: "student-a",
          periodStart: "2026-01-01",
          periodEnd: "2026-12-31",
          kind: "discount",
          calculationType: "fixed_cents",
          amount: 4000,
          reasonCode: "scholarship",
          status: "active",
          createdAt: 1,
        },
      ],
    });

    // Alex becomes $80, Blair remains $100, then Alex receives the 10% sibling discount.
    assert.equal(result.tuitionSubtotalCents, 21200);
    assert.equal(result.sourceAdjustmentTotalCents, -4000);
    assert.equal(result.subtotalAfterSourceAdjustmentsCents, 24200);
  });

  it("targets private charges only and excludes per-session charges", () => {
    const result = resolveBillingRunSourceAdjustments({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      components,
      adjustments: [
        {
          id: "private-half",
          scopeType: "student_private_charges",
          scopeId: "student-a",
          periodStart: "2026-06-30",
          periodEnd: "2026-07-01",
          kind: "discount",
          calculationType: "percent",
          amount: 5000,
          reasonCode: "goodwill",
          status: "active",
          createdAt: 1,
        },
      ],
    });

    assert.equal(result.chargesSubtotalCents, 7000);
    assert.equal(result.sourceAdjustmentTotalCents, -2000);
    assert.equal(
      result.sourceAdjustments[0].percentageBaseCents,
      4000,
    );
  });

  it("reports no applicable subtotal without changing totals", () => {
    const result = resolveBillingRunSourceAdjustments({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      components: {
        ...components,
        privateStudents: [
          {
            studentId: "student-a",
            studentName: "Alex Avery",
            subtotalCents: 0,
          },
        ],
      },
      adjustments: [
        {
          id: "private-fixed",
          scopeType: "student_private_charges",
          scopeId: "student-a",
          periodStart: "2026-01-01",
          periodEnd: "2026-12-31",
          kind: "discount",
          calculationType: "fixed_cents",
          amount: 2500,
          reasonCode: "waiver",
          status: "active",
          createdAt: 1,
        },
      ],
    });

    assert.equal(result.sourceAdjustments[0].applicable, false);
    assert.equal(result.sourceAdjustments[0].amountCents, 0);
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
    { id: "failed", status: "dispatch_failed" as const },
    { id: "unchecked", status: "draft" as const },
    { id: "sent", status: "dispatched" as const },
  ];

  it("dispatches checked draft and retryable failed items", () => {
    assert.deepEqual(
      selectBillingRunItemsForDispatch(items, [
        "checked",
        "failed",
        "sent",
      ]),
      [
        { id: "checked", status: "draft" },
        { id: "failed", status: "dispatch_failed" },
      ],
    );
  });

  it("filters dispatched items from the pending workflow", () => {
    assert.deepEqual(pendingBillingRunItems(items), [
      { id: "checked", status: "draft" },
      { id: "failed", status: "dispatch_failed" },
      { id: "unchecked", status: "draft" },
    ]);
  });
});
