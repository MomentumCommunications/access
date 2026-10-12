/** Explicit opt-in integration check. Uses Stripe test-mode objects only. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import Stripe from "stripe";
import { synchronizeStripeAutopay } from "../shared/stripe-autopay.ts";

const env = {
  ...(existsSync(".env") ? parse(readFileSync(".env")) : {}),
  ...(existsSync(".env.local") ? parse(readFileSync(".env.local")) : {}),
  ...process.env,
};
const key = env.STRIPE_SECRET_KEY || env.STRIPE_API_KEY || "";
if (!/^(sk|rk)_test_/.test(key)) {
  throw new Error(
    "This script requires a Stripe TEST key and refuses live keys.",
  );
}
const stripe = new Stripe(key, { timeout: 20_000, maxNetworkRetries: 1 });
const start = Math.floor(Date.UTC(2030, 0, 1) / 1000);
let clockId: string | undefined;
let productId: string | undefined;
let priceId: string | undefined;
let couponId: string | undefined;
let revision = 0;
const savedTerms: Record<string, number> = {};
const phaseFooter =
  "Manage payment settings at https://example.invalid/payments";
const defaultFooter = "Access sandbox invoice footer";
const readFooter = (settings: unknown) =>
  (settings as { footer?: string } | null)?.footer;
const log = (step: string) => console.log(step);
async function advance(time: number) {
  await stripe.testHelpers.testClocks.advance(clockId!, { frozen_time: time });
  for (let i = 0; i < 60; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId!);
    if (clock.status === "ready") return;
    assert.notEqual(clock.status, "internal_failure");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Test clock did not become ready within 60 seconds.");
}
async function invoices(customer: string) {
  const result: Stripe.Invoice[] = [];
  for await (const invoice of stripe.invoices.list({ customer, limit: 100 }))
    result.push(invoice);
  return result;
}
async function settle(customer: string) {
  for (let invoice of await invoices(customer)) {
    if (invoice.status === "draft")
      invoice = await stripe.invoices.finalizeInvoice(invoice.id);
    if (invoice.status === "open")
      await stripe.invoices.pay(invoice.id, { paid_out_of_band: true });
  }
}
try {
  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false);
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: start,
    name: "Access autopay integration check",
  });
  clockId = clock.id;
  const customer = await stripe.customers.create({
    test_clock: clock.id,
    name: "Access autopay sandbox fixture",
    email: "autopay-sandbox@example.invalid",
    metadata: { purpose: "autopay_integration_test" },
  });
  const method = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: method.id },
  });
  const product = await stripe.products.create({
    name: "Access autopay sandbox fixture",
  });
  productId = product.id;
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 1000,
    recurring: { interval: "month" },
  });
  priceId = price.id;
  const coupon = await stripe.coupons.create({
    percent_off: 10,
    duration: "forever",
    name: "Autopay fixture",
  });
  couponId = coupon.id;
  const standalone = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    collection_method: "send_invoice",
    days_until_due: 9,
  });
  const schedule = await stripe.subscriptionSchedules.create({
    customer: customer.id,
    start_date: start,
    end_behavior: "cancel",
    default_settings: {
      collection_method: "send_invoice",
      invoice_settings: { days_until_due: 14, ...{ footer: defaultFooter } },
    },
    phases: [
      {
        items: [{ price: price.id, quantity: 1 }],
        duration: { interval: "month", interval_count: 2 },
        collection_method: "send_invoice",
        invoice_settings: { days_until_due: 7, ...{ footer: phaseFooter } },
        discounts: [{ coupon: coupon.id }],
        metadata: { phase: "first" },
      },
      {
        items: [{ price: price.id, quantity: 2 }],
        duration: { interval: "month", interval_count: 3 },
        collection_method: "send_invoice",
        invoice_settings: { days_until_due: 21, ...{ footer: "" } },
        metadata: { phase: "second" },
      },
    ],
  });
  const sync = async (enabled: boolean) => {
    revision++;
    await synchronizeStripeAutopay({
      stripe,
      customerId: customer.id,
      enabled,
      savedTerms,
      checkpoint: async () => {},
      requestKey: (id, payload) =>
        `access-sandbox:${clock.id}:${revision}:${id}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`,
    });
  };
  const before = (await invoices(customer.id)).map((i) => ({
    id: i.id,
    method: i.collection_method,
    advance: i.auto_advance,
    status: i.status,
  }));
  await sync(true);
  assert.equal(
    (await stripe.subscriptions.retrieve(standalone.id)).collection_method,
    "charge_automatically",
  );
  const automatic = await stripe.subscriptionSchedules.retrieve(schedule.id);
  assert.equal(automatic.end_behavior, "cancel");
  assert.equal(
    readFooter(automatic.default_settings.invoice_settings),
    defaultFooter,
  );
  assert.equal(readFooter(automatic.phases[0].invoice_settings), phaseFooter);
  assert.equal(readFooter(automatic.phases[1].invoice_settings) ?? "", "");
  assert.deepEqual(
    automatic.phases.map((p) => [
      p.start_date,
      p.end_date,
      p.items[0].quantity,
      p.metadata,
    ]),
    schedule.phases.map((p) => [
      p.start_date,
      p.end_date,
      p.items[0].quantity,
      p.metadata,
    ]),
  );
  assert.equal(automatic.phases[0].discounts.length, 1);
  assert.ok(
    automatic.phases.every(
      (p) => p.collection_method === "charge_automatically",
    ),
  );
  assert.deepEqual(
    (await invoices(customer.id)).map((i) => ({
      id: i.id,
      method: i.collection_method,
      advance: i.auto_advance,
      status: i.status,
    })),
    before,
  );
  log(
    "PASS: automatic collection, phase preservation, and existing invoices unchanged",
  );
  await settle(customer.id);
  const feb = Math.floor(Date.UTC(2030, 1, 1) / 1000);
  await advance(feb);
  await advance(feb + 7200);
  const automaticInvoices = (await invoices(customer.id)).filter(
    (i) => i.created >= feb,
  );
  assert.equal(automaticInvoices.length, 2);
  assert.ok(
    automaticInvoices.every(
      (i) => i.collection_method === "charge_automatically",
    ),
  );
  log("PASS: next monthly invoices use automatic collection");
  await settle(customer.id);
  await sync(false);
  const manual = await stripe.subscriptionSchedules.retrieve(schedule.id);
  assert.equal(
    readFooter(manual.default_settings.invoice_settings),
    defaultFooter,
  );
  assert.equal(readFooter(manual.phases[0].invoice_settings), phaseFooter);
  assert.equal(readFooter(manual.phases[1].invoice_settings) ?? "", "");
  log("PASS: invoice footers preserved in both autopay directions");
  assert.deepEqual(
    manual.phases.map((p) => p.invoice_settings?.days_until_due),
    [7, 21],
  );
  assert.equal(
    (await stripe.subscriptions.retrieve(standalone.id)).days_until_due,
    9,
  );
  const march = Math.floor(Date.UTC(2030, 2, 1) / 1000);
  await advance(march);
  await advance(march + 7200);
  const manualInvoices = (await invoices(customer.id)).filter(
    (i) => i.created >= march,
  );
  assert.equal(manualInvoices.length, 2);
  assert.ok(
    manualInvoices.every((i) => i.collection_method === "send_invoice"),
  );
  assert.equal(
    (await stripe.subscriptions.retrieve(String(schedule.subscription)))
      .days_until_due,
    21,
  );
  log("PASS: manual terms restored and future phase invoices remain manual");
  await settle(customer.id);
  for (const month of [3, 4, 5]) {
    const timestamp = Math.floor(Date.UTC(2030, month, 1) / 1000);
    await advance(timestamp);
    await advance(timestamp + 7200);
    await settle(customer.id);
  }
  const ended = await stripe.subscriptionSchedules.retrieve(schedule.id);
  assert.equal(ended.status, "completed");
  assert.equal(
    (await stripe.subscriptions.retrieve(String(schedule.subscription))).status,
    "canceled",
  );
  const installments = (await invoices(customer.id)).filter(
    (i) =>
      i.parent?.subscription_details?.subscription === schedule.subscription,
  );
  assert.equal(installments.length, 5);
  log(
    "PASS: exactly five scheduled installments and configured cancellation preserved",
  );
} catch (error) {
  // Do not print credential-bearing transport details.
  console.error(
    error instanceof Stripe.errors.StripeError
      ? JSON.stringify({
          type: error.type,
          code: error.code,
          message:
            error.type === "StripeAuthenticationError"
              ? "Stripe test authentication failed."
              : error.message,
        })
      : error instanceof Error
        ? error.message
        : "Sandbox verification failed",
  );
  process.exitCode = 1;
} finally {
  const cleanup: [string, string | undefined, () => Promise<unknown>][] = [
    ["test clock", clockId, () => stripe.testHelpers.testClocks.del(clockId!)],
    ["price", priceId, () => stripe.prices.update(priceId!, { active: false })],
    [
      "product",
      productId,
      () => stripe.products.update(productId!, { active: false }),
    ],
    ["coupon", couponId, () => stripe.coupons.del(couponId!)],
  ];
  let cleaned = true;
  for (const [kind, id, remove] of cleanup) {
    if (!id) continue;
    try {
      await remove();
    } catch {
      cleaned = false;
      process.exitCode = 1;
      console.error(`Manual test-fixture cleanup needed: ${kind} ${id}`);
    }
  }
  if (clockId && cleaned)
    log(
      "Removed test clock/customer/subscriptions; archived fixture price/product.",
    );
}
