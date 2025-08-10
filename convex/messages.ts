import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getGeneralMessages = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return messages;
  },
});

export const createGeneralMessage = mutation({
  args: { message: v.string(), author: v.id("users") },
  handler: async (ctx, args) => {
    const newMessageId = await ctx.db.insert("messages", {
      author: args.author,
      body: args.message,
      channel: "k1752qd293trjfmpsns6rjvzgn7j8fe8" as Id<"channels">,
    });
    return newMessageId;
  },
});

export const createMessage = mutation({
  args: {
    message: v.string(),
    author: v.id("users"),
    channel: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    const newMessageId = await ctx.db.insert("messages", {
      author: args.author,
      body: args.message,
      channel: args.channel,
    });
    return newMessageId;
  },
});

export const getMessagesByChannel = query({
  args: { channel: v.union(v.id("channels"), v.string()) },
  handler: async (ctx, args) => {
    // Get latest 20 messages ordered by creation time (newest first)
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(20);

    // Return in chronological order (oldest first for UI display)
    return messages.reverse();
  },
});

export const getMessagesByUserAccessability = query({
  args: { user: v.optional(v.id("users")) },
  handler: async (ctx, { user }) => {
    if (!user) {
      return [];
    }

    const channelMembers = await ctx.db
      .query("channelMembers")
      .withIndex("byUser", (q) => q.eq("user", user))
      .collect();

    const messages = await Promise.all(
      channelMembers.map(async (cm) => {
        const messagesByChannel = await ctx.db
          .query("messages")
          .withIndex("byChannel", (q) => q.eq("channel", cm.channel))
          .collect();
        return messagesByChannel;
      }),
    );

    return messages.flat();
  },
});

export const getOlderMessages = query({
  args: {
    channelId: v.id("channels"),
    beforeTime: v.optional(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channelId))
      .order("desc");

    // Filter by creation time instead of _id for reliable chronological ordering
    if (args.beforeTime) {
      q = q.filter((q) => q.lt(q.field("_creationTime"), args.beforeTime));
    }

    const messages = await q.take(args.limit);
    return messages.reverse();
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    author: v.id("users"),
    channel: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      body: args.storageId,
      author: args.author,
      format: "image",
      channel: args.channel,
    });
  },
});

export const editMessage = mutation({
  args: { id: v.id("messages"), body: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { body: args.body, edited: true });
  },
});

export const deleteMessage = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    // First delete all associated messageReads
    const messageReads = await ctx.db
      .query("messageReads")
      .withIndex("byMessage", (q) => q.eq("messageId", args.id))
      .collect();

    // Delete all messageReads for this message
    for (const messageRead of messageReads) {
      await ctx.db.delete(messageRead._id);
    }

    // Then delete the message itself
    await ctx.db.delete(args.id);
  },
});

// New queries for message linking functionality
export const getMessageById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const getMessageContext = query({
  args: {
    messageId: v.id("messages"),
    contextSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const contextSize = args.contextSize || 10;

    // First get the target message to find its channel and creation time
    const targetMessage = await ctx.db.get(args.messageId);
    if (!targetMessage) {
      return { messages: [], targetMessageIndex: -1 };
    }

    // Get messages before the target
    const messagesBefore = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) =>
        q.lt(q.field("_creationTime"), targetMessage._creationTime),
      )
      .order("desc")
      .take(contextSize);

    // Get messages after the target
    const messagesAfter = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", targetMessage.channel))
      .filter((q) =>
        q.gt(q.field("_creationTime"), targetMessage._creationTime),
      )
      .order("asc")
      .take(contextSize);

    // Combine all messages in chronological order
    const allMessages = [
      ...messagesBefore.reverse(), // Reverse to get chronological order
      targetMessage,
      ...messagesAfter,
    ];

    return {
      messages: allMessages,
      targetMessageIndex: messagesBefore.length, // Index of target message in array
    };
  },
});

export const getMessagesBeforeMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message first
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) {
      return [];
    }

    // Get messages before the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) =>
        q.lt(q.field("_creationTime"), referenceMessage._creationTime),
      )
      .order("desc")
      .take(args.limit);

    return messages.reverse(); // Return in chronological order
  },
});

export const getMessagesAfterMessage = query({
  args: {
    messageId: v.id("messages"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the reference message first
    const referenceMessage = await ctx.db.get(args.messageId);
    if (!referenceMessage) {
      return [];
    }

    // Get messages after the reference message
    const messages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", referenceMessage.channel))
      .filter((q) =>
        q.gt(q.field("_creationTime"), referenceMessage._creationTime),
      )
      .order("asc")
      .take(args.limit);

    return messages; // Already in chronological order
  },
});

// Message read tracking mutations and queries
export const markMessageAsRead = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    channelId: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    // Check if this user has already read this message
    const existingRead = await ctx.db
      .query("messageReads")
      .withIndex("byMessageUser", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .first();

    // Only create a new read record if one doesn't exist
    if (!existingRead) {
      await ctx.db.insert("messageReads", {
        messageId: args.messageId,
        userId: args.userId,
        channelId: args.channelId,
        readAt: Date.now(),
      });
    }
  },
});

