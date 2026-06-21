import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canManagePushSubscription } from "../shared/push-notifications";

const MAX_ENDPOINT_LENGTH = 4_096;
const MAX_KEY_LENGTH = 1_024;

function validateSubscription(endpoint: string, p256dh: string, auth: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid push subscription");
  }
  if (
    url.protocol !== "https:" ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !p256dh ||
    p256dh.length > MAX_KEY_LENGTH ||
    !auth ||
    auth.length > MAX_KEY_LENGTH
  ) {
    throw new Error("Invalid push subscription");
  }
}

export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { activeDeviceCount: 0 };
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("byRecipient", (q) => q.eq("recipientUserId", userId))
      .collect();
    return {
      activeDeviceCount: subscriptions.filter(
        (subscription) => subscription.disabledAt === undefined,
      ).length,
    };
  },
});

export const register = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    validateSubscription(args.endpoint, args.p256dh, args.auth);

    const now = Date.now();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("byEndpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        recipientUserId: userId,
        p256dh: args.p256dh,
        auth: args.auth,
        userAgent: args.userAgent,
        updatedAt: now,
        disabledAt: undefined,
        failureCount: 0,
        lastFailureAt: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      recipientUserId: userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
      failureCount: 0,
    });
  },
});

export const disable = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("byEndpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (!canManagePushSubscription(subscription, userId)) return false;
    if (subscription.disabledAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(subscription._id, {
        disabledAt: now,
        updatedAt: now,
      });
    }
    return true;
  },
});
