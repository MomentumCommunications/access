import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hasUserRole } from "./roles";
import type { NotificationEventInput } from "../../shared/notifications";
import { shouldSendPush } from "../../shared/push-notifications";
import { makeFunctionReference } from "convex/server";

const deliverNotification = makeFunctionReference<
  "action",
  { notificationId: Id<"notifications"> }
>("pushActions:deliverNotification");

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
    recipients.map(async (recipientUserId) => {
      const notificationId = await ctx.db.insert("notifications", {
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
      });
      if (shouldSendPush(event.type)) {
        await ctx.scheduler.runAfter(0, deliverNotification, {
          notificationId,
        });
      }
      return notificationId;
    }),
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

export async function studentManagerNotificationRecipients(
  ctx: MutationCtx,
  studentId: Id<"students">,
  exceptUserId?: Id<"users">,
) {
  const contacts = await ctx.db
    .query("studentContacts")
    .withIndex("byStudent", (q) => q.eq("student", studentId))
    .collect();

  return contacts
    .filter(
      (
        contact,
      ): contact is typeof contact & { user: Id<"users"> } =>
        contact.canManage &&
        contact.user !== undefined &&
        contact.user !== exceptUserId,
    )
    .map((contact) => contact.user);
}

export async function createStudentManagerNotifications(
  ctx: MutationCtx,
  studentId: Id<"students">,
  event: NotificationEventInput,
  exceptUserId?: Id<"users">,
) {
  const recipientUserIds = await studentManagerNotificationRecipients(
    ctx,
    studentId,
    exceptUserId,
  );
  return await createNotifications(ctx, { recipientUserIds, event });
}
