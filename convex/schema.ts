import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  tasks: defineTable({
    isCompleted: v.boolean(),
    text: v.string(),
  }),
  users: defineTable({
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.array(v.string()))),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(
      v.union(v.literal("admin"), v.literal("staff"), v.literal("member")),
    ),
    group: v.optional(v.array(v.id("groups"))),
    image: v.optional(v.string()),
    description: v.optional(v.string()),
    // Legacy Clerk ID. Convex Auth stores its user ID in the subject JWT field.
    externalId: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("byExternalId", ["externalId"]),
  groups: defineTable({
    name: v.string(),
    description: v.string(),
    password: v.string(),
    info: v.optional(v.string()),
    color: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
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
    endDate: v.optional(v.string()),
    author: v.optional(v.string()),
    group: v.optional(v.array(v.string())),
    groups: v.optional(v.array(v.id("groups"))),
    reactions: v.optional(v.id("reactions")),
    hidden: v.optional(v.boolean()),
  })
    .index("byGroup", ["group"])
    .index("byGroups", ["groups"]),
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
  documents: defineTable({
    name: v.string(),
    document: v.id("_storage"),
  }),
  docuBulletins: defineTable({
    document: v.id("_storage"),
    bulletin: v.id("bulletin"),
  }),
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
  students: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    photo: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived"),
    ),
  }).index("byStatus", ["status"]),
  studentContacts: defineTable({
    student: v.id("students"),
    user: v.optional(v.id("users")),
    inviteEmail: v.optional(v.string()),
    name: v.optional(v.string()),
    relationship: v.optional(v.string()),
    canManage: v.boolean(),
    isPrimary: v.boolean(),
  })
    .index("byStudent", ["student"])
    .index("byUser", ["user"])
    .index("byInviteEmail", ["inviteEmail"]),
  classes: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    capacity: v.optional(v.number()),
    location: v.optional(v.string()),
    scheduleSummary: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    weekdays: v.optional(
      v.array(
        v.union(
          v.literal("sunday"),
          v.literal("monday"),
          v.literal("tuesday"),
          v.literal("wednesday"),
          v.literal("thursday"),
          v.literal("friday"),
          v.literal("saturday"),
        ),
      ),
    ),
    timezone: v.optional(v.string()),
    scheduleVersion: v.optional(v.number()),
    assignedStaff: v.optional(v.array(v.id("users"))),
  }).index("byStatus", ["status"]),
  sessions: defineTable({
    classId: v.id("classes"),
    date: v.string(),
    active: v.boolean(),
    source: v.union(v.literal("generated"), v.literal("manual")),
    scheduleVersion: v.optional(v.number()),
    hasManualOverride: v.optional(v.boolean()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.id("users"))),
    substitute: v.optional(v.id("users")),
    status: v.union(
      v.literal("scheduled"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
  })
    .index("byClass", ["classId"])
    .index("byDate", ["date"]),
  sessionStudents: defineTable({
    session: v.id("sessions"),
    student: v.id("students"),
    addedBy: v.id("users"),
    addedAt: v.number(),
  })
    .index("bySession", ["session"])
    .index("byStudent", ["student"])
    .index("bySessionStudent", ["session", "student"]),
  classEnrollments: defineTable({
    classId: v.id("classes"),
    student: v.id("students"),
    requestedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("enrolled"),
      v.literal("waitlisted"),
      v.literal("dropped"),
    ),
    notes: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  })
    .index("byClass", ["classId"])
    .index("byStudent", ["student"])
    .index("byClassStudent", ["classId", "student"]),
  attendanceRecords: defineTable({
    session: v.id("sessions"),
    student: v.id("students"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("late"),
      v.literal("excused"),
    ),
    notes: v.optional(v.string()),
    markedBy: v.id("users"),
    markedAt: v.number(),
  })
    .index("bySession", ["session"])
    .index("byStudent", ["student"])
    .index("bySessionStudent", ["session", "student"]),
  holidays: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  })
    .index("byStartDate", ["startDate"])
    .index("byEndDate", ["endDate"]),
});
