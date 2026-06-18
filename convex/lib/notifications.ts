import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hasUserRole } from "./roles";
import type { NotificationEventInput } from "../../shared/notifications";

export async function adminNotificationRecipients(
  ctx: MutationCtx,
  exceptUserId?: Id<"users">,
) {
  const users = await ctx.db.query("users").collect();
  return users
    .filter(
      (user) =>
        user._id !== exceptUserId && hasUserRole(user, "admin"),
    )
    .map((user) => user._id);
}

export async function createNotifications(
  ctx: MutationCtx,
  {
    recipientUserIds,
    event,
    createdAt = Date.now(),
  }: {
    recipientUserIds: Id<"users">[];
    event: NotificationEventInput;
    createdAt?: number;
  },
) {
  const recipients = [...new Set(recipientUserIds)];
  return await Promise.all(
    recipients.map((recipientUserId) =>
      ctx.db.insert("notifications", {
        recipientUserId,
        type: event.type,
        title: event.title,
        body: event.body,
        href: event.href,
        actorUserId: event.actorUserId as Id<"users"> | undefined,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata,
        createdAt,
      }),
    ),
  );
}

export async function createAdminNotifications(
  ctx: MutationCtx,
  event: NotificationEventInput,
  exceptUserId?: Id<"users">,
) {
  const recipientUserIds = await adminNotificationRecipients(
    ctx,
    exceptUserId,
  );
  return await createNotifications(ctx, { recipientUserIds, event });
}
