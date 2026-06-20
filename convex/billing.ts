import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
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
import { getCurrentUser, getCurrentUserOrThrow } from "./users";
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
  getActivePrivateRate,
  snapshotOpenPrivateChargesForRate,
} from "./lib/billing/privatePricing";
import {
  applyBillingAdjustments,
  applyTargetedBillingAdjustments,
  assertBillingAdjustmentFinanciallyEditable,
  billingPeriodsOverlap,
  buildBillingAdjustmentActivityEvent,
  isRecurringStudentAdjustment,
  selectBillingAdjustments,
  validateBillingAdjustmentInput,
  type BillingAdjustmentInput,
} from "../shared/billing-adjustments";
import {
  billingRunSourcesOverlap,
  buildBillingRunBundles,
  buildBillingRunItemSnapshot,
  calculateBillingRunItemTotal,
  resolveBillingRunSourceAdjustments,
  resolveBillingRunGeneration,
  type BillingRunSourceMode,
} from "../shared/billing-runs";
import { recordActivityEvent } from "./lib/activityLog";
import { resolveBillingRunItemSourceComponents } from "./lib/billing/runSourceComponents";
import { todayValue } from "./lib/scheduling";
import {
  availableTuitionMonths,
  billingMonthPeriod,
  isPrivateConnectedToHousehold,
  resolveTuitionPlanMonth,
  selectHouseholdTuitionBreakdown,
  tuitionMonthNavigation,
} from "../shared/tuition-plan";

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

const billingAdjustmentScopeTypeValidator = v.union(
  v.literal("household_tuition"),
  v.literal("billing_run_item"),
  v.literal("student_tuition"),
  v.literal("student_private_charges"),
);
const billingAdjustmentKindValidator = v.union(
  v.literal("discount"),
  v.literal("surcharge"),
);
const billingAdjustmentCalculationTypeValidator = v.union(
  v.literal("fixed_cents"),
  v.literal("percent"),
);
const billingAdjustmentReasonCodeValidator = v.union(
  v.literal("scholarship"),
  v.literal("goodwill"),
  v.literal("manual_correction"),
  v.literal("waiver"),
  v.literal("surcharge"),
  v.literal("other"),
);
const billingRunSourceModeValidator = v.union(
  v.literal("tuition"),
  v.literal("charges"),
  v.literal("both"),
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
  return user;
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

function cleanAdjustmentNote(note?: string) {
  return note?.trim() || undefined;
}

function storedBillingAdjustmentInput(adjustment: BillingAdjustmentInput) {
  return {
    ...adjustment,
    scopeId: adjustment.scopeId.trim(),
    note: cleanAdjustmentNote(adjustment.note),
  };
}

async function assertRunAdjustmentScopeEditable(
  ctx: BillingCtx,
  input: Pick<
    BillingAdjustmentInput,
    "scopeType" | "scopeId" | "periodStart" | "periodEnd"
  >,
) {
  if (input.scopeType !== "billing_run_item") return;
  const runItem = await ctx.db.get(
    input.scopeId as Id<"billingRunItems">,
  );
  if (!runItem) {
    throw new Error("Billing run item not found.");
  }
  if (runItem.status === "dispatched") {
    throw new Error("Dispatched billing run items cannot be adjusted.");
  }
  if (
    runItem.periodStart !== input.periodStart ||
    runItem.periodEnd !== input.periodEnd
  ) {
    throw new Error("Billing adjustment period must match its run item.");
  }
}

async function assertBillingAdjustmentTargetExists(
  ctx: BillingCtx,
  input: Pick<BillingAdjustmentInput, "scopeType" | "scopeId">,
) {
  if (!isRecurringStudentAdjustment(input.scopeType)) return;
  const studentId = ctx.db.normalizeId("students", input.scopeId);
  if (!studentId || !(await ctx.db.get(studentId))) {
    throw new Error("Billing adjustment student not found.");
  }
}

async function hasDispatchedAdjustmentUsage(
  ctx: BillingCtx,
  adjustmentId: Id<"billingAdjustments">,
) {
  const dispatched = (await ctx.db.query("billingRunItems").collect()).filter(
    (item) => item.status === "dispatched",
  );
  return dispatched.some((item) =>
    item.dispatchedSourceAdjustments?.some(
      (adjustment) => adjustment.adjustmentId === adjustmentId,
    ),
  );
}

async function getRecurringStudentAdjustments(
  ctx: BillingCtx,
  periodStart: string,
  periodEnd: string,
) {
  return (await ctx.db.query("billingAdjustments").collect()).filter(
    (adjustment) =>
      isRecurringStudentAdjustment(adjustment.scopeType) &&
      billingPeriodsOverlap(
        adjustment.periodStart,
        adjustment.periodEnd,
        periodStart,
        periodEnd,
      ),
  );
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
  ctx: BillingCtx,
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

async function getHouseholdResolutionData(ctx: BillingCtx) {
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
        const student = await ctx.db.get(total.studentId as Id<"students">);
        if (!student) return null;
        const contacts = await ctx.db
          .query("studentContacts")
          .withIndex("byStudent", (q) => q.eq("student", student._id))
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
            : primaryContact?.name || primaryContact?.inviteEmail || "Not set",
        };
      }),
    ).then((rows) => rows.filter((row) => row !== null));
  },
});

