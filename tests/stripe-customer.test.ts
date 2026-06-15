import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeStripeBackedProfileSetup,
  ensureStripeCustomerForUser,
  stripeCustomerCreateInput,
  stripeCustomerIdempotencyKey,
} from "../shared/stripe-customer.ts";

describe("Stripe customer setup", () => {
  it("builds core Stripe identity fields from the user", () => {
    assert.deepEqual(
      stripeCustomerCreateInput({
        id: "user-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: ["ada@example.com"],
        phone: "555-0100",
      }),
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "555-0100",
        metadata: { accessUserId: "user-1" },
      },
    );
    assert.equal(
      stripeCustomerIdempotencyKey("user-1"),
      "access-user-user-1",
    );
  });

  it("creates and persists a customer when missing", async () => {
    const calls: string[] = [];
    const result = await ensureStripeCustomerForUser({
      user: { id: "user-1", firstName: "Ada", lastName: "Lovelace" },
      createCustomer: async (_input, idempotencyKey) => {
        calls.push(`create:${idempotencyKey}`);
        return { id: "cus_123" };
      },
      persistStripeCustomerIdIfMissing: async (customerId) => {
        calls.push(`persist:${customerId}`);
        return customerId;
      },
    });

    assert.deepEqual(result, {
      stripeCustomerId: "cus_123",
      created: true,
    });
    assert.deepEqual(calls, [
      "create:access-user-user-1",
      "persist:cus_123",
    ]);
  });

  it("does not create another customer when already linked", async () => {
    let createCount = 0;
    const result = await ensureStripeCustomerForUser({
      user: { id: "user-1", stripeCustomerId: "cus_existing" },
      createCustomer: async () => {
        createCount += 1;
        return { id: "cus_duplicate" };
      },
      persistStripeCustomerIdIfMissing: async () => "cus_duplicate",
    });

    assert.equal(createCount, 0);
    assert.deepEqual(result, {
      stripeCustomerId: "cus_existing",
      created: false,
    });
  });

  it("does not persist a bogus ID when Stripe fails", async () => {
    let persistCount = 0;
    await assert.rejects(
      ensureStripeCustomerForUser({
        user: { id: "user-1" },
        createCustomer: async () => {
          throw new Error("Stripe unavailable");
        },
        persistStripeCustomerIdIfMissing: async () => {
          persistCount += 1;
          return "cus_never";
        },
      }),
      /Stripe unavailable/,
    );
    assert.equal(persistCount, 0);
  });

  it("rejects an empty Stripe response before persistence", async () => {
    let persistCount = 0;
    await assert.rejects(
      ensureStripeCustomerForUser({
        user: { id: "user-1" },
        createCustomer: async () => ({ id: "" }),
        persistStripeCustomerIdIfMissing: async () => {
          persistCount += 1;
          return "cus_never";
        },
      }),
      /did not return/,
    );
    assert.equal(persistCount, 0);
  });
});

describe("Stripe-backed onboarding profile sequencing", () => {
  it("advances only after app state and Stripe setup succeed", async () => {
    const calls: string[] = [];
    await completeStripeBackedProfileSetup({
      saveProfile: async () => {
        calls.push("profile");
        return "user-1";
      },
      ensureStripeCustomer: async () => {
        calls.push("stripe");
        return "cus_123";
      },
      completeProfileStep: async (userId) => {
        calls.push(`advance:${userId}`);
      },
    });

    assert.deepEqual(calls, ["profile", "stripe", "advance:user-1"]);
  });

  it("keeps app state but does not advance when Stripe fails", async () => {
    const calls: string[] = [];
    await assert.rejects(
      completeStripeBackedProfileSetup({
        saveProfile: async () => {
          calls.push("profile");
          return "user-1";
        },
        ensureStripeCustomer: async () => {
          calls.push("stripe");
          throw new Error("Stripe unavailable");
        },
        completeProfileStep: async () => {
          calls.push("advance");
        },
      }),
      /Stripe unavailable/,
    );

    assert.deepEqual(calls, ["profile", "stripe"]);
  });
});
