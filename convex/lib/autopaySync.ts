import { makeFunctionReference } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const syncWorker = makeFunctionReference<
  "action",
  { customerId: string }
>("stripeAutopay:syncCustomer");
export const reconcilePage = makeFunctionReference<
  "mutation",
  { cursor?: string }
>("stripeAutopayData:reconcile");
export async function syncRecord(ctx: QueryCtx, customerId: string) {
  return ctx.db
    .query("stripeAutopaySync")
    .withIndex("byCustomer", (q) => q.eq("customerId", customerId))
    .unique();
}

export async function enqueueAutopay(ctx: MutationCtx, customerId: string) {
  const row = await syncRecord(ctx, customerId);
  const now = Date.now();
  if (row) {
    const running = (row.leaseUntil ?? 0) > now;
    await ctx.db.patch(row._id, {
      revision: row.revision + 1,
      status: running ? "syncing" : "pending",
      attempts: 0,
      error: undefined,
      nextRetryAt: undefined,
      updatedAt: now,
    });
    if (!running) await ctx.scheduler.runAfter(0, syncWorker, { customerId });
  } else {
    await ctx.db.insert("stripeAutopaySync", {
      customerId,
      revision: 1,
      status: "pending",
      attempts: 0,
      terms: {},
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, syncWorker, { customerId });
  }
}

export async function enqueuePayerAutopay(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user?.stripeCustomerId) return false;
  await enqueueAutopay(ctx, user.stripeCustomerId);
  return true;
}

export async function autopayStatus(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user?.stripeCustomerId) return null;
  const row = await syncRecord(ctx, user.stripeCustomerId);
  return row
    ? {
        status: row.status,
        lastSyncedAt: row.lastSyncedAt,
        error: row.error,
        nextRetryAt: row.nextRetryAt,
      }
    : null;
}

// A Stripe customer must resolve to exactly one active primary payer and a
// household with exactly one active primary. Never resolve ambiguity by ordering.
export async function customerPreference(ctx: QueryCtx, customerId: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("byStripeCustomer", (q) => q.eq("stripeCustomerId", customerId))
    .collect();
  if (users.length !== 1)
    return { error: "Stripe customer ownership is missing or ambiguous." };
  const payers = (
    await ctx.db
      .query("householdPayers")
      .withIndex("byUser", (q) => q.eq("userId", users[0]._id))
      .collect()
  ).filter((p) => p.active && p.isPrimary);
  if (payers.length !== 1)
    return {
      error: "Stripe customer must have exactly one active primary payer.",
    };
  const payer = payers[0];
  const household = await ctx.db.get(payer.householdId);
  const householdPayers = (
    await ctx.db
      .query("householdPayers")
      .withIndex("byHousehold", (q) => q.eq("householdId", payer.householdId))
      .collect()
  ).filter((p) => p.active && p.isPrimary);
  const membership = await ctx.db
    .query("householdMembers")
    .withIndex("byHouseholdUser", (q) =>
      q.eq("householdId", payer.householdId).eq("userId", users[0]._id),
    )
    .first();
  if (!household || !membership || householdPayers.length !== 1)
    return {
      error: "Household payment responsibility needs administrator review.",
    };
  return { enabled: payer.autopayEnabled === true, payerId: payer._id };
}
