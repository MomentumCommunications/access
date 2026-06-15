import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "./_generated/server";

export const getCurrentPrimaryPayer = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const payerRows = await ctx.db
      .query("householdPayers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
    const primaryPayer = payerRows.find(
      (payer) => payer.active && payer.isPrimary,
    );
    if (!primaryPayer) {
      throw new Error(
        "Primary household billing responsibility has not been established.",
      );
    }
    return { user, primaryPayer };
  },
});

export const persistStripeCustomerIdIfMissing = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    const customerId = stripeCustomerId.trim();
    if (!customerId) {
      throw new Error("Stripe customer ID is required.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }
    await ctx.db.patch(userId, { stripeCustomerId: customerId });
    return customerId;
  },
});
