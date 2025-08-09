import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getGeneralMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return messages;
  },
});

export const createGeneralMessage = mutation({
  args: { message: v.string(), author: v.id("users") },
  handler: async (ctx, args) => {
    const newMessageId = await ctx.db.insert("messages", {
      author: args.author,
      body: args.message,
      channel: "k1752qd293trjfmpsns6rjvzgn7j8fe8" as Id<"channels">,
    });
    return newMessageId;
  },
});

export const createMessage = mutation({
  args: {
    message: v.string(),
    author: v.id("users"),
    channel: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    const newMessageId = await ctx.db.insert("messages", {
      author: args.author,
      body: args.message,
      channel: args.channel,
    });
    return newMessageId;
  },
});

export const getMessagesByChannel = query({
  args: { channel: v.union(v.id("channels"), v.string()) },
  handler: async (ctx, args) => {
    // Get latest 20 messages ordered by creation time (newest first)
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(20);

    // Return in chronological order (oldest first for UI display)
    return messages.reverse();
  },
});

export const getMessagesByUserAccessability = query({
  args: { user: v.optional(v.id("users")) },
  handler: async (ctx, { user }) => {
    if (!user) {
      return [];
    }

    const channelMembers = await ctx.db
      .query("channelMembers")
      .withIndex("byUser", (q) => q.eq("user", user))
      .collect();

    const messages = await Promise.all(
      channelMembers.map(async (cm) => {
        const messagesByChannel = await ctx.db
          .query("messages")
          .withIndex("byChannel", (q) => q.eq("channel", cm.channel))
          .collect();
        return messagesByChannel;
      }),
    );

    return messages.flat();
  },
});

export const getOlderMessages = query({
  args: {
    channelId: v.id("channels"),
    beforeTime: v.optional(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channelId))
      .order("desc");

    // Filter by creation time instead of _id for reliable chronological ordering
    if (args.beforeTime) {
      q = q.filter((q) => q.lt(q.field("_creationTime"), args.beforeTime));
    }

    const messages = await q.take(args.limit);
    return messages.reverse();
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    author: v.id("users"),
    channel: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      body: args.storageId,
      author: args.author,
      format: "image",
      channel: args.channel,
    });
  },
});

export const editMessage = mutation({
  args: { id: v.id("messages"), body: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { body: args.body, edited: true });
  },
});

export const deleteMessage = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// New queries for message linking functionality
export const getMessageById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const getMessageContext = query({
  args: {
    messageId: v.id("messages"),
    contextSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const contextSize = args.contextSize || 10;

    // First get the target message to find its channel and creation time
    const targetMessage = await ctx.db.get(args.messageId);
    if (!targetMessage) {
      return { messages: [], targetMessageIndex: -1 };
    }

    // Get messages before the target
    const messagesBefore = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) =>
        q.lt(q.field("_creationTime"), targetMessage._creationTime),
      )
      .order("desc")
      .take(contextSize);

    // Get messages after the target
    const messagesAfter = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) =>
        q.gt(q.field("_creationTime"), targetMessage._creationTime),
      )
      .order("asc")
      .take(contextSize);

    // Combine all messages in chronological order
    const allMessages = [
      ...messagesBefore.reverse(), // Reverse to get chronological order
      targetMessage,
      ...messagesAfter,
    ];

    return {
      messages: allMessages,
      targetMessageIndex: messagesBefore.length, // Index of target message in array
    };
  },
});

export const getMessagesBeforeMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message first
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) {
      return [];
    }

    // Get messages before the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) =>
        q.lt(q.field("_creationTime"), referenceMessage._creationTime),
      )
      .order("desc")
      .take(args.limit);

    return messages.reverse(); // Return in chronological order
  },
});

export const getMessagesAfterMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message first
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) {
      return [];
    }

    // Get messages after the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) =>
        q.gt(q.field("_creationTime"), referenceMessage._creationTime),
      )
      .order("asc")
      .take(args.limit);

    return messages; // Already in chronological order
  },
});

