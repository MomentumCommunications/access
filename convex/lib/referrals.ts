import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { verifiedReferralEmail } from "../../shared/referrals";
import { referralConnectedNotification } from "../../shared/notifications";
import { createAdminNotifications } from "./notifications";

export async function connectVerifiedReferral(
  ctx: MutationCtx,
  user: Doc<"users">,
) {
  const email = verifiedReferralEmail(user);
  if (!email) return;
  const existing = await ctx.db
    .query("referrals")
    .withIndex("byReferredUser", (q) => q.eq("referredUserId", user._id))
    .first();
  if (existing) return;
  const referral = await ctx.db
    .query("referrals")
    .withIndex("byInvitedEmail", (q) => q.eq("invitedEmail", email))
    .first();
  if (
    !referral ||
    referral.referredUserId ||
    referral.status !== "invited" ||
    referral.referrerUserId === user._id
  )
    return;
  await ctx.db.patch(referral._id, {
    referredUserId: user._id,
    connectedAt: Date.now(),
    status: "pending_review",
  });
  const referrer = await ctx.db.get(referral.referrerUserId);
  await createAdminNotifications(
    ctx,
    referralConnectedNotification({
      referralId: referral._id,
      userId: user._id,
      email,
      referrerName: referrer?.firstName || referrer?.name || "A client",
    }),
  );
}
