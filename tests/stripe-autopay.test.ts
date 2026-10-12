import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  autopayFailure,
  AutopaySupersededError,
  preservePhase,
  synchronizeStripeAutopay,
  webhookCustomer,
} from "../shared/stripe-autopay.ts";

function phase(start = 100, extra = {}) {
  return {
    start_date: start,
    end_date: start + 100,
    items: [
      {
        price: "price_comp",
        quantity: 1,
        discounts: [],
        metadata: { student: "one" },
        tax_rates: [{ id: "txr_item" }],
      },
    ],
    collection_method: "send_invoice",
    invoice_settings: { days_until_due: 7 },
    discounts: [{ coupon: "coupon_discount" }],
    currency: "usd",
    default_tax_rates: [{ id: "txr_default" }],
    proration_behavior: "create_prorations",
    metadata: { season: "2026" },
    add_invoice_items: [],
    ...extra,
  } as unknown as Stripe.SubscriptionSchedule.Phase;
}
function schedule(extra = {}) {
  return {
    id: "sched_1",
    status: "active",
    current_phase: { start_date: 100, end_date: 200 },
    default_settings: {
      collection_method: "send_invoice",
      invoice_settings: { days_until_due: 14 },
    },
    phases: [
      phase(0),
      phase(),
      phase(200, { invoice_settings: { days_until_due: 21 } }),
    ],
    end_behavior: "cancel",
    ...extra,
  } as unknown as Stripe.SubscriptionSchedule;
}
function subscription(id = "sub_1", extra = {}) {
  return {
    id,
    status: "active",
    collection_method: "send_invoice",
    days_until_due: 7,
    ...extra,
  } as unknown as Stripe.Subscription;
}
function fixture({
  subscriptions = [subscription()],
  schedules = [] as Stripe.SubscriptionSchedule[],
  customerMethod = "pm_1" as string | null,
  enabled = true,
} = {}) {
  const writes: {
    id: string;
    payload: Record<string, unknown>;
    options: unknown;
    kind: string;
  }[] = [];
  const terms: Record<string, number> = {};
  const reads: string[] = [];
  const stripe = {
    customers: {
      retrieve: async () => ({
        id: "cus_1",
        invoice_settings: { default_payment_method: customerMethod },
      }),
    },
    paymentMethods: {
      retrieve: async (id: string) => {
        reads.push(id);
        return { id, customer: "cus_1" };
      },
    },
    subscriptions: {
      list: async function* (args: { customer: string; limit: number }) {
        assert.equal(args.customer, "cus_1");
        assert.equal(args.limit, 100);
        for (const sub of subscriptions) yield sub;
      },
      update: async (
        id: string,
        payload: Record<string, unknown>,
        options: unknown,
      ) => {
        writes.push({ id, payload, options, kind: "subscription" });
        Object.assign(subscriptions.find((s) => s.id === id)!, payload);
      },
    },
    subscriptionSchedules: {
      list: async function* () {
        for (const sched of schedules) yield sched;
      },
      update: async (
        id: string,
        payload: Record<string, unknown>,
        options: unknown,
      ) => {
        writes.push({ id, payload, options, kind: "schedule" });
        Object.assign(schedules.find((s) => s.id === id)!, payload);
      },
    },
  };
  const checkpoints: Record<string, number>[] = [];
  const run = (
    overrides: Partial<Parameters<typeof synchronizeStripeAutopay>[0]> = {},
  ) =>
    synchronizeStripeAutopay({
      stripe: stripe as unknown as Stripe,
      customerId: "cus_1",
      enabled,
      savedTerms: terms,
      checkpoint: async (saved) => {
        checkpoints.push({ ...saved });
      },
      requestKey: (id) => `test:${id}`,
      ...overrides,
    });
  return { stripe, terms, writes, run, checkpoints, reads };
}

