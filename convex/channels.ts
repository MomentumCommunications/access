import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

export const getChannelByMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);

    if (!message) {
      return null;
    }

    const channelId = message.channel as Id<"channels">;

    return await ctx.db.get(channelId);
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
      .withIndex("byIsPrivateNotDM", (q) =>
        q.eq("isPrivate", false).eq("isDM", false),
      )
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
    const nonDmChannels = channels.filter((channel) => !channel?.isDM);
    return nonDmChannels;
  },
});

export const getDMsByUser = query({
  args: { user: v.optional(v.id("users")) },
  handler: async (ctx, { user }) => {
    if (!user) {
      return [];
    }

    // Step 1: Get all DM channels
    const dmChannels = await ctx.db
      .query("channels")
      .withIndex("byIsDM", (q) => q.eq("isDM", true))
      .collect();

    // Step 2: Get the user's channel memberships
    const dmMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("byUser", (q) => q.eq("user", user))
      .collect();

    const userDmChannelIds = new Set(dmMemberships.map((m) => m.channel));

    // Step 3: Filter channels the user is in
    const userDmChannels = dmChannels.filter((channel) =>
      userDmChannelIds.has(channel._id),
    );

    // Step 4: For each DM channel, fetch members excluding current user and get their names
    const result = await Promise.all(
      userDmChannels.map(async (channel) => {
        const members = await ctx.db
          .query("channelMembers")
          .withIndex("byChannel", (q) => q.eq("channel", channel._id))
          .collect();

        const otherUserIds = members
          .map((m) => m.user)
          .filter((uid) => uid !== user);

        const otherUsers = await Promise.all(
          otherUserIds.map((uid) => ctx.db.get(uid)),
        );

        const otherNames = otherUsers
          .filter(Boolean)
          .map((u) => u?.displayName || u?.name);

        return {
          ...channel,
          otherMembers: otherNames.join(", "),
        };
      }),
    );

    return result;
  },
});

export const createDm = mutation({
  args: {
    title: v.string(),
    user: v.id("users"),
    newMembers: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { user, newMembers, title }) => {
    const isPrivate = false;
    const isDM = true;
    const channelId = await ctx.db.insert("channels", {
      name: title,
      description: "",
      isPrivate,
      isDM,
    });

    if (!newMembers) {
      newMembers = [];
    }

    await ctx.db.insert("channelMembers", {
      channel: channelId,
      user,
    });

    for (const member of newMembers) {
      await ctx.db.insert("channelMembers", {
        channel: channelId,
        user: member,
      });
    }
    return channelId;
  },
});

export const getDmByMembers = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, { userIds }) => {
    const dmChannels = await ctx.db
      .query("channels")
      .withIndex("byIsDM", (q) => q.eq("isDM", true))
      .collect();

    const dmChannelsWithMembers = await Promise.all(
      dmChannels.map(async (channel) => {
        const members = await ctx.db
          .query("channelMembers")
          .withIndex("byChannel", (q) => q.eq("channel", channel._id))
          .collect();

        const memberIds = members.map((m) => m.user).sort();
        return { channel, memberIds };
      }),
    );

    const targetIds = [...userIds].sort();

    const existing = dmChannelsWithMembers.find(
      (dm) =>
        dm.memberIds.length === targetIds.length &&
        dm.memberIds.every((id, index) => id === targetIds[index]),
    );

    return existing?.channel || null;
  },
});

export const joinDm = mutation({
  args: { channel: v.id("channels"), user: v.id("users") },
  handler: async (ctx, { channel, user }) => {
    await ctx.db.insert("channelMembers", {
      channel: channel,
      user: user,
    });
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

export const editChannel = mutation({
  args: { id: v.id("channels"), name: v.string(), description: v.string() },
  handler: async (ctx, { id, name, description }) => {
    await ctx.db.patch(id, { name, description });
  },
});

export const joinChannel = mutation({
  args: { channel: v.id("channels"), user: v.id("users") },
  handler: async (ctx, { channel, user }) => {
    await ctx.db.insert("channelMembers", {
      channel: channel,
      user: user,
    });
  },
});

export const leaveChannel = mutation({
  args: { channel: v.id("channels"), user: v.id("users") },
  handler: async (ctx, { channel, user }) => {
    const channelUsers = await ctx.db
      .query("channelMembers")
      .withIndex("byChannelUser", (q) =>
        q.eq("channel", channel).eq("user", user),
      )
      .unique();
    if (!channelUsers) {
      return;
    }
    await ctx.db.delete(channelUsers._id);
  },
});

export const deleteChannel = mutation({
  args: { id: v.id("channels") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);

    const members = await ctx.db
      .query("channelMembers")
      .withIndex("byChannel", (q) => q.eq("channel", id))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }
  },
});
