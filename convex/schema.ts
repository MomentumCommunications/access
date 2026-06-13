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
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.array(v.string()))),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(
      v.union(v.literal("admin"), v.literal("staff"), v.literal("member")),
    ),
    roles: v.optional(
      v.array(
        v.union(v.literal("admin"), v.literal("staff"), v.literal("member")),
      ),
    ),
    group: v.optional(v.array(v.id("groups"))),
    image: v.optional(v.string()),
    description: v.optional(v.string()),
    onboardingStatus: v.optional(
      v.union(v.literal("pending"), v.literal("complete")),
    ),
    onboardingSource: v.optional(
      v.union(v.literal("new"), v.literal("imported")),
    ),
    onboardingCompletedAt: v.optional(v.number()),
    contractTypeSigned: v.optional(v.string()),
    contractVersionSigned: v.optional(v.string()),
    contractSignedAt: v.optional(v.number()),
    docusealSubmissionId: v.optional(v.string()),
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
    hidden: v.optional(v.boolean()),
  })
    .index("byGroup", ["group"])
    .index("byGroups", ["groups"]),
  documents: defineTable({
    name: v.string(),
    document: v.id("_storage"),
  }),
  docuBulletins: defineTable({
    document: v.id("_storage"),
    bulletin: v.id("bulletin"),
  }),
  students: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal(""), v.literal("Female"), v.literal("Male")),
    ),
    groupId: v.optional(v.id("groups")),
    school: v.optional(v.string()),
    allergies: v.optional(v.string()),
    recital: v.optional(v.boolean()),
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
  households: defineTable({
    name: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("byName", ["name"]),
  householdMembers: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
  })
    .index("byHousehold", ["householdId"])
    .index("byUser", ["userId"])
    .index("byHouseholdUser", ["householdId", "userId"]),
  onboarding: defineTable({
    user: v.id("users"),
    currentStep: v.union(
      v.literal("profile"),
      v.literal("students"),
      v.literal("review"),
      v.literal("contract"),
      v.literal("complete"),
    ),
    matchedImportedRecord: v.boolean(),
    createdStudentIds: v.array(v.id("students")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("byUser", ["user"]),
  seasons: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  }),
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
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
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
  seasonClasses: defineTable({
    season: v.id("seasons"),
    class: v.id("classes"),
  })
    .index("bySeason", ["season"])
    .index("byClass", ["class"])
    .index("bySeasonClass", ["season", "class"]),
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
    prorateTuition: v.optional(v.boolean()),
  })
    .index("byClass", ["classId"])
    .index("byStudent", ["student"])
    .index("byClassStudent", ["classId", "student"]),
  pricingSchemas: defineTable({
    name: v.string(),
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
    ),
    sourceSchemaId: v.optional(v.id("pricingSchemas")),
    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
  })
    .index("byStatus", ["status"])
    .index("byNameVersion", ["name", "version"]),
  tuitionPricingTiers: defineTable({
    pricingSchemaId: v.id("pricingSchemas"),
    label: v.string(),
    maxWeeklyMinutes: v.optional(v.number()),
    monthlyAmountCents: v.number(),
    sortOrder: v.number(),
  })
    .index("byPricingSchema", ["pricingSchemaId"])
    .index("byPricingSchemaOrder", ["pricingSchemaId", "sortOrder"]),
  attendanceRecords: defineTable({
    session: v.id("sessions"),
    student: v.id("students"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("late"),
      v.literal("excused"),
    ),
    reason: v.optional(
      v.union(
        v.literal("sick"),
        v.literal("injured"),
        v.literal("homework"),
        v.literal("vacation"),
        v.literal("school-event"),
        v.literal("no-ride"),
      ),
    ),
    notes: v.optional(v.string()),
    markedBy: v.id("users"),
    markedAt: v.number(),
  })
    .index("bySession", ["session"])
    .index("byStudent", ["student"])
    .index("bySessionStudent", ["session", "student"]),
  privates: defineTable({
    name: v.string(),
    instructorId: v.id("users"),
    studentIds: v.optional(v.array(v.id("students"))),
    defaultDurationMinutes: v.number(),
    schedulePrompt: v.object({
      startDate: v.string(),
      endDate: v.string(),
      startTime: v.string(),
      weekdays: v.array(
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
      timezone: v.string(),
    }),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("byInstructor", ["instructorId"])
    .index("byActive", ["isActive"]),
  privateLessons: defineTable({
    privateId: v.id("privates"),
    startsAt: v.number(),
    durationMinutes: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    generatedFromSchedule: v.boolean(),
    participantsManuallyEdited: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  })
    .index("byPrivate", ["privateId"])
    .index("byStartsAt", ["startsAt"])
    .index("byPrivateStartsAt", ["privateId", "startsAt"]),
  privateLessonStudents: defineTable({
    privateLessonId: v.id("privateLessons"),
    studentId: v.id("students"),
    status: v.union(
      v.literal("scheduled"),
      v.literal("attended"),
      v.literal("excused"),
      v.literal("no_show"),
      v.literal("cancelled"),
    ),
    billable: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("byPrivateLesson", ["privateLessonId"])
    .index("byStudent", ["studentId"])
    .index("byPrivateLessonStudent", ["privateLessonId", "studentId"])
    .index("byBillable", ["billable"]),
  holidays: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  })
    .index("byStartDate", ["startDate"])
    .index("byEndDate", ["endDate"]),
});