describe("Stripe subscription autopay", () => {
  it("updates every page of subscriptions without any invoice/payment APIs", async () => {
    const f = fixture({
      subscriptions: Array.from({ length: 205 }, (_, i) =>
        subscription(`sub_${i}`),
      ),
    });
    await f.run();
    assert.equal(f.writes.length, 205);
    assert.deepEqual(f.writes[0].payload, {
      collection_method: "charge_automatically",
    });
    assert.equal(f.checkpoints[0].sub_0, 7);
    assert.deepEqual(f.reads, ["pm_1"]);
    await f.run();
    assert.equal(
      f.writes.length,
      205,
      "webhook reconciliation must not write again",
    );
  });
  it("falls back to invoices without a method and preserves existing terms", async () => {
    const f = fixture({
      customerMethod: null,
      subscriptions: [
        subscription("sub_1", {
          collection_method: "charge_automatically",
          days_until_due: null,
        }),
        subscription("sub_2", { days_until_due: 30 }),
      ],
    });
    await f.run();
    assert.deepEqual(
      f.writes.map((w) => w.payload),
      [{ collection_method: "send_invoice", days_until_due: 14 }],
    );
    assert.equal(f.terms.sub_2, 30);
  });
  it("turns autopay off without requiring a payment-method lookup", async () => {
    const f = fixture({
      subscriptions: [
        subscription("sub_1", { collection_method: "charge_automatically" }),
      ],
    });
    f.stripe.paymentMethods.retrieve = async () => {
      throw new Error("must not look up payment methods");
    };
    await f.run({ enabled: false });
    assert.equal(f.writes[0].payload.collection_method, "send_invoice");
  });
  it("surfaces lookup failures without treating them as missing payment methods", async () => {
    const f = fixture();
    f.stripe.paymentMethods.retrieve = async () => {
      throw { statusCode: 503 };
    };
    await assert.rejects(f.run());
    assert.equal(f.writes.length, 0);
  });
  it("restores saved terms after Stripe clears terms on automatic charging", async () => {
    const sub = subscription();
    const f = fixture({ subscriptions: [sub] });
    await f.run();
    sub.days_until_due = null;
    await f.run({ enabled: false });
    assert.deepEqual(f.writes[1].payload, {
      collection_method: "send_invoice",
      days_until_due: 7,
    });
    sub.days_until_due = 21;
    await f.run();
    sub.days_until_due = null;
    await f.run({ enabled: false });
    assert.equal(f.writes.at(-1)!.payload.days_until_due, 21);
  });
  it("honors a subscription default method without a customer default", async () => {
    const f = fixture({
      customerMethod: null,
      subscriptions: [
        subscription("sub_1", { default_payment_method: "pm_subscription" }),
      ],
    });
    await f.run();
    assert.equal(f.writes[0].payload.collection_method, "charge_automatically");
  });
  it("does not autocharge a detached or foreign default method", async () => {
    const f = fixture({
      subscriptions: [
        subscription("sub_1", { collection_method: "charge_automatically" }),
      ],
    });
    f.stripe.paymentMethods.retrieve = async (id) => ({
      id,
      customer: "cus_other",
    });
    await f.run();
    assert.equal(f.writes[0].payload.collection_method, "send_invoice");
  });
  it("preserves phase dates, quantities, discounts, taxes, metadata and end behavior", async () => {
    const sched = schedule();
    const f = fixture({
      schedules: [sched],
      subscriptions: [subscription("sub_1", { schedule: "sched_1" })],
    });
    await f.run();
    assert.equal(f.writes.length, 1);
    const payload = f.writes[0]
      .payload as Stripe.SubscriptionScheduleUpdateParams;
    assert.equal(f.writes[0].kind, "schedule");
    assert.equal(payload.end_behavior, undefined);
    assert.equal(sched.end_behavior, "cancel");
    assert.equal(payload.proration_behavior, "none");
    assert.deepEqual(
      payload.phases!.map((p) => [p.start_date, p.end_date]),
      [
        [100, 200],
        [200, 300],
      ],
    );
    assert.deepEqual(payload.phases![0].items, [
      {
        price: "price_comp",
        quantity: 1,
        discounts: [],
        metadata: { student: "one" },
        tax_rates: ["txr_item"],
      },
    ]);
    assert.deepEqual(payload.phases![0].default_tax_rates, ["txr_default"]);
    await f.run();
    assert.equal(
      f.writes.length,
      1,
      "schedule webhook reconciliation must not write again",
    );
    assert.deepEqual(payload.phases![0].discounts, [
      { coupon: "coupon_discount" },
    ]);
    assert.deepEqual(payload.phases![0].metadata, { season: "2026" });
    assert.equal(payload.phases![0].proration_behavior, "create_prorations");
    // Stripe clears invoice terms after switching to automatic charging.
    // Stripe can retain default terms while clearing phase-specific terms.
    sched.default_settings.invoice_settings.days_until_due = 14;
    for (const p of sched.phases) p.invoice_settings!.days_until_due = null;
    await f.run({ enabled: false });
    const back = f.writes[1].payload as Stripe.SubscriptionScheduleUpdateParams;
    assert.equal(back.phases![0].invoice_settings!.days_until_due, 7);
    assert.equal(back.phases![1].invoice_settings!.days_until_due, 21);
    assert.deepEqual(back.phases![0].items[0].tax_rates, ["txr_item"]);
    assert.deepEqual(back.phases![0].default_tax_rates, ["txr_default"]);
    assert.equal(back.default_settings!.invoice_settings!.days_until_due, 14);
  });
  it("preserves Dashboard invoice footers on defaults and every phase across autopay changes", async () => {
    const footer = "Manage invoices at https://example.invalid/payments";
    const sched = schedule({
      default_settings: {
        collection_method: "send_invoice",
        invoice_settings: { days_until_due: 14, footer: "Default footer" },
      },
      phases: [
        phase(100, { invoice_settings: { days_until_due: 7, footer } }),
        phase(200, { invoice_settings: { days_until_due: 21, footer: "" } }),
        phase(300, { invoice_settings: { days_until_due: 14, footer: null } }),
      ],
    });
    const f = fixture({ schedules: [sched], subscriptions: [] });
    for (const enabled of [true, false]) {
      await f.run({ enabled });
      const payload = f.writes.at(-1)!.payload as {
        default_settings: { invoice_settings: { footer?: string } };
        phases: {
          invoice_settings: { footer?: string; days_until_due?: number };
        }[];
      };
      assert.equal(
        payload.default_settings.invoice_settings.footer,
        "Default footer",
      );
      assert.equal(payload.phases[0].invoice_settings.footer, footer);
      assert.equal(payload.phases[1].invoice_settings.footer, "");
      assert.equal("footer" in payload.phases[2].invoice_settings, false);
      if (!enabled)
        assert.deepEqual(
          payload.phases.map((p) => p.invoice_settings.days_until_due),
          [7, 21, 14],
        );
    }
  });
  it("includes future schedules with no subscription yet", async () => {
    const f = fixture({
      subscriptions: [],
      schedules: [schedule({ status: "not_started", current_phase: null })],
    });
    await f.run();
    assert.equal((f.writes[0].payload.phases as unknown[]).length, 3);
  });
  it("skips ended subscriptions and surfaces unsupported states without restarting them", async () => {
    const f = fixture({
      subscriptions: [
        subscription("ended", { status: "canceled" }),
        subscription("paused", { status: "paused" }),
        subscription("valid"),
      ],
    });
    await assert.rejects(f.run(), /paused/);
    assert.deepEqual(
      f.writes.map((w) => w.id),
      ["valid"],
    );
  });
  it("blocks unknown phase settings and one-off charges without mutating the schedule", async () => {
    const f = fixture({
      subscriptions: [],
      schedules: [
        schedule({ phases: [phase(100, { future_billing_field: true })] }),
      ],
    });
    await assert.rejects(f.run(), /unsupported schedule/);
    assert.equal(f.writes.length, 0);
    assert.throws(
      () =>
        preservePhase(
          phase(100, { add_invoice_items: [{ price: "one_off" }] }),
        ),
      /additional invoice items/,
    );
  });
  it("refuses unknown nested financial settings instead of dropping them", () => {
    assert.throws(
      () =>
        preservePhase(
          phase(100, {
            items: [
              { price: "price_comp", discounts: [], new_financial_setting: 15 },
            ],
          }),
        ),
      /unsupported schedule/,
    );
    assert.throws(
      () =>
        preservePhase(
          phase(100, {
            invoice_settings: { days_until_due: 7, new_setting: true },
          }),
        ),
      /invoice_settings\.new_setting/,
    );
  });
  it("stops writes when a newer preference supersedes a worker", async () => {
    const f = fixture({
      subscriptions: [subscription("one"), subscription("two")],
    });
    let count = 0;
    await assert.rejects(
      f.run({
        checkpoint: async () => {
          if (++count === 2) throw new AutopaySupersededError();
        },
      }),
      AutopaySupersededError,
    );
    assert.deepEqual(
      f.writes.map((w) => w.id),
      ["one"],
    );
  });
  it("retries a partial failure without rewriting already synchronized subscriptions", async () => {
    const f = fixture({
      subscriptions: [subscription("one"), subscription("two")],
    });
    const update = f.stripe.subscriptions.update;
    let failed = false;
    f.stripe.subscriptions.update = async (...args) => {
      if (args[0] === "two" && !failed) {
        failed = true;
        throw { statusCode: 503, message: "secret" };
      }
      return update(...args);
    };
    await assert.rejects(f.run());
    await f.run();
    assert.deepEqual(
      f.writes.map((w) => w.id),
      ["one", "two"],
    );
    assert.equal(
      autopayFailure({ statusCode: 503, message: "secret" }).message.includes(
        "secret",
      ),
      false,
    );
    assert.equal(autopayFailure({ statusCode: 429 }).retryable, true);
    assert.equal(autopayFailure({ statusCode: 400 }).retryable, false);
  });
  it("extracts detached payment method ownership from previous attributes", () => {
    assert.equal(
      webhookCustomer({
        type: "payment_method.detached",
        data: {
          object: { customer: null },
          previous_attributes: { customer: "cus_old" },
        },
      } as unknown as Stripe.Event),
      "cus_old",
    );
    assert.equal(
      webhookCustomer({
        type: "invoice.created",
        data: { object: { customer: "cus_1" } },
      } as unknown as Stripe.Event),
      undefined,
    );
  });
});
