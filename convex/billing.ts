import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  calculateWeeklyClassMinuteSegments,
  calculateWeeklyClassMinutes,
  type WeeklyClassHoursInput,
} from "./lib/billing/weeklyClassHours";
import { hasUserRole } from "./lib/roles";
import { getCurrentUserOrThrow } from "./users";
import {
  nextPricingSchemaVersion,
  type NormalizedTuitionTier,
  validateNormalizedTuitionTiers,
} from "../shared/tuition-pricing";

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
): Promise<WeeklyClassHoursInput[]> {
  const enrollments = await ctx.db.query("classEnrollments").collect();
  const classes = new Map(
    (await ctx.db.query("classes").collect()).map((classItem) => [
      classItem._id,
      classItem,
    ]),
  );

  return enrollments.flatMap((enrollment) => {
    const classItem = classes.get(enrollment.classId);
    if (!classItem) return [];
    return [
      {
        studentId: enrollment.student,
        enrollmentStatus: enrollment.status,
        enrollmentStartDate: enrollment.startDate,
        enrollmentEndDate: enrollment.endDate,
        classStatus: classItem.status,
        classStartDate: classItem.startDate,
        classEndDate: classItem.endDate,
        startTime: classItem.startTime,
        endTime: classItem.endTime,
        weekdays: classItem.weekdays,
      },
    ];
  });
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
      createdAt: now,
      updatedAt: now,
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
