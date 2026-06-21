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
    stripeCustomerId: v.optional(v.string()),
    // Legacy Clerk ID. Convex Auth stores its user ID in the subject JWT field.
    externalId: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("byExternalId", ["externalId"]),
  accountSecurityChallenges: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("email_change"), v.literal("password_reset")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirming"),
      v.literal("consumed"),
      v.literal("expired"),
      v.literal("superseded"),
      v.literal("too_many_attempts"),
    ),
    codeHash: v.string(),
    currentEmail: v.string(),
    newEmail: v.optional(v.string()),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndType", ["userId", "type"]),
  accountSecurityThrottles: defineTable({
    userId: v.id("users"),
    emailChangeWindowStartedAt: v.optional(v.number()),
    emailChangeSendCount: v.optional(v.number()),
    emailChangeLastSentAt: v.optional(v.number()),
    passwordResetWindowStartedAt: v.optional(v.number()),
    passwordResetSendCount: v.optional(v.number()),
    passwordResetLastSentAt: v.optional(v.number()),
  }).index("byUser", ["userId"]),
  notifications: defineTable({
    recipientUserId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    href: v.string(),
    actorUserId: v.optional(v.id("users")),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("byRecipient", ["recipientUserId"])
    .index("byRecipientAndCreatedAt", ["recipientUserId", "createdAt"]),
  pushSubscriptions: defineTable({
    recipientUserId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    disabledAt: v.optional(v.number()),
    failureCount: v.number(),
    lastFailureAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
  })
    .index("byRecipient", ["recipientUserId"])
    .index("byEndpoint", ["endpoint"]),
  pushDeliveries: defineTable({
    notificationId: v.id("notifications"),
    subscriptionId: v.id("pushSubscriptions"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("retrying"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    attemptCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("byNotification", ["notificationId"])
    .index("byNotificationAndSubscription", [
      "notificationId",
      "subscriptionId",
    ]),
  groups: defineTable({
    name: v.string(),
    description: v.string(),
    password: v.string(),
    info: v.optional(v.string()),
    color: v.optional(v.string()),
    document: v.optional(v.id("_storage")),
    managedEnrollment: v.optional(v.boolean()),
  }).index("byPassword", ["password"]),
  groupMembers: defineTable({
    group: v.id("groups"),
    user: v.id("users"),
  }).index("byGroup", ["group"]),
  bulletin: defineTable({
    title: v.string(),
    subtitle: v.optional(v.string()),
    venue: v.optional(
      v.object({ name: v.string(), url: v.optional(v.string()) }),
    ),
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
  householdPayers: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
    active: v.boolean(),
    isPrimary: v.boolean(),
    autopayEnabled: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byHousehold", ["householdId"])
    .index("byUser", ["userId"])
    .index("byHouseholdUser", ["householdId", "userId"])
    .index("byHouseholdActive", ["householdId", "active"]),
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
    enrollmentMode: v.optional(
      v.union(v.literal("standard"), v.literal("per_session")),
    ),
    perSessionPriceCents: v.optional(v.number()),
    enrollmentOpen: v.optional(v.boolean()),
    visibleToGroupIds: v.optional(v.array(v.id("groups"))),
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
  classSessionSignups: defineTable({
    classId: v.id("classes"),
    session: v.id("sessions"),
    student: v.id("students"),
    requestedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("enrolled"),
      v.literal("waitlisted"),
      v.literal("cancelled"),
    ),
    unitPriceCents: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byClass", ["classId"])
    .index("bySession", ["session"])
    .index("byStudent", ["student"])
    .index("bySessionStudent", ["session", "student"])
    .index("byClassStudent", ["classId", "student"]),
  activityLog: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    actorId: v.optional(v.id("users")),
    eventType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("byEntity", ["entityType", "entityId"])
    .index("byActor", ["actorId"]),
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
    .index("byStatus", ["status"])
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
    siblingDiscount: v.optional(
      v.object({
        enabled: v.boolean(),
        percentOffBasisPoints: v.number(),
        appliesTo: v.literal("all_but_highest"),
      }),
    ),
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
  billingAdjustments: defineTable({
    scopeType: v.union(
      v.literal("household_tuition"),
      v.literal("billing_run_item"),
      v.literal("student_tuition"),
      v.literal("student_private_charges"),
    ),
    scopeId: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    kind: v.union(v.literal("discount"), v.literal("surcharge")),
    calculationType: v.union(v.literal("fixed_cents"), v.literal("percent")),
    amount: v.number(),
    reasonCode: v.union(
      v.literal("scholarship"),
      v.literal("goodwill"),
      v.literal("manual_correction"),
      v.literal("waiver"),
      v.literal("surcharge"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("voided")),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    voidedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    voidedAt: v.optional(v.number()),
  })
    .index("byPeriodScope", ["periodStart", "periodEnd", "scopeType"])
    .index("byScopePeriod", [
      "scopeType",
      "scopeId",
      "periodStart",
      "periodEnd",
    ])
    .index("byStatus", ["status"]),
  billingRuns: defineTable({
    periodStart: v.string(),
    periodEnd: v.string(),
    sourceMode: v.union(
      v.literal("tuition"),
      v.literal("charges"),
      v.literal("both"),
    ),
    status: v.union(v.literal("draft"), v.literal("dispatched")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    dispatchedAt: v.optional(v.number()),
  })
    .index("byPeriodMode", ["periodStart", "periodEnd", "sourceMode"])
    .index("byStatus", ["status"]),
  billingRunItems: defineTable({
    billingRunId: v.id("billingRuns"),
    householdId: v.string(),
    householdName: v.string(),
    householdLinkSource: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    includeTuition: v.boolean(),
    includeCharges: v.boolean(),
    tuitionSubtotalCents: v.number(),
    chargesSubtotalCents: v.number(),
    subtotalBeforeRunAdjustmentsCents: v.number(),
    sourceSummary: v.object({
      tuitionStudentCount: v.number(),
      tuitionIncomplete: v.boolean(),
      privateChargeCount: v.number(),
      perSessionChargeCount: v.number(),
      unpricedChargeCount: v.number(),
    }),
    sourceReferences: v.object({
      tuitionHouseholdId: v.optional(v.string()),
      privateChargeIds: v.array(v.string()),
      perSessionChargeIds: v.array(v.string()),
    }),
    sourceComponents: v.optional(
      v.object({
        tuitionStudents: v.array(
          v.object({
            studentId: v.string(),
            studentName: v.string(),
            baseTuitionCents: v.optional(v.number()),
          }),
        ),
        privateStudents: v.array(
          v.object({
            studentId: v.string(),
            studentName: v.string(),
            subtotalCents: v.number(),
          }),
        ),
        perSessionChargesCents: v.number(),
        householdTuitionAdjustmentTotalCents: v.number(),
        siblingDiscount: v.optional(
          v.object({
            enabled: v.boolean(),
            percentOffBasisPoints: v.number(),
            appliesTo: v.literal("all_but_highest"),
          }),
        ),
      }),
    ),
    dispatchedSourceAdjustments: v.optional(
      v.array(
        v.object({
          adjustmentId: v.string(),
          scopeType: v.union(
            v.literal("student_tuition"),
            v.literal("student_private_charges"),
          ),
          scopeId: v.string(),
          studentName: v.string(),
          kind: v.union(v.literal("discount"), v.literal("surcharge")),
          calculationType: v.union(
            v.literal("fixed_cents"),
            v.literal("percent"),
          ),
          reasonCode: v.union(
            v.literal("scholarship"),
            v.literal("goodwill"),
            v.literal("manual_correction"),
            v.literal("waiver"),
            v.literal("surcharge"),
            v.literal("other"),
          ),
          note: v.optional(v.string()),
          applicable: v.boolean(),
          amountCents: v.number(),
          percentageBaseCents: v.optional(v.number()),
        }),
      ),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("dispatch_failed"),
      v.literal("dispatched"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    dispatchedBy: v.optional(v.id("users")),
    dispatchedAt: v.optional(v.number()),
    dispatchedAdjustmentTotalCents: v.optional(v.number()),
    dispatchedFinalTotalCents: v.optional(v.number()),
    dispatchedTuitionSubtotalCents: v.optional(v.number()),
    dispatchedChargesSubtotalCents: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()),
    collectionMethod: v.optional(
      v.union(v.literal("charge_automatically"), v.literal("send_invoice")),
    ),
    autopayEnabledSnapshot: v.optional(v.boolean()),
    dispatchFailureReason: v.optional(v.string()),
    dispatchFailureAt: v.optional(v.number()),
  })
    .index("byRun", ["billingRunId"])
    .index("byRunStatus", ["billingRunId", "status"])
    .index("byPeriodHousehold", ["periodStart", "periodEnd", "householdId"]),
  privateRates: defineTable({
    name: v.string(),
    participants: v.union(v.literal(1), v.literal(2), v.literal(3)),
    hourlyPriceCents: v.number(),
    active: v.boolean(),
    activatedAt: v.number(),
    inactivatedAt: v.optional(v.number()),
  })
    .index("byParticipants", ["participants"])
    .index("byParticipantsActive", ["participants", "active"])
    .index("byActive", ["active"]),
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
    appliedPrivateRateId: v.optional(v.id("privateRates")),
    appliedPriceCents: v.optional(v.number()),
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
