import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new task with the given text
export const createBulletin = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const newBulletinId = await ctx.db.insert("bulletin", {
      title: args.title,
      body: args.body,
      pinned: false,
    });
    return newBulletinId;
  },
});

export const getBulletins = query({
  handler: async (ctx) => {
    return await ctx.db.query("bulletin").collect();
  },
});

export const deleteBulletin = mutation({
  args: { id: v.id("bulletin") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const editBulletin = mutation({
  args: { id: v.id("bulletin"), title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      title: args.title,
      body: args.body,
    });
  },
});
