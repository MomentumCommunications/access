"use node";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getStripeClient } from "./lib/stripe";
import {
  autopayFailure,
  AutopaySupersededError,
  synchronizeStripeAutopay,
  webhookCustomer,
} from "../shared/stripe-autopay";

export const syncCustomer = internalAction({
  args: { customerId: v.string() },
  handler: async (ctx, { customerId }): Promise<void> => {
    const claim = await ctx.runMutation(internal.stripeAutopayData.claim, {
      customerId,
    });
    if (!claim) return;
    try {
      await synchronizeStripeAutopay({
        stripe: getStripeClient(),
        customerId,
        enabled: claim.enabled,
        savedTerms: claim.terms,
        checkpoint: async (terms) => {
          const current = await ctx.runMutation(
            internal.stripeAutopayData.checkpoint,
            {
              customerId,
              revision: claim.revision,
              enabled: claim.enabled,
              payerId: claim.payerId,
              terms,
            },
          );
          if (!current) throw new AutopaySupersededError();
        },
        requestKey: (id, payload) =>
          `autopay:${customerId}:${claim.revision}:${id}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`,
      });
      await ctx.runMutation(internal.stripeAutopayData.finish, {
        customerId,
        revision: claim.revision,
      });
    } catch (error) {
      const failure =
        error instanceof AutopaySupersededError
          ? { superseded: true }
          : (() => {
              const result = autopayFailure(error);
              return { error: result.message, retryable: result.retryable };
            })();
      await ctx.runMutation(internal.stripeAutopayData.finish, {
        customerId,
        revision: claim.revision,
        ...failure,
      });
      if ("error" in failure) {
        console.warn("Stripe autopay synchronization failed", {
          customerId,
          revision: claim.revision,
          retryable: failure.retryable,
          message: failure.error,
        });
      }
    }
  },
});

export const receiveWebhook = internalAction({
  args: { body: v.string(), signature: v.string() },
  handler: async (ctx, { body, signature }): Promise<number> => {
    const secret = process.env.STRIPE_AUTOPAY_WEBHOOK_SECRET;
    if (!secret) return 503;
    let event;
    try {
      event = getStripeClient().webhooks.constructEvent(
        body,
        signature,
        secret,
      );
    } catch {
      return 400;
    }
    const customerId = webhookCustomer(event);
    if (customerId)
      await ctx.runMutation(internal.stripeAutopayData.acceptEvent, {
        eventId: event.id,
        customerId,
      });
    return 200;
  },
});
