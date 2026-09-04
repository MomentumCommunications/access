import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { resolveUserRoles } from "./lib/roles";
import { selectMailchimpClient } from "./lib/mailchimp";

export const getCompletedClient = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return selectMailchimpClient({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      onboardingStatus: user.onboardingStatus,
      roles: resolveUserRoles(user),
    });
  },
});
