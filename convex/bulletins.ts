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

export const getAllBulletins = query({
  handler: async (ctx) => {
    return await ctx.db.query("bulletin").collect();
  },
});

// TODO: make a query that can take a group argument for filtering
// dynamically pulling groups from the database
export const getMdpBulletins = query({
  handler: async (ctx) => {
    // Filter for bulletins containing group "MDP"
    const bulletins = await ctx.db.query("bulletin").collect();

    return bulletins.filter((b) => b.group?.includes("mdp"));
  },
});

export const getMdp2Bulletins = query({
  handler: async (ctx) => {
    // Filter for bulletins containing group "MDP"
    const bulletins = await ctx.db.query("bulletin").collect();

    return bulletins.filter((b) => b.group?.includes("mdp2"));
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
