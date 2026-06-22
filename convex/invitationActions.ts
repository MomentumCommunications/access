"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { getResendApiKey, resendFromAddress } from "./resendConfig";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function appUrl() {
  const value = process.env.ACCESS_APP_URL?.trim().replace(/\/+$/, "");
  if (!value) {
    throw new Error(
      "Missing ACCESS_APP_URL. Set it in Convex environment variables.",
    );
  }
  return value;
}

function invitationUrl(token: string) {
  return `${appUrl()}/invite/${encodeURIComponent(token)}`;
}

const createPendingRef = makeFunctionReference<
  "mutation",
  { targetUserId: Id<"users">; tokenHash: string; now: number },
  {
    invitationId: Id<"accountInvitations">;
    invitedEmail: string;
    expiresAt: number;
  }
>("invitations:createPending");

const markSentRef = makeFunctionReference<
  "mutation",
  { invitationId: Id<"accountInvitations">; sentAt: number },
  boolean
>("invitations:markSent");

const previewByHashRef = makeFunctionReference<
  "query",
  { tokenHash: string },
  {
    invitation: { expiresAt: number };
    effectiveStatus:
      | "pending"
      | "consumed"
      | "expired"
      | "revoked"
      | "superseded";
    target: {
      email: string;
      firstName?: string;
      lastName?: string;
      roles: Array<"admin" | "staff" | "member">;
    };
  } | null
>("invitations:getPreviewByHash");

const consumeByHashRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; now: number },
  boolean
>("invitations:consumeByHash");

export const createLink = action({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated.");
    const token = newToken();
    const url = invitationUrl(token);
    const invitation = await ctx.runMutation(createPendingRef, {
      targetUserId,
      tokenHash: tokenHash(token),
      now: Date.now(),
    });
    return { ...invitation, url };
  },
});

export const send = action({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated.");
    const token = newToken();
    const url = invitationUrl(token);
    const invitation = await ctx.runMutation(createPendingRef, {
      targetUserId,
      tokenHash: tokenHash(token),
      now: Date.now(),
    });
    try {
      const resend = new Resend(getResendApiKey());
      const { error } = await resend.emails.send({
        from: resendFromAddress,
        to: [invitation.invitedEmail],
        subject: "You’re invited to Access Momentum",
        text: [
          "An Access Momentum account is ready for you.",
          "",
          `Create your login using this secure link: ${url}`,
          "",
          "This link expires in 7 days and can only be used with this email address.",
        ].join("\n"),
      });
      if (error) throw new Error(error.message);
      await ctx.runMutation(markSentRef, {
        invitationId: invitation.invitationId,
        sentAt: Date.now(),
      });
      return { ...invitation, url, sent: true as const };
    } catch (error) {
      console.error("Invitation email delivery failed", error);
      return {
        ...invitation,
        url,
        sent: false as const,
        warning:
          "The invitation was created but the email could not be sent. Copy the link and send it manually.",
      };
    }
  },
});

export const preview = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token || token.length > 512) return null;
    const result = await ctx.runQuery(previewByHashRef, {
      tokenHash: tokenHash(token),
    });
    if (!result) return null;
    return {
      status: result.effectiveStatus,
      email: result.target.email,
      firstName: result.target.firstName,
      lastName: result.target.lastName,
      roles: result.target.roles,
      expiresAt: result.invitation.expiresAt,
    };
  },
});

export const consume = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated.");
    return await ctx.runMutation(consumeByHashRef, {
      tokenHash: tokenHash(token),
      now: Date.now(),
    });
  },
});
