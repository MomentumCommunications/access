import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getFunctionName } from "convex/server";
import Stripe from "stripe";

const stripeStub =
  "data:text/javascript," +
  encodeURIComponent(`
  import Stripe from ${JSON.stringify(import.meta.resolve("stripe"))};
  export const verification = new Stripe("sk_test_local_fixture_only");
  let client = verification;
  export function getStripeClient() { return client; }
  export function setClient(value) { client = value; }
`);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./lib/stripe") return nextResolve(stripeStub, context);
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && context.parentURL) {
        for (const extension of [".ts", ".js"]) {
          const url = new URL(specifier + extension, context.parentURL);
          if (existsSync(fileURLToPath(url)))
            return nextResolve(url.href, context);
        }
      }
      throw error;
    }
  },
});
const data = await import("../convex/stripeAutopayData.ts");
const payments = await import("../convex/paymentsData.ts");
const billing = await import("../convex/billing.ts");
const actions = await import("../convex/stripeAutopay.ts");
const transport = await import(stripeStub);

type Row = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
  table: string;
};
type Claim = {
  revision: number;
  enabled: boolean;
  payerId: string;
  terms: Record<string, number>;
};
function fixture() {
  const rows: Row[] = [];
  const jobs: { delay: number; name: string; args: unknown }[] = [];
  let now = 1_800_000_000_000;
  let actor: string | null = "member";
  let sequence = 0;
  const insert = (
    table: string,
    value: Record<string, unknown>,
    id = `${table}:${++sequence}`,
  ) => {
    rows.push({ ...value, _id: id, _creationTime: ++sequence, table });
    return id;
  };
  insert("users", { stripeCustomerId: "cus_1", role: "member" }, "member");
  insert("users", { role: "admin" }, "admin");
  insert("users", { role: "member" }, "other");
  insert("households", { name: "Family" }, "household");
  insert("householdMembers", { householdId: "household", userId: "member" });
  insert(
    "householdPayers",
    {
      householdId: "household",
      userId: "member",
      active: true,
      isPrimary: true,
      autopayEnabled: false,
      createdAt: 1,
    },
    "payer",
  );
  const db = {
    get: async (id: string) => rows.find((r) => r._id === id) ?? null,
    insert: async (table: string, value: Record<string, unknown>) =>
      insert(table, value),
    patch: async (id: string, value: Record<string, unknown>) => {
      Object.assign(rows.find((r) => r._id === id)!, value);
    },
    delete: async (id: string) => {
      rows.splice(
        rows.findIndex((r) => r._id === id),
        1,
      );
    },
    query(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const range = {
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return range;
        },
        lt: (key: string, value: number) => {
          filters.push((r) => Number(r[key]) < value);
          return range;
        },
      };
      const matching = () =>
        rows.filter((r) => r.table === table && filters.every((f) => f(r)));
      const query = {
        withIndex: (_index: string, filter?: (q: typeof range) => unknown) => {
          filter?.(range);
          return query;
        },
        collect: async () => matching(),
        first: async () => matching()[0] ?? null,
        unique: async () => {
          const r = matching();
          assert.ok(r.length <= 1);
          return r[0] ?? null;
        },
        take: async (limit: number) => matching().slice(0, limit),
        paginate: async ({
          cursor,
          numItems,
        }: {
          cursor: string | null;
          numItems: number;
        }) => {
          const start = Number(cursor ?? 0);
          const all = matching();
          return {
            page: all.slice(start, start + numItems),
            isDone: start + numItems >= all.length,
            continueCursor: String(start + numItems),
          };
        },
      };
      return query;
    },
  };
  const ctx = {
    db,
    auth: {
      getUserIdentity: async () =>
        actor ? { subject: `${actor}|session` } : null,
    },
    scheduler: {
      runAfter: async (
        delay: number,
        ref: Parameters<typeof getFunctionName>[0],
        args: unknown,
      ) => {
        jobs.push({ delay, name: getFunctionName(ref), args });
      },
    },
    runMutation: async (
      ref: Parameters<typeof getFunctionName>[0],
      args: unknown,
    ) => {
      const [module, name] = getFunctionName(ref).split(":");
      assert.equal(module, "stripeAutopayData");
      return call(data[name as keyof typeof data], args);
    },
  };
  async function call<T = unknown>(
    fn: unknown,
    args: unknown = {},
  ): Promise<T> {
    const original = Date.now;
    Date.now = () => now;
    try {
      return await (
        fn as { _handler: (ctx: unknown, args: unknown) => Promise<T> }
      )._handler(ctx, args);
    } finally {
      Date.now = original;
    }
  }
  const row = () => rows.find((r) => r.table === "stripeAutopaySync")!;
  const claim = () => call<Claim | null>(data.claim, { customerId: "cus_1" });
  return {
    rows,
    jobs,
    insert,
    call,
    row,
    claim,
    actor: (value: string | null) => {
      actor = value;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("autopay authorization and durable work", () => {
  it("enqueues a preference change from both authorized controls", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    assert.equal(f.rows.find((r) => r._id === "payer")!.autopayEnabled, true);
    assert.equal(f.row().revision, 1);
    assert.equal(f.jobs[0].name, "stripeAutopay:syncCustomer");
    f.actor("admin");
    await f.call(billing.adminSetHouseholdPayerAutopay, {
      householdPayerId: "payer",
      enabled: false,
    });
    assert.equal(f.row().revision, 2);
    const view = await f.call<{ autopaySync: { status: string } }>(
      billing.adminGetAccountHousehold,
      { userId: "member" },
    );
    assert.equal(view.autopaySync.status, "pending");
  });
  it("rejects unauthorized member, admin and retry operations without queueing work", async () => {
    const f = fixture();
    f.actor("other");
    await assert.rejects(
      f.call(payments.setCurrentUserAutopay, { enabled: true }),
    );
    await assert.rejects(f.call(payments.retryCurrentUserAutopay));
    await assert.rejects(
      f.call(billing.adminSetHouseholdPayerAutopay, {
        householdPayerId: "payer",
        enabled: true,
      }),
    );
    await assert.rejects(
      f.call(data.adminRetry, { householdPayerId: "payer" }),
    );
    assert.equal(f.jobs.length, 0);
    f.actor(null);
    await assert.rejects(
      f.call(payments.setCurrentUserAutopay, { enabled: true }),
    );
  });
  it("serializes customer workers and invalidates old revisions after a rapid toggle", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    const first = (await f.claim())!;
    assert.equal(await f.claim(), null);
    await f.call(payments.setCurrentUserAutopay, { enabled: false });
    assert.equal(
      f.jobs.length,
      1,
      "running worker owns the customer until it exits",
    );
    assert.equal(
      await f.call(data.checkpoint, {
        customerId: "cus_1",
        ...first,
        terms: { sub_1: 7 },
      }),
      false,
    );
    await f.call(data.finish, {
      customerId: "cus_1",
      revision: first.revision,
      superseded: true,
    });
    const latest = (await f.claim())!;
    assert.equal(latest.enabled, false);
    assert.equal(latest.terms.sub_1, 7);
    await f.call(data.finish, {
      customerId: "cus_1",
      revision: first.revision,
    });
    assert.equal(
      f.row().status,
      "syncing",
      "late worker must not overwrite current status",
    );
  });
  it("rechecks ownership before writes and blocks ambiguous customer/payer mappings", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    const first = (await f.claim())!;
    f.insert("users", { stripeCustomerId: "cus_1" }, "duplicate");
    assert.equal(
      await f.call(data.checkpoint, { customerId: "cus_1", ...first }),
      false,
    );
    await f.call(data.finish, {
      customerId: "cus_1",
      revision: first.revision,
      superseded: true,
    });
    assert.equal(await f.claim(), null);
    assert.equal(f.row().status, "failed");
    assert.match(String(f.row().error), /ambiguous/);
  });
  it("retries transient failures with backoff and exposes exhausted failures", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      const current = (await f.claim())!;
      await f.call(data.finish, {
        customerId: "cus_1",
        revision: current.revision,
        error: "Stripe unavailable",
        retryable: true,
      });
      if (attempt < 4) {
        assert.equal(await f.claim(), null);
        f.advance([60_000, 300_000, 1_800_000][attempt - 1]);
      }
    }
    assert.equal(f.row().status, "failed");
    assert.equal(f.row().nextRetryAt, undefined);
    f.actor("admin");
    await f.call(data.adminRetry, { householdPayerId: "payer" });
    assert.equal(f.row().status, "pending");
    assert.equal(f.row().attempts, 0);
  });
  it("recovers expired worker leases through hourly reconciliation", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    await f.claim();
    await f.call(data.reconcile);
    assert.equal(f.jobs.length, 1);
    f.advance(16 * 60_000);
    await f.call(data.reconcile);
    assert.ok(await f.claim());
  });
  it("deduplicates webhook events and ignores event ordering in favor of the saved preference", async () => {
    const f = fixture();
    await f.call(payments.setCurrentUserAutopay, { enabled: false });
    await f.call(data.acceptEvent, { eventId: "new", customerId: "cus_1" });
    await f.call(data.acceptEvent, { eventId: "old", customerId: "cus_1" });
    const revision = f.row().revision;
    await f.call(data.acceptEvent, { eventId: "old", customerId: "cus_1" });
    assert.equal(f.row().revision, revision);
    assert.equal((await f.claim())!.enabled, false);
  });
  it("logs sanitized failures while retaining the error for the UI", async () => {
    const f = fixture();
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    transport.setClient({
      customers: {
        retrieve: async () => {
          throw { statusCode: 400, message: "private transport payload" };
        },
      },
    });
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      await f.call(payments.setCurrentUserAutopay, { enabled: true });
      await f.call(actions.syncCustomer, { customerId: "cus_1" });
      assert.equal(f.row().status, "failed");
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0][0], "Stripe autopay synchronization failed");
      assert.deepEqual(warnings[0][1], {
        customerId: "cus_1",
        revision: 1,
        retryable: false,
        message: f.row().error,
      });
      assert.equal(
        JSON.stringify(warnings).includes("private transport payload"),
        false,
      );
    } finally {
      console.warn = originalWarn;
      transport.setClient(transport.verification);
    }
  });
  it("runs the real action with mocked Stripe and exposes successful sync status", async () => {
    const f = fixture();
    const writes: unknown[] = [];
    transport.setClient({
      customers: {
        retrieve: async () => ({
          invoice_settings: { default_payment_method: "pm_1" },
        }),
      },
      paymentMethods: { retrieve: async () => ({ customer: "cus_1" }) },
      subscriptions: {
        list: async function* () {
          yield {
            id: "sub_1",
            status: "active",
            collection_method: "send_invoice",
            days_until_due: 7,
          };
        },
        update: async (...args: unknown[]) => {
          writes.push(args);
        },
      },
      subscriptionSchedules: { list: async function* () {} },
    });
    await f.call(payments.setCurrentUserAutopay, { enabled: true });
    await f.call(actions.syncCustomer, { customerId: "cus_1" });
    assert.equal(writes.length, 1);
    assert.equal(f.row().status, "synced");
    const view = await f.call<{ autopaySync: { status: string } }>(
      payments.getCurrentAccess,
    );
    assert.equal(view.autopaySync.status, "synced");
    transport.setClient(transport.verification);
  });
});