async function getPeriodTuitionReview(
  ctx: BillingCtx,
  periodStart: string,
  periodEnd: string,
) {
  validateIsoDate(periodStart, "periodStart");
  validateIsoDate(periodEnd, "periodEnd");
  if (periodEnd < periodStart) {
    throw new Error("periodEnd must be on or after periodStart.");
  }

  const inputs = await getWeeklyClassHoursInputs(ctx);
    const exclusions = collectBillingEnrollmentExclusions(inputs);
    const excludedEnrollments = await Promise.all(
      exclusions.map(async (exclusion) => {
        const student = await ctx.db.get(exclusion.studentId as Id<"students">);
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
    const recurringAdjustments = await getRecurringStudentAdjustments(
      ctx,
      periodStart,
      periodEnd,
    );
    const tuitionRows = rows
      .filter((row) => row !== null)
      .map((row) => {
        const rawBaseTuitionCents = row.baseTuitionCents;
        const applied = applyTargetedBillingAdjustments(
          rawBaseTuitionCents || 0,
          selectBillingAdjustments(
            recurringAdjustments.map(billingAdjustmentLike),
            "student_tuition",
            row.studentId,
            periodStart,
            periodEnd,
          ),
        );
        return {
          ...row,
          rawBaseTuitionCents,
          baseTuitionCents:
            rawBaseTuitionCents === undefined
              ? undefined
              : applied.totalCents,
          studentBillingAdjustments: applied.adjustments,
        };
      });
    const householdTuitions = aggregateHouseholdTuitions(
      tuitionRows,
      activeSchema.siblingDiscount || disabledSiblingDiscount,
    );
    const storedAdjustments = await ctx.db
      .query("billingAdjustments")
      .withIndex("byPeriodScope", (q) =>
        q
          .eq("periodStart", periodStart)
          .eq("periodEnd", periodEnd)
          .eq("scopeType", "household_tuition"),
      )
      .collect();
    const adjustmentsByScope = new Map<string, typeof storedAdjustments>();
    for (const adjustment of storedAdjustments) {
      const rowsForScope = adjustmentsByScope.get(adjustment.scopeId) || [];
      rowsForScope.push(adjustment);
      adjustmentsByScope.set(adjustment.scopeId, rowsForScope);
    }
    const households = householdTuitions.map((household) => {
      const billingAdjustments = (
        adjustmentsByScope.get(household.householdId) || []
      ).sort(
        (left, right) =>
          left.createdAt - right.createdAt || left._id.localeCompare(right._id),
      );
      const applied = applyBillingAdjustments(
        household.totalTuitionCents,
        billingAdjustments.map((adjustment) => ({
          id: adjustment._id,
          scopeType: adjustment.scopeType,
          scopeId: adjustment.scopeId,
          periodStart: adjustment.periodStart,
          periodEnd: adjustment.periodEnd,
          kind: adjustment.kind,
          calculationType: adjustment.calculationType,
          amount: adjustment.amount,
          reasonCode: adjustment.reasonCode,
          note: adjustment.note,
          status: adjustment.status,
          createdAt: adjustment.createdAt,
        })),
      );
      const appliedById = new Map(
        applied.adjustments.map((adjustment) => [adjustment.id, adjustment]),
      );
      return {
        ...household,
        totalBeforeManualAdjustmentsCents: household.totalTuitionCents,
        billingAdjustments: billingAdjustments.map((adjustment) => ({
          ...adjustment,
          appliedAmountCents: appliedById.get(adjustment._id)?.amountCents,
          percentageBaseCents: appliedById.get(adjustment._id)
            ?.percentageBaseCents,
        })),
        totalTuitionCents: applied.totalCents,
      };
    });

  return {
    pricingSchema: {
      _id: activeSchema._id,
      name: activeSchema.name,
      version: activeSchema.version,
    },
    siblingDiscount:
      activeSchema.siblingDiscount || disabledSiblingDiscount,
    rows: tuitionRows,
    households,
    excludedEnrollments,
  };
}

export const adminPeriodTuitionReview = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, { periodStart, periodEnd }) => {
    await requireAdmin(ctx);
    return await getPeriodTuitionReview(ctx, periodStart, periodEnd);
  },
});

