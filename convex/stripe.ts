"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { getStripeClient } from "./lib/stripe";
import {
  completeStripeBackedProfileSetup,
  ensureStripeCustomerForUser,
} from "../shared/stripe-customer";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("staff"),
  v.literal("member"),
);

async function ensureStripeCustomer(
  ctx: ActionCtx,
  user: Doc<"users">,
) {
  return await ensureStripeCustomerForUser({
    user: {
      id: user._id,
      stripeCustomerId: user.stripeCustomerId,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    createCustomer: async (input, idempotencyKey) => {
      const customer = await getStripeClient().customers.create(input, {
        idempotencyKey,
      });
      return { id: customer.id };
    },
    persistStripeCustomerIdIfMissing: async (stripeCustomerId) =>
      await ctx.runMutation(
        internal.stripeData.persistStripeCustomerIdIfMissing,
        {
          userId: user._id,
          stripeCustomerId,
        },
      ),
  });
}

export const saveOnboardingProfile = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    return await completeStripeBackedProfileSetup({
      saveProfile: async () =>
        await ctx.runMutation(api.onboarding.saveProfile, args),
      ensureStripeCustomer: async () => {
        try {
          const { user } = await ctx.runQuery(
            internal.stripeData.getCurrentPrimaryPayer,
            {},
          );
          return await ensureStripeCustomer(ctx, user);
        } catch (error) {
          console.error("Stripe customer setup failed", error);
          throw new Error(
            "Your profile and household were saved, but billing setup could not be completed. Please try again.",
          );
        }
      },
      completeProfileStep: async (userId) => {
        await ctx.runMutation(internal.onboarding.completeProfileStep, {
          userId,
        });
      },
    });
  },
});

export const adminCreateAccount = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runMutation(
      internal.classes.adminCreateAccountRecord,
      args,
    );
    const accountData = await ctx.runQuery(api.classes.adminGetAccount, {
      user: userId,
    });
    if (!accountData) {
      throw new Error("The account was created but could not be loaded.");
    }

    try {
      await ensureStripeCustomer(ctx, accountData.account);
      return {
        userId,
        stripeCustomerReady: true,
      };
    } catch (error) {
      console.error(
        "Admin-created account Stripe customer setup failed",
        error,
      );
      return {
        userId,
        stripeCustomerReady: false,
        warning:
          "The account and household were created, but its Stripe customer could not be created. Stripe setup will be retried when the client completes onboarding.",
      };
    }
  },
});
