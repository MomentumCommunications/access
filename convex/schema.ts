import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    isCompleted: v.boolean(),
    text: v.string(),
  }),
  users: defineTable({
    name: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.array(v.string())),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    group: v.optional(v.id("groups")),
    image: v.optional(v.string()),
    description: v.optional(v.string()),
    // this the Clerk ID, stored in the subject JWT field
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),
  groups: defineTable({
    name: v.string(),
    description: v.string(),
    password: v.string(),
    info: v.optional(v.string()),
  }).index("byPassword", ["password"]),
  groupMembers: defineTable({
    group: v.id("groups"),
    user: v.id("users"),
  }).index("byGroup", ["group"]),
  bulletin: defineTable({
    title: v.string(),
    body: v.string(),
    pinned: v.boolean(),
    image: v.optional(v.string()),
    date: v.optional(v.string()),
    author: v.optional(v.string()),
    group: v.optional(v.array(v.string())),
    reactions: v.optional(v.id("reactions")),
    hidden: v.optional(v.boolean()),
  }).index("byGroup", ["group"]),
  messages: defineTable({
    body: v.string(),
    date: v.optional(v.string()),
    author: v.id("users"),
    image: v.optional(v.string()),
    format: v.optional(v.string()),
    channel: v.union(v.id("channels"), v.string()),
    reactions: v.optional(v.id("reactions")),
    edited: v.optional(v.boolean()),
    replyToId: v.optional(v.id("messages")),
  })
    .index("byChannel", ["channel"])
    .index("byReplyTo", ["replyToId"]),
  channels: defineTable({
    name: v.optional(v.string()),
    description: v.string(),
    group: v.optional(v.id("groups")),
    isDM: v.boolean(),
    isPrivate: v.optional(v.boolean()),
    adminControlled: v.optional(v.boolean()),
    messages: v.optional(v.id("messages")),
    users: v.optional(v.id("groupMembers")),
  })
    .index("byName", ["name"])
    .index("byIsPrivate", ["isPrivate"])
    .index("byIsPrivateNotDM", ["isPrivate", "isDM"])
    .index("byIsDM", ["isDM"]),
  channelMembers: defineTable({
    channel: v.id("channels"),
    user: v.id("users"),
  })
    .index("byChannel", ["channel"])
    .index("byUser", ["user"])
    .index("byChannelUser", ["channel", "user"]),
  reactions: defineTable({
    userId: v.id("users"),
    reaction: v.string(),
    toBulletin: v.optional(v.id("bulletin")),
    toMessage: v.optional(v.id("messages")),
  })
    .index("byMessage", ["toMessage"])
    .index("byMessageUser", ["toMessage", "userId"]),
  messageReads: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    channelId: v.union(v.id("channels"), v.string()),
    readAt: v.number(), // timestamp when message was read
  })
    .index("byMessage", ["messageId"])
    .index("byUser", ["userId"])
    .index("byChannel", ["channelId"])
    .index("byMessageUser", ["messageId", "userId"])
    .index("byChannelUser", ["channelId", "userId"]),
});
