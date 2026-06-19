"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getStripeClient } from "./lib/stripe";
import { createStripePortalSessionForAccess } from "../shared/payments-access";
import { loadStripeBillingAttention } from "../shared/billing-attention";

export const createCurrentUserStripePortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, { returnUrl }) => {
    const access = await ctx.runQuery(
      internal.paymentsData.getCurrentAccessInternal,
      {},
    );
    return await createStripePortalSessionForAccess({
      access,
      returnUrl,
      createSession: async ({ customer, returnUrl: validatedReturnUrl }) => {
        const session =
          await getStripeClient().billingPortal.sessions.create({
            customer,
            return_url: validatedReturnUrl,
          });
        return { url: session.url };
      },
    });
  },
});

export const getCurrentUserBillingAttention = action({
  args: {},
  handler: async (ctx) => {
    const access = await ctx.runQuery(
      internal.paymentsData.getCurrentBillingAttentionAccess,
      {},
    );
    if (access.status !== "ready" || !access.stripeCustomerId) {
      return { status: "ineligible" as const };
    }

    return await loadStripeBillingAttention({
      retrieveCustomer: () =>
        getStripeClient().customers.retrieve(access.stripeCustomerId),
    });
  },
});
