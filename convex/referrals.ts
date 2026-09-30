import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { hasUserRole } from "./lib/roles";
import { connectVerifiedReferral } from "./lib/referrals";
import { recordActivityEvent } from "./lib/activityLog";
import {
  accountEmails,
  assertReferralDecision,
  assertReferralSendAllowed,
  normalizeReferralEmail,
  REFERRAL_REWARD_CENTS,
  REFERRAL_SEND_WINDOW_MS,
  verifiedReferralEmail,
} from "../shared/referrals";

async function requireMember(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (
    !hasUserRole(user, "member") ||
    user.status === "inactive" ||
    user.onboardingStatus !== "complete"
  ) {
    throw new Error(
      "Referrals are available to active members who have completed registration.",
    );
  }
  return user;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) throw new Error("Admin access required.");
  return user;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireMember(ctx);
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("byReferrer", (q) => q.eq("referrerUserId", user._id))
      .order("desc")
      .collect();
    return referrals.map((referral) => ({
      _id: referral._id,
      invitedEmail: referral.invitedEmail,
      token: referral.token,
      status: referral.status,
      createdAt: referral.createdAt,
      lastSentAt: referral.lastSentAt,
      rewardCents: referral.rewardCents,
    }));
  },
});

// A token is an unguessable invitation reference, not an authentication credential.
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const referral = await ctx.db
      .query("referrals")
      .withIndex("byToken", (q) => q.eq("token", token))
      .unique();
    if (!referral) return null;
    const referrer = await ctx.db.get(referral.referrerUserId);
    return {
      email: referral.invitedEmail,
      referrerName:
        referrer?.firstName || referrer?.displayName || "Your friend",
    };
  },
});

export const prepareSend = internalMutation({
  args: { email: v.string(), token: v.string() },
  handler: async (ctx, { email, token }) => {
    const user = await requireMember(ctx);
    const invitedEmail = normalizeReferralEmail(email);
    if (accountEmails(user.email).includes(invitedEmail))
      throw new Error("You cannot refer yourself.");
    const now = Date.now();
    const previous = await ctx.db
      .query("referrals")
      .withIndex("byInvitedEmail", (q) => q.eq("invitedEmail", invitedEmail))
      .first();
    if (previous && previous.referrerUserId !== user._id) {
      throw new Error("This email is not available for a new referral.");
    }
    // Check all legacy/imported email shapes, but only connect an unambiguous verified address.
    const users = await ctx.db.query("users").collect();
    const verifiedMatches = users.filter(
      (candidate) => verifiedReferralEmail(candidate) === invitedEmail,
    );
    const target = verifiedMatches.length === 1 ? verifiedMatches[0] : null;
    if (target) {
      const existing = await ctx.db
        .query("referrals")
        .withIndex("byReferredUser", (q) => q.eq("referredUserId", target._id))
        .first();
      if (existing && existing._id !== previous?._id)
        throw new Error("This email is not available for a new referral.");
    }
    const recent = await ctx.db
      .query("referralSendAttempts")
      .withIndex("byReferrerAndTime", (q) =>
        q
          .eq("referrerUserId", user._id)
          .gt("attemptedAt", now - REFERRAL_SEND_WINDOW_MS),
      )
      .collect();
    const lastRecipientAttempt = await ctx.db
      .query("referralSendAttempts")
      .withIndex("byEmailAndTime", (q) => q.eq("invitedEmail", invitedEmail))
      .order("desc")
      .first();
    assertReferralSendAllowed({
      recentCount: recent.length,
      lastRecipientAttemptAt: lastRecipientAttempt?.attemptedAt,
      now,
    });
    const referralId =
      previous?._id ??
      (await ctx.db.insert("referrals", {
        referrerUserId: user._id,
        invitedEmail,
        token,
        rewardCents: REFERRAL_REWARD_CENTS,
        status: "invited",
        createdAt: now,
        history: [],
      }));
    if (target) await connectVerifiedReferral(ctx, target);
    // Reserve the send in the same transaction so concurrent requests cannot evade limits.
    const attemptId = await ctx.db.insert("referralSendAttempts", {
      referralId,
      referrerUserId: user._id,
      invitedEmail,
      attemptedAt: now,
    });
    return {
      referralId,
      attemptId,
      email: invitedEmail,
      token: previous?.token ?? token,
      referrerName: user.firstName || user.displayName || "A friend",
    };
  },
});

