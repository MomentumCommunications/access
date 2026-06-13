import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function recordActivityEvent(
  ctx: MutationCtx,
  event: {
    entityType: string;
    entityId: string;
    actorId?: Id<"users">;
    eventType: string;
    summary: string;
    metadata?: unknown;
  },
) {
  return await ctx.db.insert("activityLog", event);
}
