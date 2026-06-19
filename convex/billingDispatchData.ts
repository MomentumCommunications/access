import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { hasUserRole } from "./lib/roles";
import { getCurrentUserOrThrow } from "./users";
import { recordActivityEvent } from "./lib/activityLog";
import { calculateBillingRunItemTotal } from "../shared/billing-runs";
import { resolveBillingRunSourceAdjustments } from "../shared/billing-runs";
import {
  billingPeriodsOverlap,
  isRecurringStudentAdjustment,
} from "../shared/billing-adjustments";
import { resolveHouseholdStripeBillingTarget } from "../shared/stripe-invoice-dispatch";
import { resolveBillingRunItemSourceComponents } from "./lib/billing/runSourceComponents";

async function requireAdmin(ctx: Parameters<typeof getCurrentUserOrThrow>[0]) {
  const user = await getCurrentUserOrThrow(ctx);
  if (!hasUserRole(user, "admin")) {
    throw new Error("Admin access required.");
  }
  return user;
}

function adjustmentLike(
  adjustment: {
    _id: string;
    scopeType:
      | "household_tuition"
      | "billing_run_item"
      | "student_tuition"
      | "student_private_charges";
    scopeId: string;
    periodStart: string;
    periodEnd: string;
    kind: "discount" | "surcharge";
    calculationType: "fixed_cents" | "percent";
    amount: number;
    reasonCode:
      | "scholarship"
      | "goodwill"
      | "manual_correction"
      | "waiver"
      | "surcharge"
      | "other";
    note?: string;
    status: "active" | "voided";
    createdAt: number;
  },
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

export const prepareBillingRunItemDispatch = internalQuery({
  args: {
    billingRunId: v.id("billingRuns"),
    billingRunItemId: v.id("billingRunItems"),
  },
  handler: async (ctx, { billingRunId, billingRunItemId }) => {
    const actor = await requireAdmin(ctx);
    const [run, item] = await Promise.all([
      ctx.db.get(billingRunId),
      ctx.db.get(billingRunItemId),
    ]);
    if (!run) throw new Error("Billing run not found.");
    if (!item || item.billingRunId !== billingRunId) {
      throw new Error("Billing run item does not belong to this run.");
    }
    if (item.status === "dispatched") {
      return {
        status: "already_dispatched" as const,
        actorId: actor._id,
        stripeInvoiceId: item.stripeInvoiceId,
      };
    }

    const adjustments = await ctx.db
      .query("billingAdjustments")
      .withIndex("byScopePeriod", (q) =>
        q
          .eq("scopeType", "billing_run_item")
          .eq("scopeId", item._id)
          .eq("periodStart", item.periodStart)
          .eq("periodEnd", item.periodEnd),
      )
      .collect();
    const recurringAdjustments = (
      await ctx.db.query("billingAdjustments").collect()
    ).filter(
      (adjustment) =>
        isRecurringStudentAdjustment(adjustment.scopeType) &&
        billingPeriodsOverlap(
          adjustment.periodStart,
          adjustment.periodEnd,
          item.periodStart,
          item.periodEnd,
        ),
    );
    const sourceComponentsResolution =
      recurringAdjustments.length > 0
        ? await resolveBillingRunItemSourceComponents(ctx, item)
        : null;
    if (sourceComponentsResolution?.status === "requires_review") {
      throw new Error(sourceComponentsResolution.reason);
    }
    const sourceComponents =
      sourceComponentsResolution?.status === "ready"
        ? sourceComponentsResolution.components
        : item.sourceComponents;
    const sourceResolution = sourceComponents
      ? resolveBillingRunSourceAdjustments({
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
          components: sourceComponents,
          adjustments: recurringAdjustments.map(adjustmentLike),
        })
      : {
          tuitionSubtotalCents: item.tuitionSubtotalCents,
          chargesSubtotalCents: item.chargesSubtotalCents,
          sourceAdjustments: [],
          sourceAdjustmentTotalCents: 0,
          subtotalAfterSourceAdjustmentsCents:
            item.subtotalBeforeRunAdjustmentsCents,
        };
    const calculated = calculateBillingRunItemTotal(
      sourceResolution.subtotalAfterSourceAdjustmentsCents,
      adjustments.map(adjustmentLike),
    );

    const householdId = ctx.db.normalizeId("households", item.householdId);
    const household = householdId
      ? await ctx.db.get(householdId)
      : null;
    const payers = householdId
      ? await ctx.db
          .query("householdPayers")
          .withIndex("byHousehold", (q) =>
            q.eq("householdId", householdId),
          )
          .collect()
      : [];
    const users = await Promise.all(
      [...new Set(payers.map((payer) => payer.userId))].map((userId) =>
        ctx.db.get(userId),
      ),
    );
    const target = resolveHouseholdStripeBillingTarget({
      householdId: item.householdId,
      householdExists: household !== null,
      payers: payers.map((payer) => ({
        id: payer._id,
        householdId: payer.householdId,
        userId: payer.userId,
        active: payer.active,
        isPrimary: payer.isPrimary,
        autopayEnabled: payer.autopayEnabled,
        createdAt: payer.createdAt,
      })),
      users: users
        .filter((user) => user !== null)
        .map((user) => ({
          id: user._id,
          stripeCustomerId: user.stripeCustomerId,
        })),
    });

    return {
      status: "ready" as const,
      actorId: actor._id,
      target,
      item: {
        id: item._id,
        billingRunId: item.billingRunId,
        householdId: item.householdId,
        householdName: item.householdName,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        tuitionSubtotalCents: sourceResolution.tuitionSubtotalCents,
        chargesSubtotalCents: sourceResolution.chargesSubtotalCents,
        sourceSummary: {
          tuitionStudentCount: item.sourceSummary.tuitionStudentCount,
          privateChargeCount: item.sourceSummary.privateChargeCount,
          perSessionChargeCount:
            item.sourceSummary.perSessionChargeCount,
        },
        adjustments: [
          ...sourceResolution.sourceAdjustments.map((adjustment) => ({
            id: adjustment.adjustmentId,
            reasonCode: adjustment.reasonCode,
            note: adjustment.note,
            amountCents: adjustment.amountCents,
            scopeType: adjustment.scopeType,
            scopeId: adjustment.scopeId,
            studentName: adjustment.studentName,
          })),
          ...calculated.adjustments.map((adjustment) => ({
            id: adjustment.id,
            reasonCode: adjustment.reasonCode,
            note: adjustment.note,
            amountCents: adjustment.amountCents,
            scopeType: adjustment.scopeType,
            scopeId: adjustment.scopeId,
          })),
        ],
        sourceAdjustments: sourceResolution.sourceAdjustments,
        adjustmentTotalCents:
          sourceResolution.sourceAdjustmentTotalCents +
          calculated.adjustmentTotalCents,
        finalTotalCents: calculated.totalCents,
        existingStripeInvoiceId: item.stripeInvoiceId,
      },
    };
  },
});

export const markBillingRunItemDispatchFailed = internalMutation({
  args: {
    billingRunId: v.id("billingRuns"),
    billingRunItemId: v.id("billingRunItems"),
    reason: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    collectionMethod: v.optional(
      v.union(
        v.literal("charge_automatically"),
        v.literal("send_invoice"),
      ),
    ),
    autopayEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const item = await ctx.db.get(args.billingRunItemId);
    if (!item || item.billingRunId !== args.billingRunId) {
      throw new Error("Billing run item does not belong to this run.");
    }
    if (item.status === "dispatched") return;
    const now = Date.now();
    const reason = args.reason.trim().slice(0, 1000) || "Dispatch failed.";
    await ctx.db.patch(item._id, {
      status: "dispatch_failed",
      stripeInvoiceId: args.stripeInvoiceId || item.stripeInvoiceId,
      stripeCustomerId: args.stripeCustomerId || item.stripeCustomerId,
      collectionMethod: args.collectionMethod || item.collectionMethod,
      autopayEnabledSnapshot:
        args.autopayEnabled ?? item.autopayEnabledSnapshot,
      dispatchFailureReason: reason,
      dispatchFailureAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.billingRunId, {
      status: "draft",
      dispatchedAt: undefined,
      updatedAt: now,
    });
    await recordActivityEvent(ctx, {
      entityType: "billing_run_item",
      entityId: item._id,
      actorId: actor._id,
      eventType: "billing_run_item_dispatch_failed",
      summary: `Stripe draft invoice dispatch failed for ${item.householdName}.`,
      metadata: {
        billingRunId: args.billingRunId,
        householdId: item.householdId,
        reason,
        stripeInvoiceId: args.stripeInvoiceId || item.stripeInvoiceId,
      },
    });
  },
});

export const markBillingRunItemDispatched = internalMutation({
  args: {
    billingRunId: v.id("billingRuns"),
    billingRunItemId: v.id("billingRunItems"),
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.string(),
    collectionMethod: v.union(
      v.literal("charge_automatically"),
      v.literal("send_invoice"),
    ),
    autopayEnabled: v.boolean(),
    adjustmentTotalCents: v.number(),
    finalTotalCents: v.number(),
    tuitionSubtotalCents: v.number(),
    chargesSubtotalCents: v.number(),
    sourceAdjustments: v.array(
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
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const item = await ctx.db.get(args.billingRunItemId);
    if (!item || item.billingRunId !== args.billingRunId) {
      throw new Error("Billing run item does not belong to this run.");
    }
    if (
      item.status === "dispatched" &&
      item.stripeInvoiceId === args.stripeInvoiceId
    ) {
      return;
    }
    const now = Date.now();
    await ctx.db.patch(item._id, {
      status: "dispatched",
      dispatchedBy: actor._id,
      dispatchedAt: now,
      dispatchedAdjustmentTotalCents: args.adjustmentTotalCents,
      dispatchedFinalTotalCents: args.finalTotalCents,
      dispatchedTuitionSubtotalCents: args.tuitionSubtotalCents,
      dispatchedChargesSubtotalCents: args.chargesSubtotalCents,
      dispatchedSourceAdjustments: args.sourceAdjustments,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeCustomerId: args.stripeCustomerId,
      collectionMethod: args.collectionMethod,
      autopayEnabledSnapshot: args.autopayEnabled,
      dispatchFailureReason: undefined,
      dispatchFailureAt: undefined,
      updatedAt: now,
    });
    await recordActivityEvent(ctx, {
      entityType: "billing_run_item",
      entityId: item._id,
      actorId: actor._id,
      eventType: "billing_run_item_dispatched",
      summary: `Created a Stripe draft invoice for ${item.householdName}.`,
      metadata: {
        billingRunId: args.billingRunId,
        householdId: item.householdId,
        stripeInvoiceId: args.stripeInvoiceId,
        stripeCustomerId: args.stripeCustomerId,
        collectionMethod: args.collectionMethod,
        finalTotalCents: args.finalTotalCents,
      },
    });

    const remaining = await ctx.db
      .query("billingRunItems")
      .withIndex("byRun", (q) => q.eq("billingRunId", args.billingRunId))
      .collect();
    const allDispatched = remaining.every(
      (candidate) => candidate._id === item._id || candidate.status === "dispatched",
    );
    await ctx.db.patch(args.billingRunId, {
      status: allDispatched ? "dispatched" : "draft",
      dispatchedAt: allDispatched ? now : undefined,
      updatedAt: now,
    });
  },
});
