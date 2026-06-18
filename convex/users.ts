import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type DatabaseReader,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  activeChallengeStatus,
  evaluateSendThrottle,
  nextAttemptState,
  normalizeAccountEmail,
  SECURITY_CODE_MAX_ATTEMPTS,
  SECURITY_CODE_TTL_MS,
} from "../shared/account-security";

const challengeType = v.union(
  v.literal("email_change"),
  v.literal("password_reset"),
);

async function getPasswordAccount(
  ctx: { db: DatabaseReader },
  userId: Id<"users">,
) {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "password"),
    )
    .unique();
}

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getOtherUsers = query({
  args: { id: v.optional(v.id("users")) },
  handler: async (ctx, { id }) => {
    const users = await ctx.db.query("users").collect();

    return users.filter((user) => user._id !== id);
  },
});

export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (
    ctx,
    {
      firstName,
      lastName,
      phone,
      displayName,
      description,
      imageStorageId,
    },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedDisplayName = displayName.trim();
    if (trimmedFirstName.length === 0 || trimmedFirstName.length > 80) {
      throw new Error("First name must be between 1 and 80 characters");
    }
    if (trimmedLastName.length === 0 || trimmedLastName.length > 80) {
      throw new Error("Last name must be between 1 and 80 characters");
    }
    if (trimmedPhone.length > 30) {
      throw new Error("Phone number must be 30 characters or fewer");
    }
    if (trimmedDisplayName.length === 0 || trimmedDisplayName.length > 80) {
      throw new Error("Display name must be between 1 and 80 characters");
    }

    if (description && description.length > 1000) {
      throw new Error("Description must be 1000 characters or fewer");
    }

    const image = imageStorageId
      ? await ctx.storage.getUrl(imageStorageId)
      : undefined;

    await ctx.db.patch(userId, {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      phone: trimmedPhone || undefined,
      displayName: trimmedDisplayName,
      description,
      ...(image ? { image } : {}),
    });
  },
});

export const getAccountSecurityContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const account = await getPasswordAccount(ctx, userId);
    if (!account) {
      throw new Error("Password account not found");
    }
    return { user, account };
  },
});

