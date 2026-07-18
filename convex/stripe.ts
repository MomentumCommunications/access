"use node";

import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { createHash, randomInt } from "node:crypto";
import { Resend } from "resend";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { getStripeClient } from "./lib/stripe";
import { getResendApiKey, resendFromAddress } from "./resendConfig";
import { normalizeAccountEmail } from "../shared/account-security";
import { ensureStripeCustomerForUser } from "../shared/stripe-customer";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("staff"),
  v.literal("member"),
);

const saveOnboardingProfileRef = makeFunctionReference<
  "mutation",
  { firstName: string; lastName: string; phone: string; address: string },
  {
    userId: Id<"users">;
    destination:
      | "/admin"
      | "/staff"
      | "/register/review"
      | "/register/students";
    provisionCustomerBilling: boolean;
  }
>("onboarding:saveProfile");

function securityCode() {
  return randomInt(0, 100_000_000).toString().padStart(8, "0");
}

function securityCodeHash(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendSecurityCode({
  email,
  subject,
  message,
}: {
  email: string;
  subject: string;
  message: string;
}) {
  const resend = new Resend(getResendApiKey());
  const { error } = await resend.emails.send({
    from: resendFromAddress,
    to: [email],
    subject,
    text: message,
  });
  if (error) {
    throw new Error("Could not send the security email");
  }
}

function securityChallengeError(result: {
  reason: string;
  retryAt?: number;
}): Error {
  if (result.reason === "throttled") {
    const seconds = Math.max(
      1,
      Math.ceil(((result.retryAt ?? Date.now()) - Date.now()) / 1000),
    );
    return new Error(
      `Please wait ${seconds} seconds before requesting another code.`,
    );
  }
  if (result.reason === "duplicate_email") {
    return new Error("An account already exists for that email address.");
  }
  if (result.reason === "same_email") {
    return new Error("Enter a different email address.");
  }
  if (result.reason === "expired") {
    return new Error("That code has expired. Request a new one.");
  }
  if (result.reason === "too_many_attempts") {
    return new Error("Too many incorrect attempts. Request a new code.");
  }
  if (
    result.reason === "consumed" ||
    result.reason === "superseded" ||
    result.reason === "account_changed"
  ) {
    return new Error("That security request is no longer active.");
  }
  return new Error("That code is incorrect or no longer valid.");
}

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

export const requestEmailChange = action({
  args: {
    newEmail: v.string(),
    currentPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const newEmail = normalizeAccountEmail(args.newEmail);
    if (!isValidEmail(newEmail)) {
      throw new Error("Enter a valid email address.");
    }
    if (!args.currentPassword) {
      throw new Error("Current password is required.");
    }

    const { account } = await ctx.runQuery(
      internal.users.getAccountSecurityContext,
      { userId },
    );
    const currentEmail = normalizeAccountEmail(account.providerAccountId);
    const retrieved = await retrieveAccount(ctx, {
      provider: "password",
      account: {
        id: currentEmail,
        secret: args.currentPassword,
      },
    });
    if (!retrieved || retrieved.user._id !== userId) {
      throw new Error("The current password is incorrect.");
    }

    const code = securityCode();
    const now = Date.now();
    const prepared = await ctx.runMutation(
      internal.users.prepareSecurityChallenge,
      {
        userId,
        type: "email_change",
        currentEmail,
        newEmail,
        codeHash: securityCodeHash(code),
        now,
      },
    );
    if (!prepared.ok) {
      throw securityChallengeError(prepared);
    }

    try {
      await sendSecurityCode({
        email: newEmail,
        subject: "Confirm your new Access Momentum email",
        message:
          `Your email change verification code is ${code}. ` +
          "This code expires in 15 minutes.",
      });
    } catch (error) {
      await ctx.runMutation(internal.users.failSecurityChallengeDelivery, {
        challengeId: prepared.challengeId,
        userId,
        now: Date.now(),
      });
      throw error;
    }
    return {
      challengeId: prepared.challengeId,
      newEmail,
      expiresAt: prepared.expiresAt,
    };
  },
});

export const confirmEmailChange = action({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const confirmation = await ctx.runMutation(
      internal.users.beginSecurityChallengeConfirmation,
      {
        challengeId: args.challengeId,
        userId,
        type: "email_change",
        codeHash: securityCodeHash(args.code),
        now: Date.now(),
      },
    );
    if (!confirmation.ok) {
      throw securityChallengeError(confirmation);
    }
    const newEmail = confirmation.challenge.newEmail;
    if (!newEmail) {
      throw new Error("Email change is invalid.");
    }

    let stripeUpdated = false;
    let emailCommitted = false;
    try {
      if (confirmation.stripeCustomerId) {
        await getStripeClient().customers.update(
          confirmation.stripeCustomerId,
          { email: newEmail },
        );
        stripeUpdated = true;
      }
      await ctx.runMutation(internal.users.completeEmailChange, {
        challengeId: args.challengeId,
        userId,
        now: Date.now(),
      });
      emailCommitted = true;
    } catch (error) {
      if (stripeUpdated && !emailCommitted && confirmation.stripeCustomerId) {
        try {
          await getStripeClient().customers.update(
            confirmation.stripeCustomerId,
            { email: confirmation.challenge.currentEmail },
          );
        } catch (rollbackError) {
          console.error("Could not roll back Stripe email", rollbackError);
        }
      }
      await ctx.runMutation(
        internal.users.releaseSecurityChallengeConfirmation,
        {
          challengeId: args.challengeId,
          userId,
          now: Date.now(),
        },
      );
      throw error;
    }

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      ...(sessionId ? { except: [sessionId] } : {}),
    });
    return { email: newEmail };
  },
});

