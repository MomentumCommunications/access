import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBillingRunStripeInvoiceLines,
  dispatchBillingRunItemToStripe,
  resolveHouseholdStripeBillingTarget,
  resolveInvoiceCollectionMethod,
} from "../shared/stripe-invoice-dispatch.ts";

const payer = {
  id: "payer-1",
  householdId: "household-1",
  userId: "user-1",
  active: true,
  isPrimary: true,
  autopayEnabled: true,
  createdAt: 1,
};

describe("Stripe billing target resolution", () => {
  it("resolves the active primary payer, Stripe customer, and autopay policy", () => {
    assert.deepEqual(
      resolveHouseholdStripeBillingTarget({
        householdId: "household-1",
        householdExists: true,
        payers: [payer],
        users: [{ id: "user-1", stripeCustomerId: " cus_123 " }],
      }),
      {
        status: "ready",
        householdId: "household-1",
        billingResponsibleUserId: "user-1",
        stripeCustomerId: "cus_123",
        autopayEnabled: true,
      },
    );
  });

  it("fails clearly when the household, payer, or Stripe customer is missing", () => {
    assert.equal(
      resolveHouseholdStripeBillingTarget({
        householdId: "household-1",
        householdExists: false,
        payers: [],
        users: [],
      }).status,
      "missing_household",
    );
    assert.equal(
      resolveHouseholdStripeBillingTarget({
        householdId: "household-1",
        householdExists: true,
        payers: [],
        users: [],
      }).status,
      "missing_billing_responsibility",
    );
    assert.equal(
      resolveHouseholdStripeBillingTarget({
        householdId: "household-1",
        householdExists: true,
        payers: [payer],
        users: [{ id: "user-1" }],
      }).status,
      "missing_stripe_customer",
    );
  });
});

describe("Stripe invoice collection policy", () => {
  it("auto-charges only when autopay and a default payment method are ready", () => {
    assert.deepEqual(
      resolveInvoiceCollectionMethod({
        autopayEnabled: true,
        readiness: {
          status: "ready",
          hasUsableDefaultPaymentMethod: true,
        },
      }),
      {
        status: "ready",
        collectionMethod: "charge_automatically",
        reason: "autopay_enabled_with_payment_method",
      },
    );
  });

  it("sends an invoice when autopay is missing a default method or disabled", () => {
    assert.equal(
      resolveInvoiceCollectionMethod({
        autopayEnabled: true,
        readiness: {
          status: "ready",
          hasUsableDefaultPaymentMethod: false,
        },
      }).collectionMethod,
      "send_invoice",
    );
    assert.equal(
      resolveInvoiceCollectionMethod({
        autopayEnabled: false,
      }).collectionMethod,
      "send_invoice",
    );
  });

  it("blocks dispatch when Stripe readiness lookup fails", () => {
    assert.deepEqual(
      resolveInvoiceCollectionMethod({
        autopayEnabled: true,
        readiness: {
          status: "lookup_failed",
          reason: "Stripe timed out.",
        },
      }),
      {
        status: "blocked",
        reason: "stripe_payment_method_lookup_failed",
        message: "Stripe timed out.",
      },
    );
  });
});

const item = {
  id: "item-1",
  billingRunId: "run-1",
  householdId: "household-1",
  householdName: "Able Household",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  tuitionSubtotalCents: 12000,
  chargesSubtotalCents: 3500,
  sourceSummary: {
    tuitionStudentCount: 2,
    privateChargeCount: 1,
    perSessionChargeCount: 2,
  },
  adjustments: [
    {
      id: "adjustment-1",
      reasonCode: "scholarship" as const,
      note: "Summer award",
      amountCents: -1500,
    },
    {
      id: "adjustment-2",
      reasonCode: "surcharge" as const,
      amountCents: 250,
    },
  ],
};