export const prepareSecurityChallenge = internalMutation({
  args: {
    userId: v.id("users"),
    type: challengeType,
    currentEmail: v.string(),
    newEmail: v.optional(v.string()),
    codeHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const currentEmail = normalizeAccountEmail(args.currentEmail);
    const newEmail = args.newEmail
      ? normalizeAccountEmail(args.newEmail)
      : undefined;
    const account = await getPasswordAccount(ctx, args.userId);
    if (
      !account ||
      normalizeAccountEmail(account.providerAccountId) !== currentEmail
    ) {
      return { ok: false as const, reason: "account_changed" as const };
    }

    if (args.type === "email_change") {
      if (!newEmail || newEmail === currentEmail) {
        return { ok: false as const, reason: "same_email" as const };
      }
      const duplicateAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", newEmail),
        )
        .unique();
      if (duplicateAccount && duplicateAccount.userId !== args.userId) {
        return { ok: false as const, reason: "duplicate_email" as const };
      }
      const users = await ctx.db.query("users").collect();
      const duplicateUser = users.some((user) => {
        if (user._id === args.userId || !user.email) return false;
        const emails = Array.isArray(user.email) ? user.email : [user.email];
        return emails.some(
          (email) => normalizeAccountEmail(email) === newEmail,
        );
      });
      if (duplicateUser) {
        return { ok: false as const, reason: "duplicate_email" as const };
      }
    }

    const throttle = await ctx.db
      .query("accountSecurityThrottles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();
    const isEmailChange = args.type === "email_change";
    const sendThrottle = evaluateSendThrottle({
      now: args.now,
      windowStartedAt: isEmailChange
        ? throttle?.emailChangeWindowStartedAt
        : throttle?.passwordResetWindowStartedAt,
      sendCount: isEmailChange
        ? throttle?.emailChangeSendCount
        : throttle?.passwordResetSendCount,
      lastSentAt: isEmailChange
        ? throttle?.emailChangeLastSentAt
        : throttle?.passwordResetLastSentAt,
    });
    if (!sendThrottle.allowed) {
      return {
        ok: false as const,
        reason: "throttled" as const,
        retryAt: sendThrottle.retryAt,
      };
    }

    const existingChallenges = await ctx.db
      .query("accountSecurityChallenges")
      .withIndex("byUserAndType", (q) =>
        q.eq("userId", args.userId).eq("type", args.type),
      )
      .collect();
    for (const challenge of existingChallenges) {
      const status = activeChallengeStatus(
        challenge.status,
        challenge.expiresAt,
        args.now,
      );
      if (status === "expired" && challenge.status !== "expired") {
        await ctx.db.patch(challenge._id, {
          status: "expired",
          updatedAt: args.now,
        });
      } else if (status === "pending" || status === "confirming") {
        await ctx.db.patch(challenge._id, {
          status: "superseded",
          updatedAt: args.now,
        });
      }
    }

    const throttlePatch = isEmailChange
      ? {
          emailChangeWindowStartedAt: sendThrottle.windowStartedAt,
          emailChangeSendCount: sendThrottle.sendCount,
          emailChangeLastSentAt: sendThrottle.lastSentAt,
        }
      : {
          passwordResetWindowStartedAt: sendThrottle.windowStartedAt,
          passwordResetSendCount: sendThrottle.sendCount,
          passwordResetLastSentAt: sendThrottle.lastSentAt,
        };
    if (throttle) {
      await ctx.db.patch(throttle._id, throttlePatch);
    } else {
      await ctx.db.insert("accountSecurityThrottles", {
        userId: args.userId,
        ...throttlePatch,
      });
    }

    const challengeId = await ctx.db.insert("accountSecurityChallenges", {
      userId: args.userId,
      type: args.type,
      status: "pending",
      codeHash: args.codeHash,
      currentEmail,
      newEmail,
      attemptCount: 0,
      maxAttempts: SECURITY_CODE_MAX_ATTEMPTS,
      expiresAt: args.now + SECURITY_CODE_TTL_MS,
      createdAt: args.now,
      updatedAt: args.now,
      sentAt: args.now,
    });
    return {
      ok: true as const,
      challengeId,
      expiresAt: args.now + SECURITY_CODE_TTL_MS,
    };
  },
});

export const failSecurityChallengeDelivery = internalMutation({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    userId: v.id("users"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (
      challenge?.userId === args.userId &&
      (challenge.status === "pending" || challenge.status === "confirming")
    ) {
      await ctx.db.patch(challenge._id, {
        status: "superseded",
        updatedAt: args.now,
      });
    }
  },
});

export const beginSecurityChallengeConfirmation = internalMutation({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    userId: v.id("users"),
    type: challengeType,
    codeHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (
      !challenge ||
      challenge.userId !== args.userId ||
      challenge.type !== args.type
    ) {
      return { ok: false as const, reason: "invalid" as const };
    }
    const status = activeChallengeStatus(
      challenge.status,
      challenge.expiresAt,
      args.now,
    );
    if (status === "expired") {
      if (challenge.status !== "expired") {
        await ctx.db.patch(challenge._id, {
          status: "expired",
          updatedAt: args.now,
        });
      }
      return { ok: false as const, reason: "expired" as const };
    }
    if (status !== "pending") {
      return { ok: false as const, reason: status };
    }

    const next = nextAttemptState({
      attemptCount: challenge.attemptCount,
      maxAttempts: challenge.maxAttempts,
      matches: challenge.codeHash === args.codeHash,
    });
    await ctx.db.patch(challenge._id, {
      attemptCount: next.attemptCount,
      status: next.status,
      updatedAt: args.now,
    });
    if (next.status === "too_many_attempts") {
      return {
        ok: false as const,
        reason: "too_many_attempts" as const,
      };
    }
    if (next.status !== "confirming") {
      return { ok: false as const, reason: "invalid_code" as const };
    }

    const user = await ctx.db.get(args.userId);
    const account = await getPasswordAccount(ctx, args.userId);
    if (
      !user ||
      !account ||
      normalizeAccountEmail(account.providerAccountId) !==
        challenge.currentEmail
    ) {
      await ctx.db.patch(challenge._id, {
        status: "superseded",
        updatedAt: args.now,
      });
      return { ok: false as const, reason: "account_changed" as const };
    }
    return {
      ok: true as const,
      challenge,
      stripeCustomerId: user.stripeCustomerId,
      accountId: account._id,
    };
  },
});

