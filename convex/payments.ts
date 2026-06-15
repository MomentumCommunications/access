"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getStripeClient } from "./lib/stripe";
import { createStripePortalSessionForAccess } from "../shared/payments-access";

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