export const recordDelivery = internalMutation({
  args: { attemptId: v.id("referralSendAttempts"), sent: v.boolean() },
  handler: async (ctx, { attemptId, sent }) => {
    const attempt = await ctx.db.get(attemptId);
    if (
      !attempt ||
      attempt.deliveredAt !== undefined ||
      attempt.failedAt !== undefined
    )
      return;
    const now = Date.now();
    await ctx.db.patch(
      attemptId,
      sent ? { deliveredAt: now } : { failedAt: now },
    );
    if (sent) await ctx.db.patch(attempt.referralId, { lastSentAt: now });
  },
});

export const adminForAccount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const incoming = await ctx.db
      .query("referrals")
      .withIndex("byReferredUser", (q) => q.eq("referredUserId", userId))
      .first();
    const outgoing = await ctx.db
      .query("referrals")
      .withIndex("byReferrer", (q) => q.eq("referrerUserId", userId))
      .order("desc")
      .collect();
    async function decorate(referral: Doc<"referrals">) {
      async function identity(id: Doc<"users">["_id"]) {
        const user = await ctx.db.get(id);
        return {
          _id: id,
          name:
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.name ||
            accountEmails(user?.email)[0] ||
            "Account",
        };
      }
      return {
        ...referral,
        referrer: await identity(referral.referrerUserId),
        referred: referral.referredUserId
          ? await identity(referral.referredUserId)
          : null,
        history: await Promise.all(
          referral.history.map(async (entry) => ({
            ...entry,
            actor: await identity(entry.actorUserId),
          })),
        ),
      };
    }
    return {
      incoming: incoming ? await decorate(incoming) : null,
      outgoing: await Promise.all(outgoing.map(decorate)),
    };
  },
});

export const adminSetStatus = mutation({
  args: {
    referralId: v.id("referrals"),
    status: v.union(
      v.literal("pending_review"),
      v.literal("credit_applied"),
      v.literal("not_eligible"),
    ),
    expectedStatus: v.union(
      v.literal("invited"),
      v.literal("pending_review"),
      v.literal("credit_applied"),
      v.literal("not_eligible"),
    ),
    confirmed: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { referralId, status, expectedStatus, confirmed, note },
  ) => {
    const actor = await requireAdmin(ctx);
    const referral = await ctx.db.get(referralId);
    if (!referral) throw new Error("Referral not found.");
    if (referral.status !== status && referral.status !== expectedStatus)
      throw new Error(
        "This referral changed. Refresh it before making a decision.",
      );
    if (
      !assertReferralDecision({
        current: referral.status,
        next: status,
        connected: Boolean(referral.referredUserId),
        confirmed,
        note,
      })
    )
      return;
    const entry = {
      status,
      actorUserId: actor._id,
      at: Date.now(),
      note: note?.trim() || undefined,
    };
    await ctx.db.patch(referralId, {
      status,
      history: [...referral.history, entry],
    });
    for (const userId of [referral.referrerUserId, referral.referredUserId!]) {
      await recordActivityEvent(ctx, {
        entityType: "user",
        entityId: userId,
        actorId: actor._id,
        eventType: "referral_status_changed",
        summary: `Referral ${status.replaceAll("_", " ")}: ${referral.invitedEmail}.`,
        metadata: { referralId, previousStatus: referral.status, ...entry },
      });
    }
  },
});