export const markMultipleMessagesAsRead = mutation({
  args: {
    messageIds: v.array(v.id("messages")),
    userId: v.id("users"),
    channelId: v.union(v.id("channels"), v.string()),
  },
  handler: async (ctx, args) => {
    const readAt = Date.now();

    for (const messageId of args.messageIds) {
      // Check if this user has already read this message
      const existingRead = await ctx.db
        .query("messageReads")
        .withIndex("byMessageUser", (q) =>
          q.eq("messageId", messageId).eq("userId", args.userId),
        )
        .first();

      // Only create a new read record if one doesn't exist
      if (!existingRead) {
        await ctx.db.insert("messageReads", {
          messageId,
          userId: args.userId,
          channelId: args.channelId,
          readAt,
        });
      }
    }
  },
});

export const getMessageReads = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const messageReads = await ctx.db
      .query("messageReads")
      .withIndex("byMessage", (q) => q.eq("messageId", args.messageId))
      .collect();

    return messageReads;
  },
});

export const getUserReadStatus = query({
  args: {
    messageIds: v.array(v.id("messages")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const readStatuses: Record<string, boolean> = {};

    for (const messageId of args.messageIds) {
      const existingRead = await ctx.db
        .query("messageReads")
        .withIndex("byMessageUser", (q) =>
          q.eq("messageId", messageId).eq("userId", args.userId),
        )
        .first();

      readStatuses[messageId] = !!existingRead;
    }

    return readStatuses;
  },
});

export const getUnreadMessageCount = query({
  args: {
    channelId: v.union(v.id("channels"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all messages in the channel
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("byChannel", (q) => q.eq("channel", args.channelId))
      .collect();

    // Get all reads for this user in this channel
    const userReads = await ctx.db
      .query("messageReads")
      .withIndex("byChannelUser", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId),
      )
      .collect();

    const readMessageIds = new Set(userReads.map((read) => read.messageId));
    const unreadCount = allMessages.filter(
      (msg) => !readMessageIds.has(msg._id),
    ).length;

    return unreadCount;
  },
});

export const getUnreadMessages = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get all channels the user has access to
    const publicChannels = await ctx.db.query("channels")
      .withIndex("byIsPrivateNotDM", (q) => q.eq("isPrivate", false).eq("isDM", false))
      .collect();
    
    const channelMembers = await ctx.db
      .query("channelMembers")
      .withIndex("byUser", (q) => q.eq("user", args.userId))
      .collect();
    
    const accessibleChannelIds = [
      ...publicChannels.map(c => c._id),
      ...channelMembers.map(cm => cm.channel)
    ];

    // Get all reads for this user across all channels
    const userReads = await ctx.db
      .query("messageReads")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .collect();
    
    const readMessageIds = new Set(userReads.map((read) => read.messageId));
    
    // Get unread messages from accessible channels
    const unreadMessages = [];
    
    for (const channelId of accessibleChannelIds) {
      const channelMessages = await ctx.db
        .query("messages")
        .withIndex("byChannel", (q) => q.eq("channel", channelId))
        .filter((q) => q.neq(q.field("author"), args.userId)) // Exclude user's own messages
        .order("desc")
        .take(20); // Limit per channel to avoid too many queries
      
      // Filter out read messages
      const channelUnread = channelMessages.filter(
        (msg) => !readMessageIds.has(msg._id)
      );
      
      unreadMessages.push(...channelUnread);
    }
    
    // Sort by creation time (newest first) and limit total results
    const sortedUnread = unreadMessages
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);
    
    // Enrich with channel information
    const enrichedMessages = await Promise.all(
      sortedUnread.map(async (message) => {
        // Get channel info
        const channel = await ctx.db.get(message.channel as Id<"channels">);
        let channelInfo = null;
        
        if (channel) {
          if (channel.isDM) {
            // This is a DM - get other member names
            const members = await ctx.db
              .query("channelMembers")
              .withIndex("byChannel", (q) => q.eq("channel", channel._id))
              .collect();
            
            const otherUserIds = members
              .map((m) => m.user)
              .filter((uid) => uid !== args.userId);
            
            const otherUsers = await Promise.all(
              otherUserIds.map((uid) => ctx.db.get(uid)),
            );
            
            const otherNames = otherUsers
              .filter(Boolean)
              .map((u) => u?.displayName || u?.name);
            
            channelInfo = {
              name: otherNames.join(", ") || "Direct Message",
              isDM: true,
              dmId: channel._id
            };
          } else {
            // Regular channel
            channelInfo = {
              name: channel.name || "Unknown Channel",
              isDM: false,
              channelId: channel._id
            };
          }
        }
        
        // Get author info
        const author = await ctx.db.get(message.author);
        
        return {
          ...message,
          channelInfo,
          authorName: author?.name || author?.email || "Unknown",
        };
      })
    );
    
    return enrichedMessages;
  },
});
