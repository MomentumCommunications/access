import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { reserveAccountHelpAttempts } from "../shared/account-help";

export const reserveAccountHelpSend = internalMutation({
  args: { emailHash: v.string() },
  handler: async (ctx, { emailHash }) => {
    const emailKey = `email:${emailHash}`;
    const [email, global] = await Promise.all(
      [emailKey, "global"].map((key) =>
        ctx.db
          .query("accountHelpThrottles")
          .withIndex("byKey", (q) => q.eq("key", key))
          .unique(),
      ),
    );
    let attempts;
    try {
      attempts = reserveAccountHelpAttempts(
        email?.attempts ?? [],
        global?.attempts ?? [],
        Date.now(),
      );
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Please try again later.",
      );
    }
    for (const [record, key, values] of [
      [email, emailKey, attempts.email],
      [global, "global", attempts.global],
    ] as const) {
      if (record) await ctx.db.patch(record._id, { attempts: values });
      else
        await ctx.db.insert("accountHelpThrottles", { key, attempts: values });
    }
  },
});
