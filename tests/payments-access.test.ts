import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStripePortalSessionForAccess,
  resolvePaymentsAccess,
  validateStripePortalReturnUrl,
} from "../shared/payments-access.ts";

const household = { id: "household-1" };
const membership = {
  id: "membership-1",
  householdId: household.id,
  createdAt: 1,
};
const payer = {
  id: "payer-1",
  householdId: household.id,
  userId: "user-1",
  active: true,
  isPrimary: true,
  createdAt: 1,
};

function resolve(
  overrides: Partial<Parameters<typeof resolvePaymentsAccess>[0]> = {},
) {
  return resolvePaymentsAccess({
    userId: "user-1",
    stripeCustomerId: "cus_123",
    memberships: [membership],
    households: [household],
    payers: [payer],
    ...overrides,
  });
}

describe("payments access resolution", () => {
  it("resolves the active primary payer with Stripe to ready", () => {
    assert.deepEqual(resolve(), {
      status: "ready",
      householdId: "household-1",
      billingResponsibleUserId: "user-1",
      stripeCustomerId: "cus_123",
    });
  });

  it("resolves another household member as not billable", () => {
    assert.equal(resolve({ userId: "user-2" }).status, "not_billable");
  });

  it("reports a missing or dangling household", () => {
    assert.equal(resolve({ memberships: [] }).status, "missing_household");
    assert.equal(resolve({ households: [] }).status, "missing_household");
  });

  it("reports missing billing responsibility", () => {
    assert.equal(
      resolve({ payers: [] }).status,
      "missing_billing_responsibility",
    );
  });

  it("reports a missing Stripe customer", () => {
    assert.equal(
      resolve({ stripeCustomerId: undefined }).status,
      "missing_stripe_customer",
    );
  });

  it("selects household and payer rows deterministically", () => {
    const result = resolve({
      memberships: [
        { id: "later", householdId: "household-2", createdAt: 2 },
        membership,
      ],
      households: [household, { id: "household-2" }],
      payers: [
        {
          ...payer,
          id: "later-payer",
          householdId: "household-2",
          createdAt: 2,
        },
        payer,
      ],
    });
    assert.equal(result.householdId, "household-1");
  });
});

describe("Stripe portal return URLs", () => {
  it("accepts the app payments return route", () => {
    assert.equal(
      validateStripePortalReturnUrl(
        "https://access.example/payments?portal=returned",
      ),
      "https://access.example/payments?portal=returned",
    );
  });

  it("rejects unrelated and malformed return URLs", () => {
    assert.throws(() => validateStripePortalReturnUrl("not a url"));
    assert.throws(() =>
      validateStripePortalReturnUrl("https://access.example/home"),
    );
  });
});

describe("Stripe portal session creation", () => {
  it("creates a customer-specific portal session for ready access", async () => {
    const calls: unknown[] = [];
    const result = await createStripePortalSessionForAccess({
      access: resolve(),
      returnUrl: "https://access.example/payments?portal=returned",
      createSession: async (args) => {
        calls.push(args);
        return { url: "https://billing.stripe.com/p/session/test" };
      },
    });

    assert.deepEqual(calls, [
      {
        customer: "cus_123",
        returnUrl:
          "https://access.example/payments?portal=returned",
      },
    ]);
    assert.equal(
      result.url,
      "https://billing.stripe.com/p/session/test",
    );
  });

  it("does not call Stripe for non-ready access", async () => {
    let called = false;
    await assert.rejects(() =>
      createStripePortalSessionForAccess({
        access: resolve({ userId: "user-2" }),
        returnUrl: "https://access.example/payments?portal=returned",
        createSession: async () => {
          called = true;
          return { url: "unexpected" };
        },
      }),
    );
    assert.equal(called, false);
  });

  it("surfaces Stripe failures and missing portal URLs", async () => {
    await assert.rejects(
      () =>
        createStripePortalSessionForAccess({
          access: resolve(),
          returnUrl:
            "https://access.example/payments?portal=returned",
          createSession: async () => {
            throw new Error("Stripe unavailable");
          },
        }),
      /Stripe unavailable/,
    );
    await assert.rejects(
      () =>
        createStripePortalSessionForAccess({
          access: resolve(),
          returnUrl:
            "https://access.example/payments?portal=returned",
          createSession: async () => ({ url: null }),
        }),
      /did not return a portal URL/,
    );
  });
});