export const requestAccountPasswordReset = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const { account } = await ctx.runQuery(
      internal.users.getAccountSecurityContext,
      { userId },
    );
    const currentEmail = normalizeAccountEmail(account.providerAccountId);
    const code = securityCode();
    const now = Date.now();
    const prepared = await ctx.runMutation(
      internal.users.prepareSecurityChallenge,
      {
        userId,
        type: "password_reset",
        currentEmail,
        codeHash: securityCodeHash(code),
        now,
      },
    );
    if (!prepared.ok) {
      throw securityChallengeError(prepared);
    }
    try {
      await sendSecurityCode({
        email: currentEmail,
        subject: "Change your Access Momentum password",
        message:
          `Your password change code is ${code}. ` +
          "This code expires in 15 minutes.",
      });
    } catch (error) {
      await ctx.runMutation(internal.users.failSecurityChallengeDelivery, {
        challengeId: prepared.challengeId,
        userId,
        now: Date.now(),
      });
      throw error;
    }
    return {
      challengeId: prepared.challengeId,
      email: currentEmail,
      expiresAt: prepared.expiresAt,
    };
  },
});

export const confirmAccountPasswordReset = action({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const confirmation = await ctx.runMutation(
      internal.users.beginSecurityChallengeConfirmation,
      {
        challengeId: args.challengeId,
        userId,
        type: "password_reset",
        codeHash: securityCodeHash(args.code),
        now: Date.now(),
      },
    );
    if (!confirmation.ok) {
      throw securityChallengeError(confirmation);
    }

    try {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: {
          id: confirmation.challenge.currentEmail,
          secret: args.newPassword,
        },
      });
    } catch (error) {
      await ctx.runMutation(
        internal.users.releaseSecurityChallengeConfirmation,
        {
          challengeId: args.challengeId,
          userId,
          now: Date.now(),
        },
      );
      throw error;
    }
    await ctx.runMutation(internal.users.completePasswordReset, {
      challengeId: args.challengeId,
      userId,
      now: Date.now(),
    });
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      ...(sessionId ? { except: [sessionId] } : {}),
    });
  },
});

export const saveOnboardingProfile = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.runMutation(saveOnboardingProfileRef, args);
    if (profile.provisionCustomerBilling) {
      try {
        const { user } = await ctx.runQuery(
          internal.stripeData.getCurrentPrimaryPayer,
          {},
        );
        await ensureStripeCustomer(ctx, user);
      } catch (error) {
        console.error("Stripe customer setup failed", error);
        throw new Error(
          "Your profile and household were saved, but billing setup could not be completed. Please try again.",
        );
      }
    }
    return profile;
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
    const creation = await ctx.runMutation(
      internal.classes.adminCreateAccountRecord,
      args,
    );
    const accountData = await ctx.runQuery(api.classes.adminGetAccount, {
      user: creation.userId,
    });
    if (!accountData) {
      throw new Error("The account was created but could not be loaded.");
    }

    if (!creation.billingProvisioned) {
      return {
        userId: creation.userId,
        stripeCustomerReady: false,
        billingProvisioned: false,
      };
    }
    try {
      await ensureStripeCustomer(ctx, accountData.account);
      return {
        userId: creation.userId,
        stripeCustomerReady: true,
        billingProvisioned: true,
      };
    } catch (error) {
      console.error(
        "Admin-created account Stripe customer setup failed",
        error,
      );
      return {
        userId: creation.userId,
        stripeCustomerReady: false,
        billingProvisioned: true,
        warning:
          "The account and household were created, but its Stripe customer could not be created. Stripe setup will be retried when the client completes onboarding.",
      };
    }
  },
});

export const adminUpdateAccount = action({
  args: {
    user: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    email: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    roles: v.array(roleValidator),
    groups: v.array(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const accountData = await ctx.runQuery(api.classes.adminGetAccount, {
      user: args.user,
    });
    if (!accountData) throw new Error("Account not found.");

    const nextEmail = normalizeAccountEmail(args.email);
    const previousEmail = normalizeAccountEmail(
      String(
        Array.isArray(accountData.account.email)
          ? accountData.account.email[0]
          : accountData.account.email || "",
      ),
    );
    let stripeUpdated = false;
    if (
      accountData.account.stripeCustomerId &&
      previousEmail !== nextEmail
    ) {
      await getStripeClient().customers.update(
        accountData.account.stripeCustomerId,
        { email: nextEmail },
      );
      stripeUpdated = true;
    }

    try {
      const result = await ctx.runMutation(
        internal.classes.adminUpdateAccountRecord,
        {
          ...args,
          email: nextEmail,
        },
      );
      if (result.hasPasswordAccount && result.emailChanged) {
        await invalidateSessions(ctx, { userId: args.user });
      }
      return result;
    } catch (error) {
      if (
        stripeUpdated &&
        accountData.account.stripeCustomerId &&
        previousEmail
      ) {
        try {
          await getStripeClient().customers.update(
            accountData.account.stripeCustomerId,
            { email: previousEmail },
          );
        } catch (rollbackError) {
          console.error("Could not roll back Stripe account email", rollbackError);
        }
      }
      throw error;
    }
  },
});