export const currentHouseholdTuitionPlan = query({
  args: {
    month: v.optional(v.string()),
  },
  handler: async (ctx, { month }) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        status: "unauthenticated" as const,
        availableMonths: [],
        connectedPrivates: [],
      };
    }
    const membership = (
      await ctx.db
        .query("householdMembers")
        .withIndex("byUser", (q) => q.eq("userId", user._id))
        .collect()
    ).sort(
      (left, right) =>
        left._creationTime - right._creationTime ||
        left.householdId.localeCompare(right.householdId),
    )[0];
    if (!membership) {
      return {
        status: "missing_household" as const,
        availableMonths: [],
        connectedPrivates: [],
      };
    }
    const household = await ctx.db.get(membership.householdId);
    if (!household) {
      return {
        status: "missing_household" as const,
        availableMonths: [],
        connectedPrivates: [],
      };
    }

    const householdData = await getHouseholdResolutionData(ctx);
    const students = (await ctx.db.query("students").collect()).filter(
      (student) =>
        resolveStudentHousehold(student._id, householdData).householdId ===
        household._id,
    );
    const studentIds = new Set(students.map((student) => student._id));
    const tuitionInputs = (await getWeeklyClassHoursInputs(ctx)).filter(
      (input) =>
        studentIds.has(input.studentId as Id<"students">) &&
        (input.enrollmentStatus === "enrolled" ||
          input.enrollmentStatus === "dropped") &&
        input.classEnrollmentMode === "standard",
    );
    const currentMonth = todayValue("America/New_York").slice(0, 7);
    const availableMonths = availableTuitionMonths(
      tuitionInputs.map((input) => ({
        enrollmentStartDate: input.enrollmentStartDate,
        enrollmentEndDate: input.enrollmentEndDate,
        classStartDate: input.classStartDate,
        classEndDate: input.classEndDate,
      })),
      currentMonth,
    );
    const selectedMonth = resolveTuitionPlanMonth({
      availableMonths,
      requestedMonth: month,
      currentMonth,
    });

    const privateSeries = (await ctx.db.query("privates").collect())
      .filter(
        (series) =>
          series.isActive &&
          isPrivateConnectedToHousehold(
            series.studentIds || [],
            studentIds,
          ),
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left._id.localeCompare(right._id),
      );
    const connectedPrivates = await Promise.all(
      privateSeries.map(async (series) => {
        const connectedStudents = (series.studentIds || [])
          .filter((studentId) => studentIds.has(studentId))
          .map((studentId) =>
            students.find((student) => student._id === studentId),
          )
          .filter((student) => student !== undefined);
        const participantCount = (series.studentIds || []).length;
        const rate =
          participantCount >= 1 && participantCount <= 3
            ? await getActivePrivateRate(ctx, participantCount)
            : undefined;
        const instructor = await ctx.db.get(series.instructorId);
        return {
          privateId: series._id,
          name: series.name,
          instructorName: instructor ? accountName(instructor) : "Not assigned",
          studentNames: connectedStudents.map(
            (student) => `${student.firstName} ${student.lastName}`,
          ),
          durationMinutes: series.defaultDurationMinutes,
          typicalSessionCostCents: rate
            ? calculatePrivateChargeCents(
                rate.hourlyPriceCents,
                series.defaultDurationMinutes,
              )
            : undefined,
          pricingLabel:
            participantCount >= 1 && participantCount <= 3
              ? privateRateName(participantCount)
              : undefined,
        };
      }),
    );

    if (!selectedMonth) {
      return {
        status: "ready" as const,
        householdName: household.name,
        availableMonths,
        selectedMonth: undefined,
        previousMonth: undefined,
        nextMonth: undefined,
        breakdown: undefined,
        connectedPrivates,
      };
    }

    const { periodStart, periodEnd } = billingMonthPeriod(selectedMonth);
    const review = await getPeriodTuitionReview(
      ctx,
      periodStart,
      periodEnd,
    );
    const householdTuition = selectHouseholdTuitionBreakdown(
      review.households,
      household._id,
    );
    const navigation = tuitionMonthNavigation(
      availableMonths,
      selectedMonth,
    );

    return {
      status: "ready" as const,
      householdName: household.name,
      availableMonths,
      selectedMonth,
      ...navigation,
      breakdown: householdTuition
        ? {
            periodStart,
            periodEnd,
            totalTuitionCents: householdTuition.totalTuitionCents,
            subtotalBeforeSiblingDiscountsCents:
              householdTuition.subtotalBaseTuitionCents,
            totalBeforeManualAdjustmentsCents:
              householdTuition.totalBeforeManualAdjustmentsCents,
            hasIncompleteTuition: householdTuition.hasIncompleteTuition,
            students: householdTuition.students.map((student) => ({
              studentId: student.studentId,
              studentName: student.studentName,
              rawBaseTuitionCents: student.rawBaseTuitionCents,
              adjustedTuitionCents: student.baseTuitionCents,
              isProrated: student.isProrated,
              segments: student.segments.map((segment) => ({
                weeklyMinutes: segment.weeklyMinutes,
                days: segment.days,
                monthlyAmountCents: segment.monthlyAmountCents,
              })),
              adjustments: student.studentBillingAdjustments.map(
                (adjustment) => ({
                  id: adjustment.id,
                  kind: adjustment.kind,
                  calculationType: adjustment.calculationType,
                  configuredAmount: adjustment.amount,
                  amountCents: adjustment.amountCents,
                  reasonCode: adjustment.reasonCode,
                  note: adjustment.note,
                  applicable: adjustment.applicable,
                }),
              ),
            })),
            siblingAdjustments: householdTuition.adjustments,
            householdAdjustments: householdTuition.billingAdjustments.map(
              (adjustment) => ({
                id: adjustment._id,
                kind: adjustment.kind,
                calculationType: adjustment.calculationType,
                configuredAmount: adjustment.amount,
                amountCents: adjustment.appliedAmountCents || 0,
                reasonCode: adjustment.reasonCode,
                note: adjustment.note,
              }),
            ),
          }
        : undefined,
      connectedPrivates,
    };
  },
});

