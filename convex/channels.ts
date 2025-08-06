import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getChannel = query({
  args: { id: v.id("channels") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getChannelByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("channels")
      .withIndex("byName", (q) => q.eq("name", name))
      .unique();
  },
});

export const getChannels = query({
  handler: async (ctx) => {
    return await ctx.db.query("channels").collect();
  },
});

export const getPublicChannels = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("channels")
      .withIndex("byIsPrivate", (q) => q.eq("isPrivate", false))
      .collect();
  },
});

export const getChannelsByUser = query({
  args: { user: v.optional(v.id("users")) },
  handler: async (ctx, { user }) => {
    if (!user) {
      return [];
    }

    const channelIds = await ctx.db
      .query("channelMembers")
      .withIndex("byUser", (q) => q.eq("user", user))
      .collect();

    const channels = await Promise.all(
      channelIds.map(async (channelId) => {
        return await ctx.db.get(channelId.channel);
      }),
    );
    return channels;
  },
});

export const createChannel = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    isPrivate: v.boolean(),
    user: v.id("users"),
  },
  handler: async (ctx, { name, description, isPrivate, user }) => {
    const isDM = false;
    const channelId = await ctx.db.insert("channels", {
      name,
      description,
      isPrivate,
      isDM,
    });

    if (isPrivate) {
      await ctx.db.insert("channelMembers", {
        channel: channelId,
        user: user,
      });
    }

    return channelId;
  },
});
