import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  defaultHouseholdName,
  planDefaultHouseholdBilling,
  selectDefaultHouseholdConnection,
} from "../../shared/household-payers";

export async function ensureDefaultHouseholdBilling(
  ctx: MutationCtx,
  {
    userId,
    firstName,
    lastName,
  }: {
    userId: Id<"users">;
    firstName: string;
    lastName: string;
  },
) {
  const [memberships, existingUserPayers] = await Promise.all([
    ctx.db
      .query("householdMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("householdPayers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect(),
  ]);
  const validMemberships: {
    id: string;
    householdId: string;
    createdAt: number;
  }[] = [];
  for (const membership of memberships) {
    const household = await ctx.db.get(membership.householdId);
    if (household) {
      validMemberships.push({
        id: membership._id,
        householdId: membership.householdId,
        createdAt: membership._creationTime,
      });
    } else {
      await ctx.db.delete(membership._id);
    }
  }
  const validUserPayers: {
    id: string;
    householdId: string;
    createdAt: number;
  }[] = [];
  for (const payer of existingUserPayers) {
    const household = await ctx.db.get(payer.householdId);
    if (household) {
      validUserPayers.push({
        id: payer._id,
        householdId: payer.householdId,
        createdAt: payer.createdAt,
      });
    } else {
      await ctx.db.delete(payer._id);
    }
  }

  let householdId: Id<"households">;
  const existingConnection = selectDefaultHouseholdConnection({
    validMemberships,
    validUserPayers,
  });
  const membershipPlan = planDefaultHouseholdBilling({
    validMemberships,
    payers: [],
    userId,
  });
  if (membershipPlan.canonicalMembership) {
    householdId =
      membershipPlan.canonicalMembership.householdId as Id<"households">;
    for (const membershipId of membershipPlan.duplicateMembershipIds) {
      await ctx.db.delete(membershipId as Id<"householdMembers">);
    }
  } else if (existingConnection?.source === "payer") {
    householdId = existingConnection.householdId as Id<"households">;
    await ctx.db.insert("householdMembers", {
      householdId,
      userId,
    });
  } else {
    const now = Date.now();
    householdId = await ctx.db.insert("households", {
      name: defaultHouseholdName(firstName, lastName),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("householdMembers", {
      householdId,
      userId,
    });
  }

  const payers = await ctx.db
    .query("householdPayers")
    .withIndex("byHousehold", (q) => q.eq("householdId", householdId))
    .collect();
  const payerPlan = planDefaultHouseholdBilling({
    validMemberships: [
      {
        id: "canonical",
        householdId,
      },
    ],
    payers: payers.map((payer) => ({
      id: payer._id,
      householdId: payer.householdId,
      userId: payer.userId,
      active: payer.active,
      isPrimary: payer.isPrimary,
      createdAt: payer.createdAt,
    })),
    userId,
  });
  const now = Date.now();
  const validUserPayerIds = new Set(
    validUserPayers.map((payer) => payer.id),
  );
  for (const payer of existingUserPayers) {
    if (
      validUserPayerIds.has(payer._id) &&
      payer.householdId !== householdId &&
      (payer.active || payer.isPrimary)
    ) {
      await ctx.db.patch(payer._id, {
        active: false,
        isPrimary: false,
        updatedAt: now,
      });
    }
  }
  for (const payerId of payerPlan.duplicatePayerIds) {
    await ctx.db.delete(payerId as Id<"householdPayers">);
  }
  for (const payerId of payerPlan.payerIdsToDeactivate) {
    await ctx.db.patch(payerId as Id<"householdPayers">, {
      active: false,
      isPrimary: false,
      updatedAt: now,
    });
  }
  if (payerPlan.canonicalPayer) {
    await ctx.db.patch(
      payerPlan.canonicalPayer.id as Id<"householdPayers">,
      {
        active: true,
        isPrimary: true,
        updatedAt: now,
      },
    );
  } else {
    await ctx.db.insert("householdPayers", {
      householdId,
      userId,
      active: true,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return householdId;
}
