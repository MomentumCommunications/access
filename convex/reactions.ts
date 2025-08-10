import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Mapping from reaction names to emojis
const REACTION_EMOJIS: Record<string, string> = {
  thumbs_up: "👍",
  thumbs_down: "👎",
  heart: "❤️",
  laugh: "😂",
  sad: "😢",
  surprised: "😮",
  angry: "😡",
  fire: "🔥",
  hundred: "💯",
  party: "🎉",
  thinking: "🤔",
  clap: "👏",
};

export const addReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    reaction: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already has a reaction on this message
    const existingReaction = await ctx.db
      .query("reactions")
      .withIndex("byMessageUser", (q) =>
        q.eq("toMessage", args.messageId).eq("userId", args.userId)
      )
      .first();

    if (existingReaction) {
      // Update existing reaction
      await ctx.db.patch(existingReaction._id, {
        reaction: args.reaction,
      });
      return existingReaction._id;
    } else {
      // Create new reaction
      return await ctx.db.insert("reactions", {
        userId: args.userId,
        reaction: args.reaction,
        toMessage: args.messageId,
      });
    }
  },
});

export const removeReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const reaction = await ctx.db
      .query("reactions")
      .withIndex("byMessageUser", (q) =>
        q.eq("toMessage", args.messageId).eq("userId", args.userId)
      )
      .first();

    if (reaction) {
      await ctx.db.delete(reaction._id);
    }
  },
});

export const getMessageReactions = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("byMessage", (q) => q.eq("toMessage", args.messageId))
      .collect();

    // Group reactions by type and include user info
    const reactionGroups: Array<{
      reactionName: string;
      emoji: string;
      count: number;
      users: Array<{ _id: Id<"users">; name: string; email?: string }>;
    }> = [];

    // Group by reaction type
    const grouped: Record<string, Array<{ _id: Id<"users">; name: string; email?: string }>> = {};

    for (const reaction of reactions) {
      const user = await ctx.db.get(reaction.userId);
      if (user) {
        if (!grouped[reaction.reaction]) {
          grouped[reaction.reaction] = [];
        }
        grouped[reaction.reaction].push({
          _id: user._id,
          name: user.displayName || user.name,
          email: user.email?.[0],
        });
      }
    }

    // Convert to array format with emojis
    for (const [reactionName, users] of Object.entries(grouped)) {
      const emoji = REACTION_EMOJIS[reactionName];
      if (emoji) {
        reactionGroups.push({
          reactionName,
          emoji,
          count: users.length,
          users,
        });
      }
    }

    return reactionGroups;
  },
});

export const getUserReactionForMessage = query({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const reaction = await ctx.db
      .query("reactions")
      .withIndex("byMessageUser", (q) =>
        q.eq("toMessage", args.messageId).eq("userId", args.userId)
      )
      .first();

    return reaction?.reaction || null;
  },
});