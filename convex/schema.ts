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
  })
    .index("byChannel", ["channel"]),
  channels: defineTable({
    name: v.optional(v.string()),
    description: v.string(),
    group: v.optional(v.id("groups")),
    isDM: v.boolean(),
    isPrivate: v.optional(v.boolean()),
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
    thumbsUp: v.optional(v.id("users")),
    thumbsDown: v.optional(v.id("users")),
    heart: v.optional(v.id("users")),
    laugh: v.optional(v.id("users")),
    confused: v.optional(v.id("users")),
    fire: v.optional(v.id("users")),
    toBulletin: v.optional(v.id("bulletin")),
    toTask: v.optional(v.id("tasks")),
    toMessage: v.optional(v.id("messages")),
  }),
});
