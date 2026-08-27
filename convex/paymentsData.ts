import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { resolvePaymentsAccess } from "../shared/payments-access";
import { hasUserRole } from "./lib/roles";

async function resolveCurrentUserPaymentsAccess(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return { status: "unauthenticated" as const };
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    return { status: "unauthenticated" as const };
  }

  const memberships = await ctx.db
    .query("householdMembers")
    .withIndex("byUser", (q) => q.eq("userId", userId))
    .collect();
  const households = (
    await Promise.all(
      memberships.map((membership) =>
        ctx.db.get(membership.householdId),
      ),
    )
  ).filter((household) => household !== null);
  const householdIds = new Set(
    households.map((household) => household._id),
  );
  const payerRows = (
    await Promise.all(
      [...householdIds].map((householdId) =>
        ctx.db
          .query("householdPayers")
          .withIndex("byHousehold", (q) =>
            q.eq("householdId", householdId),
          )
          .collect(),
      ),
    )
  ).flat();

  return resolvePaymentsAccess({
    userId,
    stripeCustomerId: user.stripeCustomerId,
    memberships: memberships.map((membership) => ({
      id: membership._id,
      householdId: membership.householdId,
      createdAt: membership._creationTime,
    })),
    households: households.map((household) => ({
      id: household._id,
    })),
    payers: payerRows.map((payer) => ({
      id: payer._id,
      householdId: payer.householdId,
      userId: payer.userId,
      active: payer.active,
      isPrimary: payer.isPrimary,
      autopayEnabled: payer.autopayEnabled,
      createdAt: payer.createdAt,
    })),
  });
}

export const getCurrentAccess = query({
  args: {},
  handler: async (ctx) => {
    const access = await resolveCurrentUserPaymentsAccess(ctx);
    if (access.status === "ready") {
      return {
        status: access.status,
        householdId: access.householdId,
        billingResponsibleUserId: access.billingResponsibleUserId,
        autopayEnabled: access.autopayEnabled === true,
      };
    }
    return access;
  },
});

export const setCurrentUserAutopay = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const access = await resolveCurrentUserPaymentsAccess(ctx);
    if (access.status !== "ready" || !access.householdPayerId) {
      throw new Error(
        "Automatic payments can only be changed by the active primary payment account.",
      );
    }

    const payerId = access.householdPayerId as Id<"householdPayers">;
    const payer = await ctx.db.get(payerId);
    if (
      !payer ||
      !payer.active ||
      !payer.isPrimary ||
      payer.userId !== access.billingResponsibleUserId
    ) {
      throw new Error(
        "Automatic payment access changed. Refresh and try again.",
      );
    }

    await ctx.db.patch(payerId, {
      autopayEnabled: enabled,
      updatedAt: Date.now(),
    });
  },
});

export const getCurrentAccessInternal = internalQuery({
  args: {},
  handler: resolveCurrentUserPaymentsAccess,
});

export const getCurrentBillingAttentionAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { status: "ineligible" as const };
    }

    const user = await ctx.db.get(userId);
    if (
      !user ||
      hasUserRole(user, "staff") ||
      hasUserRole(user, "admin")
    ) {
      return { status: "ineligible" as const };
    }

    const access = await resolveCurrentUserPaymentsAccess(ctx);
    return access.status === "ready"
      ? access
      : { status: "ineligible" as const };
  },
});
