import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { hasUserRole, resolveUserRoles } from "./lib/roles";
import { recordActivityEvent } from "./lib/activityLog";
import {
  ACCOUNT_INVITATION_TTL_MS,
  evaluateAccountInvitationClaim,
  effectiveInvitationStatus,
  normalizeInvitationEmail,
  replacementInvitationStatus,
} from "../shared/account-invitations";

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) throw new Error("Admin access required.");
  return user;
}

async function authAccountExists(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return Boolean(
    await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId),
      )
      .first(),
  );
}

export const adminGetStatus = query({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) return null;
    const invitations = await ctx.db
      .query("accountInvitations")
      .withIndex("byTargetUser", (q) => q.eq("targetUserId", targetUserId))
      .order("desc")
      .collect();
    const latest = invitations[0];
    const memberships = await ctx.db
      .query("householdMembers")
      .withIndex("byUser", (q) => q.eq("userId", targetUserId))
      .collect();
    const payers = await ctx.db
      .query("householdPayers")
      .withIndex("byUser", (q) => q.eq("userId", targetUserId))
      .collect();
    return {
      hasLogin: await authAccountExists(ctx, targetUserId),
      latestInvitation: latest
        ? {
            ...latest,
            effectiveStatus: effectiveInvitationStatus(
              latest.status,
              latest.expiresAt,
              Date.now(),
            ),
          }
        : null,
      billing: {
        householdMembershipCount: memberships.length,
        payerCount: payers.length,
        hasStripeCustomer: Boolean(target.stripeCustomerId),
      },
    };
  },
});

export const getPreviewByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const invitation = await ctx.db
      .query("accountInvitations")
      .withIndex("byTokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation) return null;
    const target = await ctx.db.get(invitation.targetUserId);
    if (!target) return null;
    return {
      invitation,
      effectiveStatus: effectiveInvitationStatus(
        invitation.status,
        invitation.expiresAt,
        Date.now(),
      ),
      target: {
        firstName: target.firstName,
        lastName: target.lastName,
        email: invitation.invitedEmail,
        roles: resolveUserRoles(target),
      },
    };
  },
});

export const createPending = internalMutation({
  args: {
    targetUserId: v.id("users"),
    tokenHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, { targetUserId, tokenHash, now }) => {
    const inviter = await requireAdmin(ctx);
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error("Account not found.");
    if (await authAccountExists(ctx, targetUserId)) {
      throw new Error(
        "This account already has login credentials. Manage its roles directly.",
      );
    }
    const rawEmail = Array.isArray(target.email) ? target.email[0] : target.email;
    const invitedEmail = normalizeInvitationEmail(rawEmail || "");
    if (!invitedEmail) throw new Error("The account needs an email address.");

    const previous = await ctx.db
      .query("accountInvitations")
      .withIndex("byTargetUser", (q) => q.eq("targetUserId", targetUserId))
      .collect();
    for (const invitation of previous) {
      if (invitation.status !== "pending") continue;
      const replacementStatus = replacementInvitationStatus(
        invitation.status,
        invitation.expiresAt,
        now,
      );
      await ctx.db.patch(invitation._id, {
        status: replacementStatus,
        ...(replacementStatus === "superseded" ? { supersededAt: now } : {}),
      });
      if (replacementStatus === "superseded") {
        await recordActivityEvent(ctx, {
          entityType: "user",
          entityId: targetUserId,
          actorId: inviter._id,
          eventType: "account_invitation_superseded",
          summary: `Superseded the previous account invitation for ${invitedEmail}.`,
          metadata: { invitationId: invitation._id },
        });
      }
    }

    const invitationId = await ctx.db.insert("accountInvitations", {
      targetUserId,
      invitedEmail,
      tokenHash,
      inviterUserId: inviter._id,
      inviterContext: "admin",
      purpose: "account_claim",
      status: "pending",
      expiresAt: now + ACCOUNT_INVITATION_TTL_MS,
      createdAt: now,
    });
    await recordActivityEvent(ctx, {
      entityType: "user",
      entityId: targetUserId,
      actorId: inviter._id,
      eventType: "account_invitation_created",
      summary: `Created an account invitation for ${invitedEmail}.`,
      metadata: { invitationId, purpose: "account_claim" },
    });
    return { invitationId, invitedEmail, expiresAt: now + ACCOUNT_INVITATION_TTL_MS };
  },
});

export const markSent = internalMutation({
  args: { invitationId: v.id("accountInvitations"), sentAt: v.number() },
  handler: async (ctx, { invitationId, sentAt }) => {
    const actor = await requireAdmin(ctx);
    const invitation = await ctx.db.get(invitationId);
    if (!invitation || invitation.status !== "pending") return false;
    await ctx.db.patch(invitationId, { sentAt });
    await recordActivityEvent(ctx, {
      entityType: "user",
      entityId: invitation.targetUserId,
      actorId: actor._id,
      eventType: "account_invitation_sent",
      summary: `Sent an account invitation to ${invitation.invitedEmail}.`,
      metadata: { invitationId },
    });
    return true;
  },
});

export const consumeByHash = internalMutation({
  args: { tokenHash: v.string(), now: v.number() },
  handler: async (ctx, { tokenHash, now }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in before accepting this invitation.");
    const invitation = await ctx.db
      .query("accountInvitations")
      .withIndex("byTokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation) throw new Error("This invitation is not valid.");
    const user = await ctx.db.get(userId);
    const email = normalizeInvitationEmail(
      String(Array.isArray(user?.email) ? user.email[0] : user?.email || ""),
    );
    const claim = evaluateAccountInvitationClaim({
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      invitedEmail: invitation.invitedEmail,
      currentEmail: email,
      targetUserId: invitation.targetUserId,
      currentUserId: userId,
      emailVerified: Boolean(user?.emailVerificationTime),
      now,
    });
    if (!claim.ok && claim.reason === "expired") {
      await ctx.db.patch(invitation._id, { status: "expired" });
    }
    if (!claim.ok && claim.reason === "wrong_account") {
      throw new Error("This invitation belongs to a different account.");
    }
    if (!claim.ok && claim.reason === "wrong_email") {
      throw new Error("Verify the invited email before accepting.");
    }
    if (!claim.ok) {
      throw new Error(
        `This invitation is ${claim.reason.replace("_", " ")}.`,
      );
    }
    await ctx.db.patch(invitation._id, {
      status: "consumed",
      consumedAt: now,
    });
    await recordActivityEvent(ctx, {
      entityType: "user",
      entityId: userId,
      actorId: userId,
      eventType: "account_invitation_consumed",
      summary: `Accepted the account invitation for ${invitation.invitedEmail}.`,
      metadata: { invitationId: invitation._id },
    });
    return true;
  },
});

export const revoke = mutation({
  args: { invitationId: v.id("accountInvitations") },
  handler: async (ctx, { invitationId }) => {
    const actor = await requireAdmin(ctx);
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new Error("Invitation not found.");
    if (invitation.status !== "pending") {
      throw new Error("Only pending invitations can be revoked.");
    }
    const now = Date.now();
    await ctx.db.patch(invitationId, {
      status: "revoked",
      revokedAt: now,
    });
    await recordActivityEvent(ctx, {
      entityType: "user",
      entityId: invitation.targetUserId,
      actorId: actor._id,
      eventType: "account_invitation_revoked",
      summary: `Revoked the account invitation for ${invitation.invitedEmail}.`,
      metadata: { invitationId },
    });
  },
});
