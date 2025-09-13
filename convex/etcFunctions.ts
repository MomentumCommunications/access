import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    return groups;
  },
});

export const getGroupsArray = query({
  args: { ids: v.array(v.id("groups")) },
  handler: async (ctx, { ids }) => {
    const groups = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return groups;
  },
});

export const assignGroups = mutation({
  args: {
    user: v.id("users"),
    groups: v.array(v.id("groups")),
  },
  handler: async (ctx, { user, groups }) => {
    await ctx.db.patch(user, { group: groups });
  },
});

export const setRole = mutation({
  args: {
    user: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("staff"), v.literal("member")),
  },
  handler: async (ctx, { user, role }) => {
    await ctx.db.patch(user, { role });
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
