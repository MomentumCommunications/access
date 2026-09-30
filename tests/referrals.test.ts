import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getFunctionName } from "convex/server";
import {
  assertReferralDecision,
  assertReferralSendAllowed,
  normalizeReferralEmail,
  verifiedReferralEmail,
} from "../shared/referrals.ts";

// Resolve the extensionless imports used by Convex without bundling or a deployment.
// Replace only the external email transport; exercise the real actions and handlers.
const resendStub =
  "data:text/javascript," +
  encodeURIComponent(`
  export let result = { error: null };
  export const messages = [];
  export function setResult(value) { result = value; }
  export class Resend { emails = { send: async (...args) => { messages.push(args); return result; } }; }
`);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "resend") return nextResolve(resendStub, context);
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

const referrals = await import("../convex/referrals.ts");
const { connectVerifiedReferral } = await import("../convex/lib/referrals.ts");
const { send } = await import("../convex/referralActions.ts");
const transport = await import(resendStub);

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
function fixture() {
  const rows: Row[] = [];
  let sequence = 0;
  let actor: string | null = "member";
  let now = 1_800_000_000_000;
  const pushes: unknown[] = [];
  function insert(table: string, value: Record<string, unknown>) {
    const _id = `${table}:${++sequence}`;
    rows.push({ ...value, _id, _creationTime: sequence, table });
    return _id;
  }
  function user(id: string, extra: Record<string, unknown> = {}) {
    rows.push({
      _id: id,
      _creationTime: ++sequence,
      table: "users",
      roles: ["member"],
      email: `${id}@example.com`,
      status: "active",
      onboardingStatus: "complete",
      ...extra,
    });
  }
  user("member");
  user("admin", { roles: ["admin"] });
  user("admin2", { roles: ["admin"] });
  const db = {
    get: async (id: string) => rows.find((row) => row._id === id) ?? null,
    insert: async (table: string, value: Record<string, unknown>) =>
      insert(table, value),
    patch: async (id: string, value: Record<string, unknown>) =>
      Object.assign(rows.find((row) => row._id === id)!, value),
    query(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let descending = false;
      const range = {
        eq(field: string, value: unknown) {
          filters.push((row) => row[field] === value);
          return range;
        },
        gt(field: string, value: number) {
          filters.push((row) => Number(row[field]) > value);
          return range;
        },
      };
      const collect = () =>
        rows
          .filter(
            (row) =>
              row.table === table && filters.every((filter) => filter(row)),
          )
          .sort((a, b) =>
            descending
              ? b._creationTime - a._creationTime
              : a._creationTime - b._creationTime,
          );
      const query = {
        withIndex(_name: string, filter: (q: typeof range) => unknown) {
          filter(range);
          return query;
        },
        order(order: string) {
          descending = order === "desc";
          return query;
        },
        collect: async () => collect(),
        first: async () => collect()[0] ?? null,
        unique: async () => {
          const results = collect();
          assert.ok(results.length <= 1);
          return results[0] ?? null;
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
      runAfter: async (...args: unknown[]) => {
        pushes.push(args);
      },
    },
    async runMutation(
      reference: Parameters<typeof getFunctionName>[0],
      args: unknown,
    ) {
      const name = getFunctionName(reference).split(":")[1];
      return call(referrals[name as keyof typeof referrals], args);
    },
  };
  async function call<T = unknown>(
    fn: unknown,
    args: unknown = {},
  ): Promise<T> {
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      return await (
        fn as { _handler: (context: unknown, args: unknown) => Promise<T> }
      )._handler(ctx, args);
    } finally {
      Date.now = originalNow;
    }
  }
  async function prepare(email = "friend@example.com") {
    return call<{ referralId: string; attemptId: string; token: string }>(
      referrals.prepareSend,
      { email, token: "a".repeat(43) },
    );
  }
  return {
    rows,
    db,
    ctx,
    user,
    call,
    prepare,
    pushes,
    insert,
    setActor: (id: string | null) => {
      actor = id;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("referral policy", () => {
  it("normalizes emails and rejects malformed or oversized addresses", () => {
    assert.equal(
      normalizeReferralEmail(" Friend@Example.COM "),
      "friend@example.com",
    );
    for (const email of [
      "bad",
      "a b@example.com",
      "a@b",
      `${"a".repeat(250)}@example.com`,
    ])
      assert.throws(() => normalizeReferralEmail(email));
  });
  it("requires verification of a specific email, not a legacy array", () => {
    assert.equal(verifiedReferralEmail({ email: "friend@example.com" }), null);
    assert.equal(
      verifiedReferralEmail({
        email: ["friend@example.com"],
        emailVerificationTime: 1,
      }),
      null,
    );
    assert.equal(
      verifiedReferralEmail({
        email: "FRIEND@example.com",
        emailVerificationTime: 1,
      }),
      "friend@example.com",
    );
  });
  it("enforces exact cooldown and daily boundaries", () => {
    assert.throws(
      () => assertReferralSendAllowed({ recentCount: 10, now: 100_000 }),
      /10 referral/,
    );
    assert.throws(
      () =>
        assertReferralSendAllowed({
          recentCount: 0,
          lastRecipientAttemptAt: 1,
          now: 60_000,
        }),
      /60 seconds/,
    );
    assert.doesNotThrow(() =>
      assertReferralSendAllowed({
        recentCount: 9,
        lastRecipientAttemptAt: 1,
        now: 60_001,
      }),
    );
  });
  it("requires connection, confirmation, and a correction note", () => {
    const input = {
      current: "pending_review" as const,
      next: "credit_applied" as const,
      connected: true,
      confirmed: true,
    };
    assert.throws(
      () => assertReferralDecision({ ...input, connected: false }),
      /not connected/,
    );
    assert.throws(
      () => assertReferralDecision({ ...input, confirmed: false }),
      /Confirm/,
    );
    assert.throws(
      () =>
        assertReferralDecision({
          ...input,
          current: "credit_applied",
          next: "pending_review",
        }),
      /correction note/,
    );
    assert.equal(
      assertReferralDecision({ ...input, current: "credit_applied" }),
      false,
    );
  });
});

describe("referral backend handlers", () => {
  it("restricts sending and listing to active onboarded members", async () => {
    const f = fixture();
    for (const actor of [null, "admin"]) {
      f.setActor(actor);
      await assert.rejects(() => f.prepare());
      await assert.rejects(() => f.call(referrals.listMine));
    }
    f.setActor("member");
    await f.db.patch("member", { status: "inactive" });
    await assert.rejects(() => f.prepare(), /active members/);
    await f.db.patch("member", {
      status: "active",
      onboardingStatus: "pending",
    });
    await assert.rejects(() => f.prepare(), /completed registration/);
  });
  it("rejects self-referrals including alternate imported emails", async () => {
    const f = fixture();
    await assert.rejects(() => f.prepare(" MEMBER@EXAMPLE.COM "), /yourself/);
    await f.db.patch("member", {
      email: ["primary@example.com", "other@example.com"],
    });
    await assert.rejects(() => f.prepare("OTHER@example.com"), /yourself/);
  });
  it("reuses the first referral and its token, with atomic send reservations", async () => {
    const f = fixture();
    const first = await f.prepare();
    await assert.rejects(() => f.prepare(), /60 seconds/);
    f.advance(60_000);
    const second = await f.prepare(" FRIEND@EXAMPLE.COM ");
    assert.equal(second.referralId, first.referralId);
    assert.equal(second.token, first.token);
    assert.equal(f.rows.filter((row) => row.table === "referrals").length, 1);
    f.user("other");
    f.setActor("other");
    await assert.rejects(() => f.prepare(), /not available/);
  });
  it("counts all reserved attempts toward the daily limit, including failures", async () => {
    const f = fixture();
    for (let i = 0; i < 10; i++) await f.prepare(`friend${i}@example.com`);
    await assert.rejects(
      () => f.prepare("eleventh@example.com"),
      /10 referral/,
    );
    f.advance(24 * 60 * 60 * 1000);
    await f.prepare("eleventh@example.com");
  });
  it("connects an existing verified trial account and notifies each admin once", async () => {
    const f = fixture();
    f.user("friend", { emailVerificationTime: 1 });
    const result = await f.prepare();
    const row = await f.db.get(result.referralId);
    assert.equal(row?.referredUserId, "friend");
    assert.equal(row?.status, "pending_review");
    assert.equal(
      f.rows.filter((row) => row.table === "notifications").length,
      2,
    );
    assert.equal(f.pushes.length, 2);
    const notification = f.rows.find((row) => row.table === "notifications")!;
    assert.equal(notification.href, "/admin/accounts/friend?tab=referrals");
    f.advance(60_000);
    await f.prepare();
    assert.equal(
      f.rows.filter((row) => row.table === "notifications").length,
      2,
    );
  });
  it("connects only after verification without requiring a link, and preserves attribution after email changes", async () => {
    const f = fixture();
    f.user("friend");
    const first = await f.prepare();
    assert.equal((await f.db.get(first.referralId))?.status, "invited");
    await f.db.patch("friend", { emailVerificationTime: 1 });
    await connectVerifiedReferral(
      f.ctx as never,
      (await f.db.get("friend")) as never,
    );
    assert.equal((await f.db.get(first.referralId))?.referredUserId, "friend");
    await f.db.patch("friend", { email: "changed@example.com" });
    f.user("other");
    f.setActor("other");
    await assert.rejects(
      () => f.prepare("changed@example.com"),
      /not available/,
    );
    await connectVerifiedReferral(
      f.ctx as never,
      (await f.db.get("friend")) as never,
    );
    assert.equal(
      f.rows.filter(
        (row) => row.table === "referrals" && row.referredUserId === "friend",
      ).length,
      1,
    );
  });
  it("requires admin access and keeps decisions idempotent, audited, and private", async () => {
    const f = fixture();
    f.user("friend", { emailVerificationTime: 1 });
    const { referralId } = await f.prepare();
    const decision = {
      referralId,
      status: "credit_applied",
      expectedStatus: "pending_review",
      confirmed: true,
      note: "Private billing reference",
    };
    await assert.rejects(
      () => f.call(referrals.adminSetStatus, decision),
      /Admin access/,
    );
    await assert.rejects(
      () => f.call(referrals.adminForAccount, { userId: "member" }),
      /Admin access/,
    );
    f.setActor("admin");
    await assert.rejects(
      () => f.call(referrals.adminSetStatus, { ...decision, confirmed: false }),
      /Confirm/,
    );
    await f.call(referrals.adminSetStatus, decision);
    await f.call(referrals.adminSetStatus, decision);
    let row = await f.db.get(referralId);
    assert.equal((row?.history as unknown[]).length, 1);
    assert.equal(f.rows.filter((row) => row.table === "activityLog").length, 2);
    await assert.rejects(
      () =>
        f.call(referrals.adminSetStatus, {
          ...decision,
          status: "not_eligible",
        }),
      /changed/,
    );
    await assert.rejects(
      () =>
        f.call(referrals.adminSetStatus, {
          ...decision,
          status: "pending_review",
          expectedStatus: "credit_applied",
          note: "",
        }),
      /correction note/,
    );
    await f.call(referrals.adminSetStatus, {
      ...decision,
      status: "pending_review",
      expectedStatus: "credit_applied",
      note: "Recorded against the wrong bill",
    });
    row = await f.db.get(referralId);
    assert.equal((row?.history as unknown[]).length, 2);
    const incoming = await f.call<{ incoming: Row }>(
      referrals.adminForAccount,
      { userId: "friend" },
    );
    const outgoing = await f.call<{ outgoing: Row[] }>(
      referrals.adminForAccount,
      { userId: "member" },
    );
    assert.equal(incoming.incoming._id, outgoing.outgoing[0]._id);
    f.setActor("member");
    const mine = await f.call<Row[]>(referrals.listMine);
    assert.equal("history" in mine[0], false);
    assert.equal("referredUserId" in mine[0], false);
    f.user("unrelated");
    f.setActor("unrelated");
    assert.deepEqual(await f.call(referrals.listMine), []);
  });
  it("previews only valid opaque links without exposing admin decisions", async () => {
    const f = fixture();
    const { token } = await f.prepare();
    f.setActor(null);
    assert.equal(await f.call(referrals.preview, { token: "invalid" }), null);
    const preview = await f.call<Record<string, unknown>>(referrals.preview, {
      token,
    });
    assert.deepEqual(Object.keys(preview).sort(), ["email", "referrerName"]);
  });
  it("retains a usable link after delivery failure and records successful retries", async () => {
    const f = fixture();
    const oldUrl = process.env.ACCESS_APP_URL;
    const oldKey = process.env.RESEND_API_KEY;
    process.env.ACCESS_APP_URL = "https://access.example.com";
    process.env.RESEND_API_KEY = "test-key";
    try {
      transport.setResult({ error: { message: "Service unavailable" } });
      const failed = await f.call<{
        url: string;
        sent: boolean;
        warning: string;
      }>(send, { email: "friend@example.com" });
      assert.equal(failed.sent, false);
      assert.match(failed.warning, /saved/);
      assert.match(failed.url, /^https:\/\/access.example.com\/referral\//);
      assert.equal(f.rows.filter((row) => row.table === "referrals").length, 1);
      assert.ok(
        f.rows.find((row) => row.table === "referralSendAttempts")?.failedAt,
      );
      assert.equal(
        f.rows.filter((row) => row.table === "notifications").length,
        0,
      );
      f.advance(60_000);
      transport.setResult({ error: null });
      const delivered = await f.call<{ url: string; sent: boolean }>(send, {
        email: "friend@example.com",
      });
      assert.equal(delivered.sent, true);
      assert.equal(delivered.url, failed.url);
      assert.ok(f.rows.find((row) => row.table === "referrals")?.lastSentAt);
    } finally {
      if (oldUrl === undefined) delete process.env.ACCESS_APP_URL;
      else process.env.ACCESS_APP_URL = oldUrl;
      if (oldKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = oldKey;
    }
  });
});
