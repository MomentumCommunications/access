import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  calculatePrivateChargeCents,
  validatePrivateParticipantCount,
} from "../../../shared/private-pricing";

type DbCtx = QueryCtx | MutationCtx;

export async function getActivePrivateRate(
  ctx: DbCtx,
  participants: number,
) {
  validatePrivateParticipantCount(participants);
  const rates = await ctx.db
    .query("privateRates")
    .withIndex("byParticipantsActive", (q) =>
      q.eq("participants", participants).eq("active", true),
    )
    .collect();
  return rates.sort(
    (left, right) =>
      right.activatedAt - left.activatedAt ||
      right._id.localeCompare(left._id),
  )[0];
}

export async function buildPrivateChargeSnapshot(
  ctx: DbCtx,
  privateSeries: Doc<"privates">,
  lesson: Doc<"privateLessons">,
) {
  const participants = (privateSeries.studentIds || []).length;
  if (participants < 1 || participants > 3) {
    return null;
  }
  const rate = await getActivePrivateRate(ctx, participants);
  if (!rate) return null;
  return {
    appliedPrivateRateId: rate._id,
    appliedPriceCents: calculatePrivateChargeCents(
      rate.hourlyPriceCents,
      lesson.durationMinutes,
    ),
  };
}

export async function snapshotOpenPrivateChargesForRate(
  ctx: MutationCtx,
  rate: Doc<"privateRates">,
) {
  const billableRows = await ctx.db
    .query("privateLessonStudents")
    .withIndex("byBillable", (q) => q.eq("billable", true))
    .collect();

  let snapshotted = 0;
  for (const participation of billableRows) {
    if (
      participation.appliedPrivateRateId !== undefined &&
      participation.appliedPriceCents !== undefined
    ) {
      continue;
    }
    const lesson = await ctx.db.get(participation.privateLessonId);
    if (!lesson || lesson.status !== "completed") continue;
    const privateSeries = await ctx.db.get(lesson.privateId);
    if (
      !privateSeries ||
      (privateSeries.studentIds || []).length !== rate.participants
    ) {
      continue;
    }
    await ctx.db.patch(participation._id, {
      appliedPrivateRateId: rate._id,
      appliedPriceCents: calculatePrivateChargeCents(
        rate.hourlyPriceCents,
        lesson.durationMinutes,
      ),
    });
    snapshotted += 1;
  }

  return snapshotted;
}

export function privateRateName(participants: 1 | 2 | 3) {
  if (participants === 1) return "Solo";
  if (participants === 2) return "Duet";
  return "Trio";
}