export const adminCreateBillingAdjustment = mutation({
  args: {
    scopeType: billingAdjustmentScopeTypeValidator,
    scopeId: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    kind: billingAdjustmentKindValidator,
    calculationType: billingAdjustmentCalculationTypeValidator,
    amount: v.number(),
    reasonCode: billingAdjustmentReasonCodeValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const input = storedBillingAdjustmentInput(args);
    validateBillingAdjustmentInput(input);
    await assertRunAdjustmentScopeEditable(ctx, input);
    await assertBillingAdjustmentTargetExists(ctx, input);
    const now = Date.now();
    const adjustmentId = await ctx.db.insert("billingAdjustments", {
      ...input,
      status: "active",
      createdBy: actor._id,
      updatedBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await recordActivityEvent(
      ctx,
      buildBillingAdjustmentActivityEvent({
        adjustmentId,
        actorId: actor._id,
        action: "created",
        metadata: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          kind: input.kind,
          calculationType: input.calculationType,
          amount: input.amount,
          reasonCode: input.reasonCode,
        },
      }),
    );
    return adjustmentId;
  },
});

export const adminUpdateBillingAdjustment = mutation({
  args: {
    billingAdjustmentId: v.id("billingAdjustments"),
    kind: billingAdjustmentKindValidator,
    calculationType: billingAdjustmentCalculationTypeValidator,
    amount: v.number(),
    reasonCode: billingAdjustmentReasonCodeValidator,
    note: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { billingAdjustmentId, kind, calculationType, amount, reasonCode, note },
  ) => {
    const actor = await requireAdmin(ctx);
    const adjustment = await ctx.db.get(billingAdjustmentId);
    if (!adjustment) {
      throw new Error("Billing adjustment not found.");
    }
    assertBillingAdjustmentFinanciallyEditable({
      status: adjustment.status,
      hasDispatchedUsage: await hasDispatchedAdjustmentUsage(
        ctx,
        adjustment._id,
      ),
    });
    await assertRunAdjustmentScopeEditable(ctx, adjustment);
    const input = storedBillingAdjustmentInput({
      scopeType: adjustment.scopeType,
      scopeId: adjustment.scopeId,
      periodStart: adjustment.periodStart,
      periodEnd: adjustment.periodEnd,
      kind,
      calculationType,
      amount,
      reasonCode,
      note,
    });
    validateBillingAdjustmentInput(input);
    await assertBillingAdjustmentTargetExists(ctx, input);
    const previous = {
      kind: adjustment.kind,
      calculationType: adjustment.calculationType,
      amount: adjustment.amount,
      reasonCode: adjustment.reasonCode,
      note: adjustment.note || null,
    };
    await ctx.db.patch(billingAdjustmentId, {
      kind: input.kind,
      calculationType: input.calculationType,
      amount: input.amount,
      reasonCode: input.reasonCode,
      note: input.note,
      updatedBy: actor._id,
      updatedAt: Date.now(),
    });
    await recordActivityEvent(
      ctx,
      buildBillingAdjustmentActivityEvent({
        adjustmentId: billingAdjustmentId,
        actorId: actor._id,
        action: "updated",
        metadata: {
          scopeType: adjustment.scopeType,
          scopeId: adjustment.scopeId,
          periodStart: adjustment.periodStart,
          periodEnd: adjustment.periodEnd,
          previous,
          next: {
            kind: input.kind,
            calculationType: input.calculationType,
            amount: input.amount,
            reasonCode: input.reasonCode,
            note: input.note || null,
          },
        },
      }),
    );
  },
});

export const adminVoidBillingAdjustment = mutation({
  args: { billingAdjustmentId: v.id("billingAdjustments") },
  handler: async (ctx, { billingAdjustmentId }) => {
    const actor = await requireAdmin(ctx);
    const adjustment = await ctx.db.get(billingAdjustmentId);
    if (!adjustment) {
      throw new Error("Billing adjustment not found.");
    }
    if (adjustment.status === "voided") {
      throw new Error("Billing adjustment is already voided.");
    }
    await assertRunAdjustmentScopeEditable(ctx, adjustment);
    const now = Date.now();
    await ctx.db.patch(billingAdjustmentId, {
      status: "voided",
      voidedBy: actor._id,
      voidedAt: now,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await recordActivityEvent(
      ctx,
      buildBillingAdjustmentActivityEvent({
        adjustmentId: billingAdjustmentId,
        actorId: actor._id,
        action: "voided",
        metadata: {
          scopeType: adjustment.scopeType,
          scopeId: adjustment.scopeId,
          periodStart: adjustment.periodStart,
          periodEnd: adjustment.periodEnd,
          kind: adjustment.kind,
          calculationType: adjustment.calculationType,
          amount: adjustment.amount,
          reasonCode: adjustment.reasonCode,
        },
      }),
    );
  },
});

export const adminListBillingAdjustments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [adjustments, students, items] = await Promise.all([
      ctx.db.query("billingAdjustments").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("billingRunItems").collect(),
    ]);
    const studentById = new Map(
      students.map((student) => [student._id, student]),
    );

    const rows = await Promise.all(
      adjustments
        .sort(
          (left, right) =>
            right.createdAt - left.createdAt ||
            left._id.localeCompare(right._id),
        )
        .map(async (adjustment) => {
          const history = [];
          if (isRecurringStudentAdjustment(adjustment.scopeType)) {
            for (const item of items) {
              if (
                !billingPeriodsOverlap(
                  adjustment.periodStart,
                  adjustment.periodEnd,
                  item.periodStart,
                  item.periodEnd,
                )
              ) {
                continue;
              }
              const sourceComponentsResolution =
                item.status === "draft"
                  ? await resolveBillingRunItemSourceComponents(ctx, item)
                  : null;
              const resolved =
                item.status === "dispatched"
                  ? item.dispatchedSourceAdjustments || []
                  : sourceComponentsResolution?.status === "ready"
                    ? resolveBillingRunSourceAdjustments({
                        periodStart: item.periodStart,
                        periodEnd: item.periodEnd,
                        components: sourceComponentsResolution.components,
                        adjustments: [billingAdjustmentLike(adjustment)],
                      }).sourceAdjustments
                    : [];
              const applied = resolved.find(
                (candidate) =>
                  candidate.adjustmentId === adjustment._id,
              );
              if (applied) {
                history.push({
                  billingRunItemId: item._id,
                  householdName: item.householdName,
                  periodStart: item.periodStart,
                  periodEnd: item.periodEnd,
                  runStatus: item.status,
                  applicable: applied.applicable,
                  amountCents: applied.amountCents,
                });
              }
            }
          }
          const studentId = isRecurringStudentAdjustment(
            adjustment.scopeType,
          )
            ? ctx.db.normalizeId("students", adjustment.scopeId)
            : null;
          const student = studentId ? studentById.get(studentId) : null;
          const hasDispatchedUsage = history.some(
            (entry) => entry.runStatus === "dispatched",
          );
          return {
            ...adjustment,
            targetName: student
              ? `${student.firstName} ${student.lastName}`
              : adjustment.scopeId,
            history: history.sort(
              (left, right) =>
                right.periodStart.localeCompare(left.periodStart) ||
                left.billingRunItemId.localeCompare(
                  right.billingRunItemId,
                ),
            ),
            hasDispatchedUsage,
            canEdit:
              adjustment.status === "active" && !hasDispatchedUsage,
          };
        }),
    );

    return {
      adjustments: rows,
      students: students
        .filter((student) => student.status === "active")
        .sort(
          (left, right) =>
            `${left.firstName} ${left.lastName}`.localeCompare(
              `${right.firstName} ${right.lastName}`,
            ) || left._id.localeCompare(right._id),
        )
        .map((student) => ({
          _id: student._id,
          name:
            student.preferredName ||
            `${student.firstName} ${student.lastName}`,
        })),
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
            classMode: resolvedClassEnrollmentMode(classItem.enrollmentMode),
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

    return calculatePerSessionChargeCandidates(rows, periodStart, periodEnd);
  },
});

async function getPeriodChargesReview(
  ctx: BillingCtx,
  {
    periodStart,
    periodEnd,
    startsAtOrAfter,
    startsBefore,
  }: {
    periodStart: string;
    periodEnd: string;
    startsAtOrAfter: number;
    startsBefore: number;
  },
) {
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
            classMode: resolvedClassEnrollmentMode(classItem.enrollmentMode),
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
      candidates.map((row) => [`${row.studentId}:${row.classId}`, row]),
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
}

export const adminPeriodChargesReview = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    startsAtOrAfter: v.number(),
    startsBefore: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await getPeriodChargesReview(ctx, args);
  },
});

