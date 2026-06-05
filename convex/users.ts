import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getOtherUsers = query({
  args: { id: v.optional(v.id("users")) },
  handler: async (ctx, { id }) => {
    const users = await ctx.db.query("users").collect();

    return users.filter((user) => user._id !== id);
  },
});

export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { displayName, description, imageStorageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName.length === 0 || trimmedDisplayName.length > 80) {
      throw new Error("Display name must be between 1 and 80 characters");
    }

    if (description && description.length > 1000) {
      throw new Error("Description must be 1000 characters or fewer");
    }

    const image = imageStorageId
      ? await ctx.storage.getUrl(imageStorageId)
      : undefined;

    await ctx.db.patch(userId, {
      displayName: trimmedDisplayName,
      description,
      ...(image ? { image } : {}),
    });
  },
});

export const getUsersByChannel = query({
  args: { channel: v.optional(v.id("channels")) },
  handler: async (ctx, { channel }) => {
    if (channel === undefined) {
      return [];
    }
    const userIds = await ctx.db
      .query("channelMembers")
      .withIndex("byChannel", (q) => q.eq("channel", channel))
      .collect();

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId.user);
        return user;
      }),
    );

    return users;
  },
});

export const getUsersNotInChannel = query({
  args: { channel: v.optional(v.id("channels")) },
  handler: async (ctx, { channel }) => {
    if (channel === undefined) {
      return [];
    }

    const userIds = await ctx.db
      .query("channelMembers")
      .withIndex("byChannel", (q) => q.eq("channel", channel))
      .collect();

    const users = await ctx.db.query("users").collect();

    return users.filter((user) => {
      return !userIds.some((userId) => userId.user === user._id);
    });
  },
});

export const joinChannel = mutation({
  args: { channel: v.id("channels"), user: v.id("users") },
  handler: async (ctx, { channel, user }) => {
    await ctx.db.insert("channelMembers", { channel, user });
  },
});

export const removeFromChannel = mutation({
  args: { channel: v.id("channels"), user: v.id("users") },
  handler: async (ctx, { channel, user }) => {
    const channelMember = await ctx.db
      .query("channelMembers")
      .withIndex("byChannelUser", (q) =>
        q.eq("channel", channel).eq("user", user),
      )
      .unique();

    if (channelMember) {
      await ctx.db.delete(channelMember._id);
    }
  },
});

export const getOtherUsersByChannel = query({
  args: {
    channel: v.optional(v.id("channels")),
    id: v.optional(v.id("users")),
  },
  handler: async (ctx, { channel, id }) => {
    if (channel === undefined || id === undefined) {
      return [];
    }
    const userIds = await ctx.db
      .query("channelMembers")
      .withIndex("byChannel", (q) => q.eq("channel", channel))
      .collect();

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId.user);
        return user;
      }),
    );

    return users.filter((user) => user?._id !== id);
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
}
