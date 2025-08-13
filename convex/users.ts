import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";

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

export const getUserByClerkId = query({
  args: { ClerkId: v.optional(v.string()) },
  handler: async (ctx, { ClerkId }) => {
    if (ClerkId === undefined) {
      return null;
    }
    return await userByExternalId(ctx, ClerkId);
  },
});

export const addUserDescription = mutation({
  args: {
    description: v.optional(v.string()),
    user: v.optional(v.id("users")),
  },
  handler: async (ctx, { description, user }) => {
    if (user === undefined) {
      return;
    }
    await ctx.db.patch(user, { description });
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

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const displayName =
      data.username ??
      data.first_name ??
      data.email_addresses?.[0]?.email_address ??
      "anonymous";

    const userAttributes = {
      name: `${data.first_name} ${data.last_name}`,
      externalId: data.id,
      // email: data.email_addresses as EmailAddressJSON[],
      image: data.image_url,
      displayName: displayName,
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    }
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
