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
    // Return in chronological order (oldest first for UI display)
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
export const getMessageContext = query({
  args: { 
    messageId: v.id("messages"), 
    contextSize: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const contextSize = args.contextSize || 10;

    // Get the target message first
    const targetMessage = await ctx.db.get(args.messageId);
    if (!targetMessage) return null;

    // Get messages before the target message
    const messagesBefore = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) => q.lt(q.field("_creationTime"), targetMessage._creationTime))
      .order("desc")
      .take(contextSize);

    // Get messages after the target message
    const messagesAfter = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) => q.gt(q.field("_creationTime"), targetMessage._creationTime))
      .order("asc")
      .take(contextSize);

    // Combine and sort all messages chronologically
    const allMessages = [
      ...messagesBefore.reverse(), // Reverse because we got them in desc order
      targetMessage,
      ...messagesAfter
    ];

    return {
      messages: allMessages,
      targetMessageId: targetMessage._id,
      targetMessageIndex: messagesBefore.length, // Index of target in the array
      channelId: targetMessage.channel
    };
  },
});

export const getMessagesBeforeMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message to get its timestamp and channel
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) return [];

    // Get messages before the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) => q.lt(q.field("_creationTime"), referenceMessage._creationTime))
      .order("desc")
      .take(args.limit);

    // Return in chronological order (oldest first for UI display)
    return messages.reverse();
  },
});

export const getMessagesAfterMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message to get its timestamp and channel
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) return [];

    // Get messages after the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) => q.gt(q.field("_creationTime"), referenceMessage._creationTime))
      .order("asc")
      .take(args.limit);

    // Already in chronological order
    return messages;
  },
});

export const getMessageById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});
