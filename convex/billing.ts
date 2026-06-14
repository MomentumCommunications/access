import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  calculateWeeklyClassMinuteSegments,
  calculateWeeklyClassMinutes,
  collectBillingEnrollmentExclusions,
} from "./lib/billing/weeklyClassHours";
import {
  calculatePeriodTuitionsWithExclusions,
  type TuitionCalculationInput,
} from "./lib/billing/tuitionCalculation";
import {
  aggregateHouseholdTuitions,
  type HouseholdLinkSource,
} from "./lib/billing/householdTuition";
import { hasUserRole } from "./lib/roles";
import { getCurrentUserOrThrow } from "./users";
import {
  nextPricingSchemaVersion,
  type SiblingDiscountConfig,
  type NormalizedTuitionTier,
  validateNormalizedTuitionTiers,
  validateSiblingDiscountConfig,
} from "../shared/tuition-pricing";
import {
  calculatePerSessionChargeCandidates,
  resolvedClassEnrollmentMode,
} from "../shared/per-session-signup";
import { aggregatePerSessionCharges } from "../shared/billing-charges";
import {
  calculatePrivateChargeCents,
  validatePrivateHourlyPriceCents,
  validatePrivateParticipantCount,
} from "../shared/private-pricing";
import {
  privateRateName,
  snapshotOpenPrivateChargesForRate,
} from "./lib/billing/privatePricing";

function accountName(account: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string | string[];
}) {
  const fullName = [account.firstName, account.lastName]
    .filter(Boolean)
    .join(" ");
  const email = Array.isArray(account.email) ? account.email[0] : account.email;
  return fullName || account.displayName || account.name || email || "Unnamed";
}

function validateIsoDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid date.`);
  }
}

type BillingCtx = QueryCtx | MutationCtx;

const pricingTierValidator = v.object({
  label: v.string(),
  maxWeeklyMinutes: v.optional(v.number()),
  monthlyAmountCents: v.number(),
  sortOrder: v.number(),
});

const siblingDiscountValidator = v.object({
  enabled: v.boolean(),
  percentOffBasisPoints: v.number(),
  appliesTo: v.literal("all_but_highest"),
});

const privateParticipantCountValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const disabledSiblingDiscount: SiblingDiscountConfig = {
  enabled: false,
  percentOffBasisPoints: 0,
  appliesTo: "all_but_highest",
};

async function requireAdmin(ctx: BillingCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) {
    throw new Error("Unauthorized");
  }
}

function validatePricingSchemaName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Pricing schema name is required.");
  }
  if (trimmed.length > 100) {
    throw new Error("Pricing schema name must be 100 characters or fewer.");
  }
  return trimmed;
}

function validateHouseholdName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Household name is required.");
  }
  if (trimmed.length > 100) {
    throw new Error("Household name must be 100 characters or fewer.");
  }
  return trimmed;
}

async function getPricingSchemaTiers(
  ctx: BillingCtx,
  pricingSchemaId: Id<"pricingSchemas">,
) {
  return await ctx.db
    .query("tuitionPricingTiers")
    .withIndex("byPricingSchemaOrder", (q) =>
      q.eq("pricingSchemaId", pricingSchemaId),
    )
    .collect();
}

function normalizedStoredTiers(
  tiers: Awaited<ReturnType<typeof getPricingSchemaTiers>>,
): NormalizedTuitionTier[] {
  return tiers.map((tier) => ({
    label: tier.label,
    maxWeeklyMinutes: tier.maxWeeklyMinutes,
    monthlyAmountCents: tier.monthlyAmountCents,
    sortOrder: tier.sortOrder,
  }));
}

async function getWeeklyClassHoursInputs(
  ctx: QueryCtx,
): Promise<TuitionCalculationInput[]> {
  const enrollments = await ctx.db.query("classEnrollments").collect();
  const students = new Map(
    (await ctx.db.query("students").collect()).map((student) => [
      student._id,
      student,
    ]),
  );
  const classes = new Map(
    (await ctx.db.query("classes").collect()).map((classItem) => [
      classItem._id,
      classItem,
    ]),
  );

  return enrollments.map((enrollment) => {
    const classItem = classes.get(enrollment.classId);
    return {
      enrollmentId: enrollment._id,
      classId: enrollment.classId,
      classTitle: classItem?.title,
      studentId: enrollment.student,
      studentStatus: students.get(enrollment.student)?.status || "missing",
      enrollmentStatus: enrollment.status,
      classEnrollmentMode: resolvedClassEnrollmentMode(
        classItem?.enrollmentMode,
      ),
      enrollmentStartDate: enrollment.startDate,
      enrollmentEndDate: enrollment.endDate,
      classStatus: classItem?.status || "missing",
      classStartDate: classItem?.startDate,
      classEndDate: classItem?.endDate,
      startTime: classItem?.startTime,
      endTime: classItem?.endTime,
      weekdays: classItem?.weekdays,
      prorateTuition: enrollment.prorateTuition,
    };
  });
}

async function replaceAccountHousehold(
  ctx: MutationCtx,
  userId: Id<"users">,
  householdId: Id<"households">,
) {
  const account = await ctx.db.get(userId);
  if (!account) {
    throw new Error("Account not found.");
  }
  const household = await ctx.db.get(householdId);
  if (!household) {
    throw new Error("Household not found.");
  }

  const existingMemberships = await ctx.db
    .query("householdMembers")
    .withIndex("byUser", (q) => q.eq("userId", userId))
    .collect();
  const matchingMembership = existingMemberships.find(
    (membership) => membership.householdId === householdId,
  );
  await Promise.all(
    existingMemberships
      .filter((membership) => membership._id !== matchingMembership?._id)
      .map((membership) => ctx.db.delete(membership._id)),
  );
  if (!matchingMembership) {
    await ctx.db.insert("householdMembers", { householdId, userId });
  }
}

async function getHouseholdResolutionData(ctx: QueryCtx) {
  const [contacts, memberships, households, users] = await Promise.all([
    ctx.db.query("studentContacts").collect(),
    ctx.db.query("householdMembers").collect(),
    ctx.db.query("households").collect(),
    ctx.db.query("users").collect(),
  ]);
  const contactsByStudent = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const studentContacts = contactsByStudent.get(contact.student) || [];
    studentContacts.push(contact);
    contactsByStudent.set(contact.student, studentContacts);
  }

  return {
    contactsByStudent,
    membershipByUser: new Map(
      memberships.map((membership) => [membership.userId, membership]),
    ),
    householdsById: new Map(
      households.map((household) => [household._id, household]),
    ),
    usersById: new Map(users.map((user) => [user._id, user])),
  };
}

function resolveStudentHousehold(
  studentId: Id<"students">,
  data: Awaited<ReturnType<typeof getHouseholdResolutionData>>,
): {
  householdId?: string;
  householdName?: string;
  householdLinkSource?: HouseholdLinkSource;
  householdLinkWarning?: string;
} {
  const contacts = [...(data.contactsByStudent.get(studentId) || [])].sort(
    (left, right) =>
      Number(right.isPrimary) - Number(left.isPrimary) ||
      left._creationTime - right._creationTime,
  );
  const linkedHouseholds = contacts.flatMap((contact) => {
    if (!contact.user) return [];
    const membership = data.membershipByUser.get(contact.user);
    const household = membership
      ? data.householdsById.get(membership.householdId)
      : undefined;
    return household ? [household] : [];
  });
  const uniqueHouseholds = [
    ...new Map(
      linkedHouseholds.map((household) => [household._id, household]),
    ).values(),
  ];
  const household = uniqueHouseholds[0];
  if (household) {
    return {
      householdId: household._id,
      householdName: household.name,
      householdLinkSource: "household",
      householdLinkWarning:
        uniqueHouseholds.length > 1
          ? "Student contacts belong to multiple households; using the primary linked household."
          : undefined,
    };
  }

  const account = contacts.find((contact) => contact.user)?.user;
  const user = account ? data.usersById.get(account) : undefined;
  if (user) {
    return {
      householdId: `account:${user._id}`,
      householdName: `${accountName(user)} household`,
      householdLinkSource: "account_fallback",
      householdLinkWarning:
        "No household is assigned; grouped by the student's connected account.",
    };
  }

  return {
    householdLinkWarning:
      "No household or connected account is assigned; using a standalone student bucket.",
  };
}

export const adminWeeklyClassMinutes = query({
  args: { asOfDate: v.string() },
  handler: async (ctx, { asOfDate }) => {
    await requireAdmin(ctx);
    validateIsoDate(asOfDate, "asOfDate");

    return calculateWeeklyClassMinutes(
      await getWeeklyClassHoursInputs(ctx),
      asOfDate,
    );
  },
});

export const adminWeeklyClassMinuteSegments = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, { periodStart, periodEnd }) => {
    await requireAdmin(ctx);
    validateIsoDate(periodStart, "periodStart");
    validateIsoDate(periodEnd, "periodEnd");
    if (periodEnd < periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }

    return calculateWeeklyClassMinuteSegments(
      await getWeeklyClassHoursInputs(ctx),
      periodStart,
      periodEnd,
    );
  },
});

export const adminTuitionReview = query({
  args: { asOfDate: v.string() },
  handler: async (ctx, { asOfDate }) => {
    await requireAdmin(ctx);
    validateIsoDate(asOfDate, "asOfDate");

    const totals = calculateWeeklyClassMinutes(
      await getWeeklyClassHoursInputs(ctx),
      asOfDate,
    );

    return await Promise.all(
      totals.map(async (total) => {
        const student = await ctx.db.get(
          total.studentId as Id<"students">,
        );
        if (!student) return null;
        const contacts = await ctx.db
          .query("studentContacts")
          .withIndex("byStudent", (q) =>
            q.eq("student", student._id),
          )
          .collect();
        const primaryContact =
          contacts.find((contact) => contact.isPrimary) || contacts[0];
        const account = primaryContact?.user
          ? await ctx.db.get(primaryContact.user)
          : null;

        return {
          student,
          weeklyMinutes: total.weeklyMinutes,
          householdName: account
            ? accountName(account)
            : primaryContact?.name ||
              primaryContact?.inviteEmail ||
              "Not set",
        };
      }),
    ).then((rows) => rows.filter((row) => row !== null));
  },
});

export const adminPeriodTuitionReview = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, { periodStart, periodEnd }) => {
    await requireAdmin(ctx);
    validateIsoDate(periodStart, "periodStart");
    validateIsoDate(periodEnd, "periodEnd");
    if (periodEnd < periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }

    const inputs = await getWeeklyClassHoursInputs(ctx);
    const exclusions = collectBillingEnrollmentExclusions(inputs);
    const excludedEnrollments = await Promise.all(
      exclusions.map(async (exclusion) => {
        const student = await ctx.db.get(
          exclusion.studentId as Id<"students">,
        );
        return {
          ...exclusion,
          studentName: student
            ? `${student.firstName} ${student.lastName}`
            : "Missing student",
        };
      }),
    );
    const activeSchema = await ctx.db
      .query("pricingSchemas")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .first();
    if (!activeSchema) {
      return {
        pricingSchema: null,
        rows: [],
        households: [],
        excludedEnrollments,
      };
    }
    const storedTiers = await getPricingSchemaTiers(ctx, activeSchema._id);
    const calculationResult = calculatePeriodTuitionsWithExclusions(
      inputs,
      normalizedStoredTiers(storedTiers),
      periodStart,
      periodEnd,
    );
    const calculations = calculationResult.tuitions;

    const householdData = await getHouseholdResolutionData(ctx);
    const rows = await Promise.all(
      calculations.map(async (calculation) => {
        const student = await ctx.db.get(
          calculation.studentId as Id<"students">,
        );
        if (!student) return null;
        const pricedDays = calculation.segments
          .filter((segment) => segment.monthlyAmountCents !== undefined)
          .reduce((days, segment) => days + segment.days, 0);
        const pricedAmounts = new Set(
          calculation.segments.flatMap((segment) =>
            segment.monthlyAmountCents === undefined
              ? []
              : [segment.monthlyAmountCents],
          ),
        );

        const household = resolveStudentHousehold(student._id, householdData);

        return {
          ...calculation,
          student,
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          ...household,
          baseTuitionCents: calculation.totalTuitionCents,
          pricingSource: `${activeSchema.name} v${activeSchema.version}`,
          isProrated:
            pricedDays < calculation.periodDays || pricedAmounts.size > 1,
        };
      }),
    );
    const tuitionRows = rows.filter((row) => row !== null);

    return {
      pricingSchema: {
        _id: activeSchema._id,
        name: activeSchema.name,
        version: activeSchema.version,
      },
      rows: tuitionRows,
      households: aggregateHouseholdTuitions(
        tuitionRows,
        activeSchema.siblingDiscount || disabledSiblingDiscount,
      ),
      excludedEnrollments,
    };
  },
});

export const adminPeriodPerSessionCharges = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, { periodStart, periodEnd }) => {
    await requireAdmin(ctx);
    validateIsoDate(periodStart, "periodStart");
    validateIsoDate(periodEnd, "periodEnd");
    if (periodEnd < periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }

    const signups = await ctx.db.query("classSessionSignups").collect();
    const rows = (
      await Promise.all(
        signups.map(async (signup) => {
          const [student, classItem, session] = await Promise.all([
            ctx.db.get(signup.student),
            ctx.db.get(signup.classId),
            ctx.db.get(signup.session),
          ]);
          if (!student || !classItem || !session) return null;
          return {
            signupId: signup._id,
            studentId: student._id,
            studentStatus: student.status,
            classId: classItem._id,
            classMode: resolvedClassEnrollmentMode(
              classItem.enrollmentMode,
            ),
            sessionId: session._id,
            sessionDate: session.date,
            sessionActive: session.active,
            sessionStatus: session.status,
            signupStatus: signup.status,
            unitPriceCents: signup.unitPriceCents,
            student,
            classItem,
            session,
          };
        }),
      )
    ).filter((row) => row !== null);

    return calculatePerSessionChargeCandidates(
      rows,
      periodStart,
      periodEnd,
    );
  },
});

export const adminPeriodChargesReview = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    startsAtOrAfter: v.number(),
    startsBefore: v.number(),
  },
  handler: async (
    ctx,
    { periodStart, periodEnd, startsAtOrAfter, startsBefore },
  ) => {
    await requireAdmin(ctx);
    validateIsoDate(periodStart, "periodStart");
    validateIsoDate(periodEnd, "periodEnd");
    if (periodEnd < periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }
    if (startsBefore <= startsAtOrAfter) {
      throw new Error("Billing range end must be after its start.");
    }

    const householdData = await getHouseholdResolutionData(ctx);
    const [signups, privateParticipations, privateRates] = await Promise.all([
      ctx.db.query("classSessionSignups").collect(),
      ctx.db
        .query("privateLessonStudents")
        .withIndex("byBillable", (q) => q.eq("billable", true))
        .collect(),
      ctx.db.query("privateRates").collect(),
    ]);
    const activePrivateRateByParticipants = new Map<
      1 | 2 | 3,
      (typeof privateRates)[number]
    >();
    for (const rate of privateRates
      .filter((candidate) => candidate.active)
      .sort(
        (left, right) =>
          right.activatedAt - left.activatedAt ||
          right._id.localeCompare(left._id),
      )) {
      if (!activePrivateRateByParticipants.has(rate.participants)) {
        activePrivateRateByParticipants.set(rate.participants, rate);
      }
    }
    const privateRateById = new Map(
      privateRates.map((rate) => [rate._id, rate]),
    );

    const perSessionRows = (
      await Promise.all(
        signups.map(async (signup) => {
          const [student, classItem, session] = await Promise.all([
            ctx.db.get(signup.student),
            ctx.db.get(signup.classId),
            ctx.db.get(signup.session),
          ]);
          if (!student || !classItem || !session) return null;
          return {
            signupId: signup._id,
            studentId: student._id,
            studentStatus: student.status,
            classId: classItem._id,
            classMode: resolvedClassEnrollmentMode(
              classItem.enrollmentMode,
            ),
            sessionId: session._id,
            sessionDate: session.date,
            sessionActive: session.active,
            sessionStatus: session.status,
            signupStatus: signup.status,
            unitPriceCents: signup.unitPriceCents,
            student,
            classItem,
            session,
          };
        }),
      )
    ).filter((row) => row !== null);
    const candidates = calculatePerSessionChargeCandidates(
      perSessionRows,
      periodStart,
      periodEnd,
    );
    const candidateByStudentClass = new Map(
      candidates.map((row) => [
        `${row.studentId}:${row.classId}`,
        row,
      ]),
    );
    const perSessionCharges = aggregatePerSessionCharges(
      candidates,
      periodStart,
      periodEnd,
    ).map((aggregate) => {
      const source = candidateByStudentClass.get(
        `${aggregate.studentId}:${aggregate.classId}`,
      )!;
      return {
        ...aggregate,
        student: source.student,
        classItem: source.classItem,
        household: resolveStudentHousehold(source.student._id, householdData),
      };
    });

    const privateCharges = (
      await Promise.all(
        privateParticipations.map(async (participation) => {
          const lesson = await ctx.db.get(participation.privateLessonId);
          if (
            !lesson ||
            lesson.status !== "completed" ||
            lesson.startsAt < startsAtOrAfter ||
            lesson.startsAt >= startsBefore ||
            participation.status === "scheduled" ||
            participation.status === "cancelled"
          ) {
            return null;
          }
          const [privateSeries, student] = await Promise.all([
            ctx.db.get(lesson.privateId),
            ctx.db.get(participation.studentId),
          ]);
          if (!student) return null;
          const participants = (privateSeries?.studentIds || []).length;
          const snapshottedRate = participation.appliedPrivateRateId
            ? privateRateById.get(participation.appliedPrivateRateId)
            : undefined;
          const activeRate = activePrivateRateByParticipants.get(
            participants as 1 | 2 | 3,
          );
          const appliedRate = snapshottedRate || activeRate;
          const amountCents =
            participation.appliedPriceCents ??
            (appliedRate
              ? calculatePrivateChargeCents(
                  appliedRate.hourlyPriceCents,
                  lesson.durationMinutes,
                )
              : undefined);
          const warning =
            participants < 1 || participants > 3
              ? "Private default participant count must be between 1 and 3."
              : !appliedRate
                ? `No active private rate is configured for ${participants} participant${
                    participants === 1 ? "" : "s"
                  }.`
                : undefined;
          return {
            participation,
            lesson,
            private: privateSeries,
            student,
            instructor: privateSeries
              ? await ctx.db.get(privateSeries.instructorId)
              : null,
            household: resolveStudentHousehold(student._id, householdData),
            pricing: {
              participants,
              privateRateId: appliedRate?._id,
              rateName: appliedRate?.name,
              hourlyPriceCents: appliedRate?.hourlyPriceCents,
              amountCents,
              snapshotted:
                participation.appliedPrivateRateId !== undefined &&
                participation.appliedPriceCents !== undefined,
              warning,
            },
          };
        }),
      )
    )
      .filter((row) => row !== null)
      .sort(
        (left, right) =>
          left.lesson.startsAt - right.lesson.startsAt ||
          left.student._id.localeCompare(right.student._id),
      );

    return {
      periodStart,
      periodEnd,
      privateCharges,
      perSessionCharges,
    };
  },
});

export const adminListPrivateRates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rates = await ctx.db.query("privateRates").collect();
    return rates.sort(
      (left, right) =>
        left.participants - right.participants ||
        Number(right.active) - Number(left.active) ||
        right.activatedAt - left.activatedAt ||
        right._id.localeCompare(left._id),
    );
  },
});

export const adminCreatePrivateRate = mutation({
  args: {
    name: v.optional(v.string()),
    participants: privateParticipantCountValidator,
    hourlyPriceCents: v.number(),
  },
  handler: async (ctx, { name, participants, hourlyPriceCents }) => {
    await requireAdmin(ctx);
    validatePrivateParticipantCount(participants);
    validatePrivateHourlyPriceCents(hourlyPriceCents);
    const normalizedName = name?.trim() || privateRateName(participants);
    if (normalizedName.length > 80) {
      throw new Error("Private rate name must be 80 characters or fewer.");
    }

    const now = Date.now();
    const activeRates = await ctx.db
      .query("privateRates")
      .withIndex("byParticipantsActive", (q) =>
        q.eq("participants", participants).eq("active", true),
      )
      .collect();
    for (const activeRate of activeRates) {
      await snapshotOpenPrivateChargesForRate(ctx, activeRate);
      await ctx.db.patch(activeRate._id, {
        active: false,
        inactivatedAt: now,
      });
    }

    return await ctx.db.insert("privateRates", {
      name: normalizedName,
      participants,
      hourlyPriceCents,
      active: true,
      activatedAt: now,
    });
  },
});

export const adminDeactivatePrivateRate = mutation({
  args: { privateRateId: v.id("privateRates") },
  handler: async (ctx, { privateRateId }) => {
    await requireAdmin(ctx);
    const rate = await ctx.db.get(privateRateId);
    if (!rate) {
      throw new Error("Private rate not found.");
    }
    if (!rate.active) return;
    await snapshotOpenPrivateChargesForRate(ctx, rate);
    await ctx.db.patch(privateRateId, {
      active: false,
      inactivatedAt: Date.now(),
    });
  },
});

export const adminListHouseholds = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const households = await ctx.db.query("households").collect();
    const memberships = await ctx.db.query("householdMembers").collect();
    const memberCountByHousehold = new Map<string, number>();
    for (const membership of memberships) {
      memberCountByHousehold.set(
        membership.householdId,
        (memberCountByHousehold.get(membership.householdId) || 0) + 1,
      );
    }

    return households
      .map((household) => ({
        household,
        memberCount: memberCountByHousehold.get(household._id) || 0,
      }))
      .sort(
        (left, right) =>
          left.household.name.localeCompare(right.household.name) ||
          left.household._id.localeCompare(right.household._id),
      );
  },
});

export const adminGetAccountHousehold = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const membership = await ctx.db
      .query("householdMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();
    if (!membership) {
      return null;
    }
    const household = await ctx.db.get(membership.householdId);
    return household ? { membership, household } : null;
  },
});

export const adminAttachAccountToHousehold = mutation({
  args: {
    userId: v.id("users"),
    householdId: v.id("households"),
  },
  handler: async (ctx, { userId, householdId }) => {
    await requireAdmin(ctx);
    await replaceAccountHousehold(ctx, userId, householdId);
  },
});

export const adminCreateHouseholdForAccount = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, { userId, name }) => {
    await requireAdmin(ctx);
    const normalizedName = validateHouseholdName(name);
    const now = Date.now();
    const householdId = await ctx.db.insert("households", {
      name: normalizedName,
      createdAt: now,
      updatedAt: now,
    });
    await replaceAccountHousehold(ctx, userId, householdId);
    return householdId;
  },
});

export const adminRemoveAccountFromHousehold = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const memberships = await ctx.db
      .query("householdMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(
      memberships.map((membership) => ctx.db.delete(membership._id)),
    );
  },
});

export const adminListPricingSchemas = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const schemas = await ctx.db.query("pricingSchemas").collect();
    const statusOrder = { active: 0, draft: 1, archived: 2 };

    return await Promise.all(
      schemas
        .sort(
          (a, b) =>
            statusOrder[a.status] - statusOrder[b.status] ||
            b.updatedAt - a.updatedAt,
        )
        .map(async (schema) => ({
          schema,
          tierCount: (await getPricingSchemaTiers(ctx, schema._id)).length,
        })),
    );
  },
});

export const adminGetPricingSchema = query({
  args: { pricingSchemaId: v.id("pricingSchemas") },
  handler: async (ctx, { pricingSchemaId }) => {
    await requireAdmin(ctx);
    const schema = await ctx.db.get(pricingSchemaId);
    if (!schema) {
      return null;
    }
    return {
      schema,
      tiers: await getPricingSchemaTiers(ctx, pricingSchemaId),
    };
  },
});

export const adminCreatePricingSchema = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await requireAdmin(ctx);
    const normalizedName = validatePricingSchemaName(name);
    const schemas = await ctx.db.query("pricingSchemas").collect();
    const now = Date.now();

    return await ctx.db.insert("pricingSchemas", {
      name: normalizedName,
      version: nextPricingSchemaVersion(schemas, normalizedName),
      status: "draft",
      siblingDiscount: disabledSiblingDiscount,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminSaveSiblingDiscount = mutation({
  args: {
    pricingSchemaId: v.id("pricingSchemas"),
    siblingDiscount: siblingDiscountValidator,
  },
  handler: async (ctx, { pricingSchemaId, siblingDiscount }) => {
    await requireAdmin(ctx);
    const schema = await ctx.db.get(pricingSchemaId);
    if (!schema) {
      throw new Error("Pricing schema not found.");
    }
    if (schema.status !== "draft") {
      throw new Error("Only draft pricing schemas can be edited.");
    }
    validateSiblingDiscountConfig(siblingDiscount);
    await ctx.db.patch(pricingSchemaId, {
      siblingDiscount,
      updatedAt: Date.now(),
    });
  },
});

export const adminSavePricingSchema = mutation({
  args: {
    pricingSchemaId: v.id("pricingSchemas"),
    tiers: v.array(pricingTierValidator),
  },
  handler: async (ctx, { pricingSchemaId, tiers }) => {
    await requireAdmin(ctx);
    const schema = await ctx.db.get(pricingSchemaId);
    if (!schema) {
      throw new Error("Pricing schema not found.");
    }
    if (schema.status !== "draft") {
      throw new Error("Only draft pricing schemas can be edited.");
    }
    if (tiers.length > 0) {
      validateNormalizedTuitionTiers(tiers);
    }

    const existingTiers = await getPricingSchemaTiers(ctx, pricingSchemaId);
    await Promise.all(existingTiers.map((tier) => ctx.db.delete(tier._id)));
    await Promise.all(
      tiers.map((tier) =>
        ctx.db.insert("tuitionPricingTiers", {
          pricingSchemaId,
          label: tier.label.trim(),
          maxWeeklyMinutes: tier.maxWeeklyMinutes,
          monthlyAmountCents: tier.monthlyAmountCents,
          sortOrder: tier.sortOrder,
        }),
      ),
    );
    await ctx.db.patch(pricingSchemaId, { updatedAt: Date.now() });
  },
});

export const adminDuplicatePricingSchema = mutation({
  args: { pricingSchemaId: v.id("pricingSchemas") },
  handler: async (ctx, { pricingSchemaId }) => {
    await requireAdmin(ctx);
    const source = await ctx.db.get(pricingSchemaId);
    if (!source) {
      throw new Error("Pricing schema not found.");
    }
    const sourceTiers = await getPricingSchemaTiers(ctx, pricingSchemaId);
    const schemas = await ctx.db.query("pricingSchemas").collect();
    const now = Date.now();
    const duplicateId = await ctx.db.insert("pricingSchemas", {
      name: source.name,
      version: nextPricingSchemaVersion(schemas, source.name),
      status: "draft",
      sourceSchemaId: source._id,
      siblingDiscount:
        source.siblingDiscount || disabledSiblingDiscount,
      createdAt: now,
      updatedAt: now,
    });
    await Promise.all(
      sourceTiers.map((tier) =>
        ctx.db.insert("tuitionPricingTiers", {
          pricingSchemaId: duplicateId,
          label: tier.label,
          maxWeeklyMinutes: tier.maxWeeklyMinutes,
          monthlyAmountCents: tier.monthlyAmountCents,
          sortOrder: tier.sortOrder,
        }),
      ),
    );
    return duplicateId;
  },
});

export const adminActivatePricingSchema = mutation({
  args: { pricingSchemaId: v.id("pricingSchemas") },
  handler: async (ctx, { pricingSchemaId }) => {
    await requireAdmin(ctx);
    const schema = await ctx.db.get(pricingSchemaId);
    if (!schema) {
      throw new Error("Pricing schema not found.");
    }
    if (schema.status !== "draft") {
      throw new Error("Only draft pricing schemas can be activated.");
    }
    const tiers = await getPricingSchemaTiers(ctx, pricingSchemaId);
    validateNormalizedTuitionTiers(normalizedStoredTiers(tiers));
    validateSiblingDiscountConfig(
      schema.siblingDiscount || disabledSiblingDiscount,
    );

    const now = Date.now();
    const activeSchemas = await ctx.db
      .query("pricingSchemas")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    await Promise.all(
      activeSchemas.map((active) =>
        ctx.db.patch(active._id, {
          status: "archived",
          updatedAt: now,
        }),
      ),
    );
    await ctx.db.patch(pricingSchemaId, {
      status: "active",
      activatedAt: now,
      updatedAt: now,
    });
  },
});

export const adminDeletePricingSchema = mutation({
  args: { pricingSchemaId: v.id("pricingSchemas") },
  handler: async (ctx, { pricingSchemaId }) => {
    await requireAdmin(ctx);
    const schema = await ctx.db.get(pricingSchemaId);
    if (!schema) {
      throw new Error("Pricing schema not found.");
    }
    if (schema.status !== "draft") {
      throw new Error("Only draft pricing schemas can be deleted.");
    }
    const tiers = await getPricingSchemaTiers(ctx, pricingSchemaId);
    await Promise.all(tiers.map((tier) => ctx.db.delete(tier._id)));
    await ctx.db.delete(pricingSchemaId);
  },
});
