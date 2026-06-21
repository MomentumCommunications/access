import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const NOTIFICATION_LIMIT = 50;

export const listCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("byRecipientAndCreatedAt", (q) =>
        q.eq("recipientUserId", userId),
      )
      .order("desc")
      .take(NOTIFICATION_LIMIT);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("byRecipient", (q) => q.eq("recipientUserId", userId))
      .collect();
    return notifications.filter(
      (notification) => notification.readAt === undefined,
    ).length;
  },
});

export const getCurrentById = query({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.recipientUserId !== userId) return null;
    return notification;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.recipientUserId !== userId) {
      throw new Error("Notification not found");
    }
    if (notification.readAt === undefined) {
      await ctx.db.patch(notificationId, { readAt: Date.now() });
    }
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("byRecipient", (q) => q.eq("recipientUserId", userId))
      .collect();
    return notifications.filter(
      (row) => row._id !== notificationId && row.readAt === undefined,
    ).length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("byRecipient", (q) => q.eq("recipientUserId", userId))
      .collect();
    const unread = notifications.filter(
      (notification) => notification.readAt === undefined,
    );
    const readAt = Date.now();
    await Promise.all(
      unread.map((notification) =>
        ctx.db.patch(notification._id, { readAt }),
      ),
    );
    return unread.length;
  },
});
