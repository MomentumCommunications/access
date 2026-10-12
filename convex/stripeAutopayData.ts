import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { hasUserRole } from "./lib/roles";
import {
  customerPreference,
  enqueueAutopay,
  enqueuePayerAutopay,
  reconcilePage,
  syncRecord,
  syncWorker,
} from "./lib/autopaySync";

export const claim = internalMutation({
  args: { customerId: v.string() },
  handler: async (ctx, { customerId }) => {
    const row = await syncRecord(ctx, customerId);
    const now = Date.now();
    if (
      !row ||
      (row.leaseUntil ?? 0) > now ||
      (row.nextRetryAt ?? 0) > now ||
      row.status === "synced"
    )
      return null;
    const preference = await customerPreference(ctx, customerId);
    if (preference.error) {
      await ctx.db.patch(row._id, {
        status: "failed",
        error: preference.error,
        leaseUntil: undefined,
        leaseRevision: undefined,
        nextRetryAt: undefined,
      });
      return null;
    }
    // Longer than Convex's maximum action execution time; expired workers cannot
    // still be running when another worker acquires this customer.
    await ctx.db.patch(row._id, {
      status: "syncing",
      leaseRevision: row.revision,
      leaseUntil: now + 15 * 60_000,
      attempts: row.attempts + 1,
      nextRetryAt: undefined,
      updatedAt: now,
    });
    return {
      revision: row.revision,
      enabled: preference.enabled!,
      payerId: preference.payerId!,
      terms: row.terms,
    };
  },
});

export const checkpoint = internalMutation({
  args: {
    customerId: v.string(),
    revision: v.number(),
    enabled: v.boolean(),
    payerId: v.id("householdPayers"),
    terms: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const row = await syncRecord(ctx, args.customerId);
    if (
      !row ||
      row.leaseRevision !== args.revision ||
      (row.leaseUntil ?? 0) <= Date.now()
    )
      return false;
    // Terms are saved before external writes even if a newer preference is queued.
    await ctx.db.patch(row._id, { terms: args.terms });
    const preference = await customerPreference(ctx, args.customerId);
    return (
      row.revision === args.revision &&
      !preference.error &&
      preference.enabled === args.enabled &&
      preference.payerId === args.payerId
    );
  },
});

export const finish = internalMutation({
  args: {
    customerId: v.string(),
    revision: v.number(),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    superseded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await syncRecord(ctx, args.customerId);
    if (!row || row.leaseRevision !== args.revision) return;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      leaseRevision: undefined,
      leaseUntil: undefined,
      updatedAt: now,
    });
    if (row.revision !== args.revision || args.superseded) {
      await ctx.db.patch(row._id, {
        status: "pending",
        revision: row.revision + 1,
        attempts: 0,
      });
      await ctx.scheduler.runAfter(0, syncWorker, {
        customerId: args.customerId,
      });
    } else if (args.error) {
      const delay =
        args.retryable && row.attempts < 4
          ? [60_000, 300_000, 1_800_000][row.attempts - 1]
          : undefined;
      await ctx.db.patch(row._id, {
        status: delay ? "pending" : "failed",
        error: args.error,
        nextRetryAt: delay ? now + delay : undefined,
      });
      if (delay)
        await ctx.scheduler.runAfter(delay, syncWorker, {
          customerId: args.customerId,
        });
    } else {
      await ctx.db.patch(row._id, {
        status: "synced",
        lastSyncedAt: now,
        error: undefined,
        nextRetryAt: undefined,
      });
    }
  },
});

export const acceptEvent = internalMutation({
  args: { eventId: v.string(), customerId: v.string() },
  handler: async (ctx, { eventId, customerId }) => {
    if (
      await ctx.db
        .query("stripeWebhookEvents")
        .withIndex("byEvent", (q) => q.eq("eventId", eventId))
        .unique()
    )
      return;
    await ctx.db.insert("stripeWebhookEvents", {
      eventId,
      receivedAt: Date.now(),
    });
    const linked = await ctx.db
      .query("users")
      .withIndex("byStripeCustomer", (q) =>
        q.eq("stripeCustomerId", customerId),
      )
      .first();
    if (linked) await enqueueAutopay(ctx, customerId);
  },
});

export const reconcile = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    for (const user of page.page) {
      if (!user.stripeCustomerId) continue;
      const payers = await ctx.db
        .query("householdPayers")
        .withIndex("byUser", (q) => q.eq("userId", user._id))
        .collect();
      const row = await syncRecord(ctx, user.stripeCustomerId);
      if (!row && !payers.some((p) => p.active && p.isPrimary)) continue;
      if (
        row &&
        ((row.leaseUntil ?? 0) > Date.now() ||
          (row.nextRetryAt ?? 0) > Date.now())
      )
        continue;
      await enqueueAutopay(ctx, user.stripeCustomerId);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, reconcilePage, {
        cursor: page.continueCursor,
      });
    // Bound retention work; stale duplicate events are harmless reconciliation requests.
    const old = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("byReceivedAt", (q) =>
        q.lt("receivedAt", Date.now() - 30 * 86_400_000),
      )
      .take(100);
    for (const row of old) await ctx.db.delete(row._id);
  },
});

export const adminRetry = mutation({
  args: { householdPayerId: v.id("householdPayers") },
  handler: async (ctx, { householdPayerId }) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (!hasUserRole(user, "admin")) throw new Error("Admin access required.");
    const payer = await ctx.db.get(householdPayerId);
    if (!payer?.active || !payer.isPrimary)
      throw new Error("An active primary payer is required.");
    if (!(await enqueuePayerAutopay(ctx, payer.userId))) {
      throw new Error(
        "This payment account does not have a linked Stripe customer.",
      );
    }
  },
});

export const health = internalQuery({
  args: { customerId: v.string() },
  handler: (ctx, { customerId }) => syncRecord(ctx, customerId),
});
