import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    });
    return newMessageId;
  },
});
