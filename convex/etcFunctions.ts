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

export const addGroup = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    password: v.string(),
    info: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
    color: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { name, description, password, info, document, color },
  ) => {
    await ctx.db.insert("groups", {
      name,
      description,
      password,
      info,
      document,
      color,
    });
  },
});

export const editGroup = mutation({
  args: {
    name: v.string(),
    group: v.id("groups"),
    info: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { group, name, info, document, color }) => {
    await ctx.db.patch(group, { name, info, document, color });
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

export const getUrlForDocument = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});

export const getGroupDocuments = query({
  args: { groupIds: v.optional(v.array(v.id("groups"))) },
  handler: async (ctx, { groupIds }) => {
    if (!groupIds) {
      return [];
    }
    const groups = await Promise.all(groupIds.map((id) => ctx.db.get(id)));
    const groupsWithDocuments = groups.filter((group) => group?.document);

    const documentsWithUrls = await Promise.all(
      groupsWithDocuments.map(async (group) => {
        if (!group?.document) return null;
        const url = await ctx.storage.getUrl(group.document);
        return {
          groupId: group._id,
          groupName: group.name,
          documentUrl: url,
        };
      }),
    );

    return documentsWithUrls.filter((doc) => doc !== null);
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
