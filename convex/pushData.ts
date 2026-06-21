import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { selectPushTargets } from "../shared/push-notifications";

export const getDeliveryTargets = internalQuery({
  args: {
    notificationId: v.id("notifications"),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
  },
  handler: async (ctx, { notificationId, subscriptionId }) => {
    const notification = await ctx.db.get(notificationId);
    if (!notification) return null;

    const allSubscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("byRecipient", (q) =>
        q.eq("recipientUserId", notification.recipientUserId),
      )
      .collect();
    const subscriptions = selectPushTargets(
      allSubscriptions.map((subscription) => ({
        ...subscription,
        id: subscription._id,
      })),
      notification.recipientUserId,
      subscriptionId,
    );

    const recipientNotifications = await ctx.db
      .query("notifications")
      .withIndex("byRecipient", (q) =>
        q.eq("recipientUserId", notification.recipientUserId),
      )
      .collect();

    const targets = await Promise.all(
      subscriptions.map(async (subscription) => {
        const delivery = await ctx.db
          .query("pushDeliveries")
          .withIndex("byNotificationAndSubscription", (q) =>
            q
              .eq("notificationId", notificationId)
              .eq("subscriptionId", subscription._id),
          )
          .first();
        return { subscription, delivery };
      }),
    );

    return {
      notification,
      unreadCount: recipientNotifications.filter(
        (row) => row.readAt === undefined,
      ).length,
      targets,
    };
  },
});

export const beginAttempt = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    subscriptionId: v.id("pushSubscriptions"),
  },
  handler: async (ctx, { notificationId, subscriptionId }) => {
    const existing = await ctx.db
      .query("pushDeliveries")
      .withIndex("byNotificationAndSubscription", (q) =>
        q
          .eq("notificationId", notificationId)
          .eq("subscriptionId", subscriptionId),
      )
      .first();
    if (
      existing &&
      (existing.status === "sent" ||
        existing.status === "failed" ||
        existing.status === "expired")
    ) {
      return null;
    }

    const now = Date.now();
    if (existing) {
      const attemptCount = existing.attemptCount + 1;
      await ctx.db.patch(existing._id, {
        status: "pending",
        attemptCount,
        updatedAt: now,
        nextAttemptAt: undefined,
      });
      return { deliveryId: existing._id, attemptCount };
    }

    const deliveryId = await ctx.db.insert("pushDeliveries", {
      notificationId,
      subscriptionId,
      status: "pending",
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { deliveryId, attemptCount: 1 };
  },
});

export const markSent = internalMutation({
  args: {
    deliveryId: v.id("pushDeliveries"),
    subscriptionId: v.id("pushSubscriptions"),
  },
  handler: async (ctx, { deliveryId, subscriptionId }) => {
    const now = Date.now();
    await ctx.db.patch(deliveryId, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
      nextAttemptAt: undefined,
      lastError: undefined,
    });
    await ctx.db.patch(subscriptionId, {
      failureCount: 0,
      lastSuccessAt: now,
      updatedAt: now,
      lastFailureAt: undefined,
    });
  },
});

export const markFailed = internalMutation({
  args: {
    deliveryId: v.id("pushDeliveries"),
    subscriptionId: v.id("pushSubscriptions"),
    status: v.union(
      v.literal("retrying"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    error: v.string(),
    nextAttemptAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const subscription = await ctx.db.get(args.subscriptionId);
    await ctx.db.patch(args.deliveryId, {
      status: args.status,
      updatedAt: now,
      nextAttemptAt: args.nextAttemptAt,
      lastError: args.error.slice(0, 500),
    });
    if (subscription) {
      await ctx.db.patch(args.subscriptionId, {
        failureCount: subscription.failureCount + 1,
        lastFailureAt: now,
        updatedAt: now,
        ...(args.status === "expired" ? { disabledAt: now } : {}),
      });
    }
  },
});
