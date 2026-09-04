"use node";

import { Buffer } from "node:buffer";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import type { MailchimpMember } from "./lib/mailchimp";
import {
  isRetryableMailchimpFailure,
  mailchimpMemberPayload,
  mailchimpRetryDelay,
  mailchimpServerPrefix,
} from "./lib/mailchimp";
import { mailchimpMemberUrl } from "./lib/mailchimpNode";

const getCompletedClient = makeFunctionReference<
  "query",
  { userId: Id<"users"> },
  MailchimpMember | null
>("mailchimpData:getCompletedClient");

const syncCompletedClientRef = makeFunctionReference<
  "action",
  { userId: Id<"users">; attempt: number }
>("mailchimpActions:syncCompletedClient");

function configuredMailchimp() {
  const apiKey = process.env.MAILCHIMP_API_KEY?.trim();
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID?.trim();
  const serverPrefix = apiKey ? mailchimpServerPrefix(apiKey) : null;
  if (!apiKey || !audienceId || !serverPrefix) return null;
  return { apiKey, audienceId, serverPrefix };
}

async function safeMailchimpErrorTitle(response: Response) {
  try {
    const body = (await response.json()) as { title?: unknown };
    return typeof body.title === "string"
      ? body.title.slice(0, 200)
      : "Mailchimp request failed";
  } catch {
    return "Mailchimp request failed";
  }
}

export const syncCompletedClient = internalAction({
  args: {
    userId: v.id("users"),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const config = configuredMailchimp();
    if (!config) {
      console.error(
        "Mailchimp client sync is not configured. Set MAILCHIMP_API_KEY and MAILCHIMP_AUDIENCE_ID, and ensure the API key ends with its server prefix.",
      );
      return;
    }

    const member = await ctx.runQuery(getCompletedClient, {
      userId: args.userId,
    });
    if (!member) return;

    let response: Response;
    try {
      response = await fetch(
        mailchimpMemberUrl({
          serverPrefix: config.serverPrefix,
          audienceId: config.audienceId,
          email: member.email,
        }),
        {
          method: "PUT",
          headers: {
            Authorization: `Basic ${Buffer.from(`access:${config.apiKey}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mailchimpMemberPayload(member)),
        },
      );
    } catch {
      const retryDelay = mailchimpRetryDelay(args.attempt);
      if (retryDelay !== undefined) {
        await ctx.scheduler.runAfter(retryDelay, syncCompletedClientRef, {
          userId: args.userId,
          attempt: args.attempt + 1,
        });
        return;
      }
      console.error("Mailchimp client sync failed after network retries.", {
        userId: args.userId,
      });
      return;
    }

    if (response.ok) return;

    if (isRetryableMailchimpFailure(response.status)) {
      const retryDelay = mailchimpRetryDelay(args.attempt);
      if (retryDelay !== undefined) {
        await ctx.scheduler.runAfter(retryDelay, syncCompletedClientRef, {
          userId: args.userId,
          attempt: args.attempt + 1,
        });
        return;
      }
    }

    console.error("Mailchimp client sync failed.", {
      userId: args.userId,
      status: response.status,
      title: await safeMailchimpErrorTitle(response),
    });
  },
});
