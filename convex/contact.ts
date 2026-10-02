"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { Resend } from "resend";
import { ConvexError, v } from "convex/values";
import { createHash } from "node:crypto";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getResendApiKey, resendFromAddress } from "./resendConfig";

import {
  accountHelpFlowLabels,
  accountHelpSchema,
} from "../shared/account-help";

const contactTopicValidator = v.union(
  v.literal("unspecified"),
  v.literal("enrollment"),
  v.literal("class_request"),
  v.literal("billing"),
  v.literal("account_access"),
  v.literal("bug_report"),
  v.literal("feedback"),
  v.literal("other"),
);

function contactRecipientEmail() {
  const email = process.env.ACCESS_CONTACT_EMAIL?.trim();
  if (!email) {
    throw new Error(
      "Missing ACCESS_CONTACT_EMAIL. Set it in Convex environment variables.",
    );
  }
  return email;
}

async function sendStudioContactEmail({
  subject,
  text,
  replyTo,
}: {
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const resend = new Resend(getResendApiKey());
  const { error } = await resend.emails.send({
    from: resendFromAddress,
    to: [contactRecipientEmail()],
    subject: `[Access Contact] ${subject}`,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) throw new Error(error.message);
}

function userDisplayName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    "Unknown user"
  );
}

function userEmail(email?: string | string[]) {
  if (Array.isArray(email)) return email.join(", ");
  return email || "Not set";
}

export const sendContactMessage = action({
  args: {
    subject: v.string(),
    topic: contactTopicValidator,
    message: v.string(),
  },
  handler: async (ctx, { subject, topic, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const user = await ctx.runQuery(api.users.current, {});
    if (!user) throw new Error("Not authenticated.");

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanSubject || cleanSubject.length > 120) {
      throw new Error("Subject must be between 1 and 120 characters.");
    }
    if (!cleanMessage || cleanMessage.length > 5000) {
      throw new Error("Message must be between 1 and 5000 characters.");
    }

    await sendStudioContactEmail({
      subject: cleanSubject,
      text: [
        "A contact form message was submitted from Access Momentum.",
        "",
        "Message",
        "-------",
        cleanMessage,
        "",
        "Submission",
        "----------",
        `Topic: ${topic}`,
        `Subject: ${cleanSubject}`,
        "",
        "User",
        "----",
        `Name: ${userDisplayName(user)}`,
        `User ID: ${user._id}`,
        `Email: ${userEmail(user.email)}`,
        `Phone: ${user.phone || "Not set"}`,
        `Roles: ${(user.roles || [user.role || "member"]).join(", ")}`,
      ].join("\n"),
    });
    return { sent: true };
  },
});

export const sendAccountHelp = action({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    flow: v.union(
      v.literal("signup"),
      v.literal("login"),
      v.literal("password_reset"),
      v.literal("account_password_reset"),
      v.literal("unknown"),
    ),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ sent: true }> => {
    // Silently discard bot submissions; never send a message or reserve quota.
    if (args.website) return { sent: true };
    const parsed = accountHelpSchema.safeParse(args);
    if (!parsed.success) throw new ConvexError(parsed.error.issues[0].message);
    const { name, phone, message, flow } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    await ctx.runMutation(internal.contactData.reserveAccountHelpSend, {
      emailHash: createHash("sha256").update(email).digest("hex"),
    });
    try {
      await sendStudioContactEmail({
        subject: `Account access help — ${accountHelpFlowLabels[flow]}`,
        replyTo: email,
        text: [
          "A public account-help request was submitted from Access Momentum.",
          "Contact details below are supplied by the visitor and are UNVERIFIED.",
          "For existing-account recovery, establish identity independently using contact details already on file. Do not treat this request as proof of account ownership.",
          "",
          "Topic: account_access",
          `Flow: ${accountHelpFlowLabels[flow]}`,
          `Name: ${name}`,
          `Account email (unverified): ${email}`,
          `Callback number (unverified): ${phone || "Not provided"}`,
          "",
          "Message",
          "-------",
          message ||
            "No additional message. The visitor needs help finding their code.",
        ].join("\n"),
      });
    } catch {
      throw new ConvexError(
        "We couldn’t send your message right now. Your details are still here; please try again in a minute.",
      );
    }
    return { sent: true };
  },
});