export const releaseSecurityChallengeConfirmation = internalMutation({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    userId: v.id("users"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (
      challenge?.userId === args.userId &&
      challenge.status === "confirming"
    ) {
      await ctx.db.patch(challenge._id, {
        status:
          challenge.expiresAt <= args.now ? "expired" : "pending",
        updatedAt: args.now,
      });
    }
  },
});

export const completeEmailChange = internalMutation({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    userId: v.id("users"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (
      !challenge ||
      challenge.userId !== args.userId ||
      challenge.type !== "email_change" ||
      challenge.status !== "confirming" ||
      !challenge.newEmail
    ) {
      throw new Error("Email change is no longer active");
    }
    const account = await getPasswordAccount(ctx, args.userId);
    if (
      !account ||
      normalizeAccountEmail(account.providerAccountId) !==
        challenge.currentEmail
    ) {
      throw new Error("The login email changed before confirmation");
    }
    const duplicate = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q
          .eq("provider", "password")
          .eq("providerAccountId", challenge.newEmail!),
      )
      .unique();
    if (duplicate && duplicate._id !== account._id) {
      throw new Error("An account already exists for that email address");
    }
    const users = await ctx.db.query("users").collect();
    const duplicateUser = users.some((user) => {
      if (user._id === args.userId || !user.email) return false;
      const emails = Array.isArray(user.email) ? user.email : [user.email];
      return emails.some(
        (email) =>
          normalizeAccountEmail(email) === challenge.newEmail,
      );
    });
    if (duplicateUser) {
      throw new Error("An account already exists for that email address");
    }

    await ctx.db.patch(account._id, {
      providerAccountId: challenge.newEmail,
      emailVerified: challenge.newEmail,
    });
    const verificationCode = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .unique();
    if (verificationCode) {
      await ctx.db.delete(verificationCode._id);
    }
    await ctx.db.patch(args.userId, {
      email: challenge.newEmail,
      emailVerificationTime: args.now,
    });
    await ctx.db.patch(challenge._id, {
      status: "consumed",
      updatedAt: args.now,
    });
    return { email: challenge.newEmail };
  },
});

export const completePasswordReset = internalMutation({
  args: {
    challengeId: v.id("accountSecurityChallenges"),
    userId: v.id("users"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (
      !challenge ||
      challenge.userId !== args.userId ||
      challenge.type !== "password_reset" ||
      challenge.status !== "confirming"
    ) {
      throw new Error("Password reset is no longer active");
    }
    await ctx.db.patch(challenge._id, {
      status: "consumed",
      updatedAt: args.now,
    });
  },
});

export const getActiveEmailChange = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const challenges = await ctx.db
      .query("accountSecurityChallenges")
      .withIndex("byUserAndType", (q) =>
        q.eq("userId", userId).eq("type", "email_change"),
      )
      .collect();
    const challenge = challenges
      .filter(
        (item) =>
          activeChallengeStatus(item.status, item.expiresAt, Date.now()) ===
          "pending",
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return challenge
      ? {
          challengeId: challenge._id,
          newEmail: challenge.newEmail!,
          expiresAt: challenge.expiresAt,
        }
      : null;
  },
});

export const getAccountPasswordResetChallenge = query({
  args: { challengeId: v.string() },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const normalizedChallengeId = ctx.db.normalizeId(
      "accountSecurityChallenges",
      challengeId,
    );
    if (!normalizedChallengeId) return null;
    const challenge = await ctx.db.get(normalizedChallengeId);
    if (
      !challenge ||
      challenge.userId !== userId ||
      challenge.type !== "password_reset"
    ) {
      return null;
    }
    return {
      email: challenge.currentEmail,
      status: activeChallengeStatus(
        challenge.status,
        challenge.expiresAt,
        Date.now(),
      ),
      expiresAt: challenge.expiresAt,
    };
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
}
