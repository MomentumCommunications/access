import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  billingRunItemHasTuitionCoverage,
  resolveBillingRunAuditAttribution,
} from "../../../shared/billing-audit";

export async function ensureBillingRunAuditRecord(
  ctx: MutationCtx,
  {
    item,
    stripeInvoiceId,
    invoiceTotalCents,
    tuitionAmountCents,
    recordedBy,
    recordedAt,
  }: {
    item: Doc<"billingRunItems">;
    stripeInvoiceId: string;
    invoiceTotalCents: number;
    tuitionAmountCents: number;
    recordedBy: Id<"users">;
    recordedAt: number;
  },
) {
  if (!billingRunItemHasTuitionCoverage(item)) {
    return { outcome: "not_tuition" as const };
  }
  const existing = await ctx.db
    .query("billingAuditRecords")
    .withIndex("byBillingRunItem", (q) =>
      q.eq("billingRunItemId", item._id),
    )
    .first();
  if (existing) return { outcome: "existing" as const, recordId: existing._id };
  const invoiceRecord = await ctx.db
    .query("billingAuditRecords")
    .withIndex("byStripeInvoice", (q) =>
      q.eq("stripeInvoiceId", stripeInvoiceId),
    )
    .first();
  if (invoiceRecord) {
    return { outcome: "existing" as const, recordId: invoiceRecord._id };
  }

  const {
    enrollmentSnapshots,
    historicalStudentIds,
    attributionQuality,
  } = resolveBillingRunAuditAttribution({
    enrollmentSnapshots: item.tuitionEnrollmentSnapshots,
    tuitionStudentIds: item.sourceComponents?.tuitionStudents.map(
      (student) => student.studentId,
    ),
  });
  const recordId = await ctx.db.insert("billingAuditRecords", {
    householdId: item.householdId,
    householdName: item.householdName,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    source: "billing_run_dispatch",
    status: "active",
    attributionQuality,
    billingRunItemId: item._id,
    stripeInvoiceId,
    invoiceTotalCents,
    tuitionAmountCents,
    enrollmentSnapshots,
    historicalStudentIds,
    recordedBy,
    recordedAt,
  });
  return { outcome: "created" as const, recordId };
}