describe("Stripe invoice line mapping", () => {
  it("creates compact tuition, charges, and explicit adjustment lines", () => {
    const lines = buildBillingRunStripeInvoiceLines({
      item,
      adjustments: item.adjustments,
    });
    assert.deepEqual(
      lines.map((line) => [line.key, line.amountCents]),
      [
        ["tuition", 12000],
        ["charges", 3500],
        ["adjustment-adjustment-1", -1500],
        ["adjustment-adjustment-2", 250],
      ],
    );
    assert.match(lines[0].description, /2 students/);
    assert.match(lines[1].description, /1 private, 2 per-session/);
    assert.match(lines[2].description, /Scholarship: Summer award/);
  });
});

describe("Stripe billing run item dispatch", () => {
  it("creates one invoice, all lines, and reconciliation metadata", async () => {
    const invoiceCalls: unknown[] = [];
    const lineCalls: unknown[] = [];
    const result = await dispatchBillingRunItemToStripe({
      item,
      target: {
        status: "ready",
        householdId: "household-1",
        billingResponsibleUserId: "user-1",
        stripeCustomerId: "cus_123",
        autopayEnabled: true,
      },
      readiness: {
        status: "ready",
        hasUsableDefaultPaymentMethod: true,
      },
      createInvoice: async (input) => {
        invoiceCalls.push(input);
        return {
          id: "in_123",
          status: "draft",
          customer: "cus_123",
        };
      },
      retrieveInvoice: async () => {
        throw new Error("should not retrieve");
      },
      createInvoiceLine: async (input) => {
        lineCalls.push(input);
      },
    });

    assert.equal(invoiceCalls.length, 1);
    assert.equal(lineCalls.length, 4);
    assert.deepEqual(result, {
      stripeInvoiceId: "in_123",
      stripeCustomerId: "cus_123",
      collectionMethod: "charge_automatically",
      autopayEnabled: true,
      lineCount: 4,
    });
    assert.deepEqual(
      (invoiceCalls[0] as { metadata: Record<string, string> }).metadata,
      {
        access_billing_run_id: "run-1",
        access_billing_run_item_id: "item-1",
        access_household_id: "household-1",
        access_period_start: "2026-07-01",
        access_period_end: "2026-07-31",
      },
    );
  });

  it("reuses an existing draft invoice instead of creating another", async () => {
    let created = 0;
    let retrieved = 0;
    const result = await dispatchBillingRunItemToStripe({
      item: { ...item, adjustments: [] },
      target: {
        status: "ready",
        householdId: "household-1",
        billingResponsibleUserId: "user-1",
        stripeCustomerId: "cus_123",
        autopayEnabled: false,
      },
      existingStripeInvoiceId: "in_existing",
      createInvoice: async () => {
        created += 1;
        return { id: "in_new" };
      },
      retrieveInvoice: async () => {
        retrieved += 1;
        return {
          id: "in_existing",
          status: "draft",
          customer: "cus_123",
        };
      },
      createInvoiceLine: async () => {},
    });

    assert.equal(created, 0);
    assert.equal(retrieved, 1);
    assert.equal(result.stripeInvoiceId, "in_existing");
    assert.equal(result.collectionMethod, "send_invoice");
  });

  it("surfaces a readiness failure before creating an invoice", async () => {
    let created = 0;
    await assert.rejects(
      dispatchBillingRunItemToStripe({
        item,
        target: {
          status: "ready",
          householdId: "household-1",
          billingResponsibleUserId: "user-1",
          stripeCustomerId: "cus_123",
          autopayEnabled: true,
        },
        readiness: {
          status: "lookup_failed",
          reason: "Stripe lookup failed.",
        },
        createInvoice: async () => {
          created += 1;
          return { id: "in_123" };
        },
        retrieveInvoice: async () => ({ id: "in_123" }),
        createInvoiceLine: async () => {},
      }),
      /Stripe lookup failed/,
    );
    assert.equal(created, 0);
  });
});
