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
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(20);
    return messages.reverse();
  },
});

export const getOlderMessages = query({
  args: {
    channelId: v.id("channels"),
    beforeId: v.optional(v.id("messages")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channelId))
      .order("desc");

    if (args.beforeId) {
      q = q.lt(q.field("_id"), args.beforeId);
    }

    const messages = await q.take(args.limit);
    return messages.reverse(); // return oldest first
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
