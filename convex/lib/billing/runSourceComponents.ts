import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { BillingRunSourceComponents } from "../../../shared/billing-runs";

type SourceContext = QueryCtx | MutationCtx;

type SourceComponentResolution =
  | {
      status: "ready";
      components: BillingRunSourceComponents;
      derived: boolean;
    }
  | {
      status: "requires_review";
      reason: string;
    };

function normalizePrivateChargeId(value: string) {
  const separatorIndex = value.indexOf(":");
  return (separatorIndex === -1
    ? value
    : value.slice(0, separatorIndex)) as Id<"privateLessonStudents">;
}

export async function resolveBillingRunItemSourceComponents(
  ctx: SourceContext,
  item: Doc<"billingRunItems">,
): Promise<SourceComponentResolution> {
  if (item.sourceComponents) {
    return {
      status: "ready",
      components: item.sourceComponents,
      derived: false,
    };
  }

  if (item.includeTuition) {
    return {
      status: "requires_review",
      reason:
        "This legacy draft includes tuition, but its per-student tuition amounts were not preserved. Regenerate the item before dispatch.",
    };
  }

  if (item.sourceReferences.perSessionChargeIds.length > 0) {
    return {
      status: "requires_review",
      reason:
        "This legacy draft includes per-session charges that cannot be separated safely from private charges. Regenerate the item before dispatch.",
    };
  }

  const privateStudents = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      subtotalCents: number;
    }
  >();

  for (const reference of item.sourceReferences.privateChargeIds) {
    const participation = await ctx.db.get(normalizePrivateChargeId(reference));
    if (!participation || participation.appliedPriceCents === undefined) {
      return {
        status: "requires_review",
        reason:
          "A legacy private-charge source is missing or has no frozen price. Regenerate the item before dispatch.",
      };
    }

    const student = await ctx.db.get(participation.studentId);
    if (!student) {
      return {
        status: "requires_review",
        reason:
          "A student referenced by this legacy draft no longer exists. Review the item before dispatch.",
      };
    }

    const key = participation.studentId;
    const existing = privateStudents.get(key);
    privateStudents.set(key, {
      studentId: participation.studentId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      subtotalCents:
        (existing?.subtotalCents ?? 0) + participation.appliedPriceCents,
    });
  }

  return {
    status: "ready",
    derived: true,
    components: {
      tuitionStudents: [],
      privateStudents: [...privateStudents.values()],
      perSessionChargesCents: 0,
      householdTuitionAdjustmentTotalCents: 0,
    },
  };
}
