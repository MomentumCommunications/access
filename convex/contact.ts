"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { Resend } from "resend";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getResendApiKey, resendFromAddress } from "./resendConfig";

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

    const resend = new Resend(getResendApiKey());
    const to = contactRecipientEmail();
    const { error } = await resend.emails.send({
      from: resendFromAddress,
      to: [to],
      subject: `[Access Contact] ${cleanSubject}`,
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
    if (error) {
      throw new Error(error.message);
    }

    return { sent: true };
  },
});
