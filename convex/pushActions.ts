"use node";

import webpush from "web-push";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  classifyPushFailure,
  pushRetryDelay,
  safeInternalPath,
} from "../shared/push-notifications";

type DeliveryContext = {
  notification: {
    _id: Id<"notifications">;
    title: string;
    body: string;
    href: string;
    createdAt: number;
  };
  unreadCount: number;
  targets: Array<{
    subscription: {
      _id: Id<"pushSubscriptions">;
      endpoint: string;
      p256dh: string;
      auth: string;
    };
    delivery?: {
      status: "pending" | "sent" | "retrying" | "failed" | "expired";
    } | null;
  }>;
} | null;

const getDeliveryTargets = makeFunctionReference<
  "query",
  {
    notificationId: Id<"notifications">;
    subscriptionId?: Id<"pushSubscriptions">;
  },
  DeliveryContext
>("pushData:getDeliveryTargets");
const beginAttempt = makeFunctionReference<
  "mutation",
  {
    notificationId: Id<"notifications">;
    subscriptionId: Id<"pushSubscriptions">;
  },
  { deliveryId: Id<"pushDeliveries">; attemptCount: number } | null
>("pushData:beginAttempt");
const markSent = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"pushDeliveries">;
    subscriptionId: Id<"pushSubscriptions">;
  }
>("pushData:markSent");
const markFailed = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"pushDeliveries">;
    subscriptionId: Id<"pushSubscriptions">;
    status: "retrying" | "failed" | "expired";
    error: string;
    nextAttemptAt?: number;
  }
>("pushData:markFailed");
const deliverNotificationRef = makeFunctionReference<
  "action",
  {
    notificationId: Id<"notifications">;
    subscriptionId?: Id<"pushSubscriptions">;
  }
>("pushActions:deliverNotification");

export const deliverNotification = internalAction({
  args: {
    notificationId: v.id("notifications"),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    const subject = process.env.WEB_PUSH_SUBJECT;
    if (!publicKey || !privateKey || !subject) return;

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const context = await ctx.runQuery(getDeliveryTargets, args);
    if (!context) return;

    const href = safeInternalPath(context.notification.href) || "/home";
    await Promise.all(
      context.targets.map(async ({ subscription, delivery }) => {
        if (
          delivery?.status === "sent" ||
          delivery?.status === "failed" ||
          delivery?.status === "expired"
        ) {
          return;
        }

        const attempt = await ctx.runMutation(beginAttempt, {
          notificationId: args.notificationId,
          subscriptionId: subscription._id,
        });
        if (!attempt) return;

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              notificationId: context.notification._id,
              title: context.notification.title,
              body: context.notification.body,
              href,
              createdAt: context.notification.createdAt,
              unreadCount: context.unreadCount,
            }),
            {
              TTL: 24 * 60 * 60,
              urgency: "normal",
            },
          );
          await ctx.runMutation(markSent, {
            deliveryId: attempt.deliveryId,
            subscriptionId: subscription._id,
          });
        } catch (error) {
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
              ? error.statusCode
              : undefined;
          const message =
            error instanceof Error ? error.message : "Push delivery failed";
          const failure = classifyPushFailure(statusCode);
          const retryDelay = pushRetryDelay(attempt.attemptCount);

          if (failure === "retryable" && retryDelay !== undefined) {
            const nextAttemptAt = Date.now() + retryDelay;
            await ctx.runMutation(markFailed, {
              deliveryId: attempt.deliveryId,
              subscriptionId: subscription._id,
              status: "retrying",
              error: message,
              nextAttemptAt,
            });
            await ctx.scheduler.runAfter(retryDelay, deliverNotificationRef, {
              notificationId: args.notificationId,
              subscriptionId: subscription._id,
            });
            return;
          }

          await ctx.runMutation(markFailed, {
            deliveryId: attempt.deliveryId,
            subscriptionId: subscription._id,
            status: failure === "expired" ? "expired" : "failed",
            error: message,
          });
        }
      }),
    );
  },
});
