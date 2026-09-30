"use node";

import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getResendApiKey, resendFromAddress } from "./resendConfig";

export const send = action({
  args: { email: v.string() },
  handler: async (
    ctx,
    { email },
  ): Promise<{ url: string; sent: boolean; warning?: string }> => {
    const baseUrl = process.env.ACCESS_APP_URL?.trim().replace(/\/+$/, "");
    if (!baseUrl)
      throw new Error(
        "Missing ACCESS_APP_URL. Set it in Convex environment variables.",
      );
    const invitation = await ctx.runMutation(internal.referrals.prepareSend, {
      email,
      token: randomBytes(32).toString("base64url"),
    });
    const url = `${baseUrl}/referral/${encodeURIComponent(invitation.token)}`;
    let sent = false;
    try {
      const resend = new Resend(getResendApiKey());
      const { error } = await resend.emails.send(
        {
          from: resendFromAddress,
          to: [invitation.email],
          subject: `${invitation.referrerName} invited you to Access Momentum`,
          text: [
            `${invitation.referrerName} would love for you to join Access Momentum!`,
            "",
            `Create an account or sign in using ${invitation.email}: ${url}`,
            "",
            "Your friend can receive $50 in credit after you pay for one full month of regular classes. A trial or prorated partial month alone does not qualify. Eligibility is reviewed by our team, and there is one reward per referred client.",
            "",
            "Your referral is connected using your verified email, even if you register without this link.",
            "If you weren’t expecting this invitation, you can ignore it.",
          ].join("\n"),
        },
        { idempotencyKey: `referral-${invitation.attemptId}` },
      );
      if (error) throw new Error(error.message);
      sent = true;
    } catch {
      // Keep the invitation usable even when the email provider is unavailable.
    }
    await ctx.runMutation(internal.referrals.recordDelivery, {
      attemptId: invitation.attemptId,
      sent,
    });
    return {
      url,
      sent,
      ...(!sent
        ? {
            warning:
              "Your referral was saved, but the email could not be sent. Copy the link and share it yourself.",
          }
        : {}),
    };
  },
});