describe("Stripe webhook signature verification", () => {
  it("only durably accepts valid signed payloads and does not call external Stripe APIs", async () => {
    const f = fixture();
    const secret = "whsec_local_fixture";
    const previous = process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET;
    process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET = secret;
    transport.setClient(transport.verification);
    try {
      const body = JSON.stringify({
        id: "evt_1",
        type: "customer.subscription.created",
        data: { object: { id: "sub_1", customer: "cus_1" } },
      });
      // Fixture time is used by signature verification too.
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret,
        timestamp: 1_800_000_000,
      });
      assert.equal(
        await f.call(actions.receiveWebhook, { body, signature }),
        200,
      );
      assert.equal(f.jobs.length, 1);
      assert.equal(
        await f.call(actions.receiveWebhook, { body, signature }),
        200,
      );
      assert.equal(f.jobs.length, 1);
      assert.equal(
        await f.call(actions.receiveWebhook, { body: body + " ", signature }),
        400,
      );
      assert.equal(
        await f.call(actions.receiveWebhook, { body, signature: "invalid" }),
        400,
      );
      delete process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET;
      assert.equal(
        await f.call(actions.receiveWebhook, { body, signature }),
        503,
      );
    } finally {
      if (previous === undefined)
        delete process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET;
      else process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET = previous;
    }
  });
});
