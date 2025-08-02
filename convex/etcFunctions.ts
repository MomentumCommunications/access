import { v } from "convex/values";
import { query } from "./_generated/server";

export const getGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    return groups;
  },
});

export const getChannelIdByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const channel = await ctx.db
      .query("channels")
      .withIndex("byName", (q) => q.eq("name", name))
      .unique();
    return channel?._id;
  },
});

export const getUrlForImage = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});

export const getGroupByPassword = query({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("byPassword", (q) => q.eq("password", password))
      .unique();
    return group;
  },
});