function billingAdjustmentLike(
  adjustment: Doc<"billingAdjustments">,
) {
  return {
    id: adjustment._id,
    scopeType: adjustment.scopeType,
    scopeId: adjustment.scopeId,
    periodStart: adjustment.periodStart,
    periodEnd: adjustment.periodEnd,
    kind: adjustment.kind,
    calculationType: adjustment.calculationType,
    amount: adjustment.amount,
    reasonCode: adjustment.reasonCode,
    note: adjustment.note,
    status: adjustment.status,
    createdAt: adjustment.createdAt,
  };
}

async function getBillingRunItemAdjustments(
  ctx: BillingCtx,
  item: {
    _id: Id<"billingRunItems">;
    periodStart: string;
    periodEnd: string;
  },
) {
  return await ctx.db
    .query("billingAdjustments")
    .withIndex("byScopePeriod", (q) =>
      q
        .eq("scopeType", "billing_run_item")
        .eq("scopeId", item._id)
        .eq("periodStart", item.periodStart)
        .eq("periodEnd", item.periodEnd),
    )
    .collect();
}

function sourceModeIncludes(
  sourceMode: BillingRunSourceMode,
  source: "tuition" | "charges",
) {
  return sourceMode === "both" || sourceMode === source;
}

export const adminGenerateBillingRun = mutation({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    startsAtOrAfter: v.number(),
    startsBefore: v.number(),
    sourceMode: billingRunSourceModeValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    validateIsoDate(args.periodStart, "periodStart");
    validateIsoDate(args.periodEnd, "periodEnd");
    if (args.periodEnd < args.periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }
    if (args.startsBefore <= args.startsAtOrAfter) {
      throw new Error("Billing range end must be after its start.");
    }

    const periodRuns = await ctx.db
      .query("billingRuns")
      .withIndex("byPeriodMode", (q) =>
        q
          .eq("periodStart", args.periodStart)
          .eq("periodEnd", args.periodEnd),
      )
      .collect();
    const exactRuns = periodRuns
      .filter((run) => run.sourceMode === args.sourceMode)
      .sort(
        (left, right) =>
          Number(right.status === "draft") -
            Number(left.status === "draft") ||
          right.createdAt - left.createdAt,
      );
    const generation = resolveBillingRunGeneration(exactRuns);
    if (generation.action !== "create") {
      const items = await ctx.db
        .query("billingRunItems")
        .withIndex("byRun", (q) => q.eq("billingRunId", generation.run._id))
        .collect();
      return {
        outcome: generation.action,
        billingRunId: generation.run._id,
        itemCount: items.length,
      };
    }
    const overlappingRun = periodRuns.find((run) =>
      billingRunSourcesOverlap(run.sourceMode, args.sourceMode),
    );
    if (overlappingRun) {
      throw new Error(
        `This period already has a ${overlappingRun.sourceMode} run that overlaps the requested sources.`,
      );
    }

    const [tuitionReview, chargesReview] = await Promise.all([
      sourceModeIncludes(args.sourceMode, "tuition")
        ? getPeriodTuitionReview(ctx, args.periodStart, args.periodEnd)
        : null,
      sourceModeIncludes(args.sourceMode, "charges")
        ? getPeriodChargesReview(ctx, args)
        : null,
    ]);
    const tuitionHouseholds =
      tuitionReview?.households.map((household) => ({
        householdId: household.householdId,
        householdName: household.householdName,
        householdLinkSource: household.householdLinkSource,
        totalTuitionCents: household.totalTuitionCents,
        studentCount: household.students.length,
        hasIncompleteTuition: household.hasIncompleteTuition,
        students: household.students.map((student) => ({
          studentId: student.studentId,
          studentName: student.studentName,
          baseTuitionCents: student.rawBaseTuitionCents,
        })),
        siblingDiscount: tuitionReview.siblingDiscount,
        householdTuitionAdjustmentTotalCents:
          household.billingAdjustments
            .filter((adjustment) => adjustment.status === "active")
            .reduce(
              (total, adjustment) =>
                total + (adjustment.appliedAmountCents || 0),
              0,
            ),
      })) || [];
    const privateChargeSources =
      chargesReview?.privateCharges.map((charge) => ({
        householdId:
          charge.household.householdId || `student:${charge.student._id}`,
        householdName:
          charge.household.householdName ||
          `${charge.student.firstName} ${charge.student.lastName} (unlinked)`,
        householdLinkSource:
          charge.household.householdLinkSource || "student_fallback",
        sourceType: "private" as const,
        sourceId: charge.participation._id,
        amountCents: charge.pricing.amountCents,
        studentId: charge.student._id,
        studentName: `${charge.student.firstName} ${charge.student.lastName}`,
      })) || [];
    const perSessionChargeSources =
      chargesReview?.perSessionCharges.map((charge) => ({
        householdId:
          charge.household.householdId || `student:${charge.student._id}`,
        householdName:
          charge.household.householdName ||
          `${charge.student.firstName} ${charge.student.lastName} (unlinked)`,
        householdLinkSource:
          charge.household.householdLinkSource || "student_fallback",
        sourceType: "per_session" as const,
        sourceId: `${charge.studentId}:${charge.classId}`,
        amountCents: charge.aggregateAmountCents,
        studentId: charge.studentId,
        studentName: `${charge.student.firstName} ${charge.student.lastName}`,
      })) || [];
    const bundles = buildBillingRunBundles({
      sourceMode: args.sourceMode,
      tuitionHouseholds,
      charges: [...privateChargeSources, ...perSessionChargeSources],
    });
    if (bundles.length === 0) {
      return {
        outcome: "empty" as const,
        itemCount: 0,
      };
    }

    const now = Date.now();
    const recurringAdjustments = (
      await getRecurringStudentAdjustments(
        ctx,
        args.periodStart,
        args.periodEnd,
      )
    ).map(billingAdjustmentLike);
    const billingRunId = await ctx.db.insert("billingRuns", {
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      sourceMode: args.sourceMode,
      status: "draft",
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    for (const bundle of bundles) {
      const resolvedSources = resolveBillingRunSourceAdjustments({
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        components: bundle.sourceComponents,
        adjustments: recurringAdjustments,
      });
      await ctx.db.insert("billingRunItems", {
        billingRunId,
        ...buildBillingRunItemSnapshot(
          bundle,
          args.periodStart,
          args.periodEnd,
        ),
        tuitionSubtotalCents: resolvedSources.tuitionSubtotalCents,
        chargesSubtotalCents: resolvedSources.chargesSubtotalCents,
        subtotalBeforeRunAdjustmentsCents:
          resolvedSources.subtotalAfterSourceAdjustmentsCents,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
    }
    await recordActivityEvent(ctx, {
      entityType: "billing_run",
      entityId: billingRunId,
      actorId: actor._id,
      eventType: "billing_run_generated",
      summary: `Generated a ${args.sourceMode} billing run for ${args.periodStart} through ${args.periodEnd}.`,
      metadata: {
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        sourceMode: args.sourceMode,
        itemCount: bundles.length,
      },
    });
    return {
      outcome: "created" as const,
      billingRunId,
      itemCount: bundles.length,
    };
  },
});

export const adminListBillingRuns = query({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    includeDispatched: v.optional(v.boolean()),
  },
  handler: async (ctx, { periodStart, periodEnd, includeDispatched }) => {
    await requireAdmin(ctx);
    validateIsoDate(periodStart, "periodStart");
    validateIsoDate(periodEnd, "periodEnd");
    if (periodEnd < periodStart) {
      throw new Error("periodEnd must be on or after periodStart.");
    }
    const runs = (
      await ctx.db
        .query("billingRuns")
        .withIndex("byPeriodMode", (q) =>
          q.eq("periodStart", periodStart).eq("periodEnd", periodEnd),
        )
        .collect()
    ).sort(
      (left, right) =>
        right.createdAt - left.createdAt || left._id.localeCompare(right._id),
    );

    return await Promise.all(
      runs.map(async (run) => {
        const recurringAdjustments = (
          await getRecurringStudentAdjustments(
            ctx,
            run.periodStart,
            run.periodEnd,
          )
        ).map(billingAdjustmentLike);
        const items = (
          await ctx.db
            .query("billingRunItems")
            .withIndex("byRun", (q) => q.eq("billingRunId", run._id))
            .collect()
        )
          .filter(
            (item) => includeDispatched || item.status !== "dispatched",
          )
          .sort(
            (left, right) =>
              left.householdName.localeCompare(right.householdName) ||
              left.householdId.localeCompare(right.householdId),
          );
        const resolvedItems = await Promise.all(
          items.map(async (item) => {
            const adjustments = (
              await getBillingRunItemAdjustments(ctx, item)
            ).sort(
              (left, right) =>
                left.createdAt - right.createdAt ||
                left._id.localeCompare(right._id),
            );
            const sourceComponentsResolution =
              item.status === "draft" && recurringAdjustments.length > 0
                ? await resolveBillingRunItemSourceComponents(ctx, item)
                : null;
            const sourceResolution =
              item.status === "dispatched"
                ? {
                    tuitionSubtotalCents:
                      item.dispatchedTuitionSubtotalCents ??
                      item.tuitionSubtotalCents,
                    chargesSubtotalCents:
                      item.dispatchedChargesSubtotalCents ??
                      item.chargesSubtotalCents,
                    sourceAdjustments:
                      item.dispatchedSourceAdjustments || [],
                    subtotalAfterSourceAdjustmentsCents:
                      (item.dispatchedTuitionSubtotalCents ??
                        item.tuitionSubtotalCents) +
                      (item.dispatchedChargesSubtotalCents ??
                        item.chargesSubtotalCents) +
                      (item.dispatchedSourceAdjustments || []).reduce(
                        (total, adjustment) =>
                          total + adjustment.amountCents,
                        0,
                      ),
                  }
                : sourceComponentsResolution?.status === "ready"
                  ? resolveBillingRunSourceAdjustments({
                      periodStart: item.periodStart,
                      periodEnd: item.periodEnd,
                      components: sourceComponentsResolution.components,
                      adjustments: recurringAdjustments,
                    })
                  : null;
            const calculated = calculateBillingRunItemTotal(
              sourceResolution?.subtotalAfterSourceAdjustmentsCents ??
                item.subtotalBeforeRunAdjustmentsCents,
              adjustments.map(billingAdjustmentLike),
            );
            const appliedById = new Map(
              calculated.adjustments.map((adjustment) => [
                adjustment.id,
                adjustment,
              ]),
            );
            return {
              ...item,
              tuitionSubtotalCents:
                sourceResolution?.tuitionSubtotalCents ??
                item.tuitionSubtotalCents,
              chargesSubtotalCents:
                sourceResolution?.chargesSubtotalCents ??
                item.chargesSubtotalCents,
              sourceAdjustments:
                sourceResolution?.sourceAdjustments || [],
              requiresAdminReview:
                sourceComponentsResolution?.status === "requires_review",
              adminReviewReason:
                sourceComponentsResolution?.status === "requires_review"
                  ? sourceComponentsResolution.reason
                  : undefined,
              adjustments: adjustments.map((adjustment) => ({
                ...adjustment,
                appliedAmountCents: appliedById.get(adjustment._id)
                  ?.amountCents,
              })),
              adjustmentTotalCents:
                item.dispatchedAdjustmentTotalCents ??
                ((sourceResolution?.sourceAdjustments || []).reduce(
                  (total, adjustment) =>
                    total + adjustment.amountCents,
                  0,
                ) +
                  calculated.adjustmentTotalCents),
              finalTotalCents:
                item.dispatchedFinalTotalCents ?? calculated.totalCents,
            };
          }),
        );
        return {
          ...run,
          items: resolvedItems,
          pendingItemCount: resolvedItems.filter(
            (item) => item.status !== "dispatched",
          ).length,
          totalCents: resolvedItems.reduce(
            (total, item) => total + item.finalTotalCents,
            0,
          ),
        };
      }),
    ).then((rows) => rows.filter((run) => run.items.length > 0));
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
    if (!household) return null;
    const payer = await ctx.db
      .query("householdPayers")
      .withIndex("byHouseholdUser", (q) =>
        q
          .eq("householdId", household._id)
          .eq("userId", userId),
      )
      .first();
    return { membership, household, payer };
  },
});

export const adminSetHouseholdPayerAutopay = mutation({
  args: {
    householdPayerId: v.id("householdPayers"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { householdPayerId, enabled }) => {
    await requireAdmin(ctx);
    const payer = await ctx.db.get(householdPayerId);
    if (!payer) {
      throw new Error("Household payer not found.");
    }
    if (!payer.active || !payer.isPrimary) {
      throw new Error(
        "Autopay can only be configured for the active primary payer.",
      );
    }
    await ctx.db.patch(householdPayerId, {
      autopayEnabled: enabled,
      updatedAt: Date.now(),
    });
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
      siblingDiscount: source.siblingDiscount || disabledSiblingDiscount,
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
