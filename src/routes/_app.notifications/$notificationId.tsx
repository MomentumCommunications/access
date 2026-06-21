import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useEffect, useRef } from "react";
import {
  closeSystemNotification,
  setAppBadge,
} from "~/lib/push-notifications";
import { safeInternalPath } from "../../../shared/push-notifications";

export const Route = createFileRoute("/_app/notifications/$notificationId")({
  component: NotificationRedirect,
});

function NotificationRedirect() {
  const { notificationId } = Route.useParams();
  const notification = useConvexQuery(api.notifications.getCurrentById, {
    notificationId,
  });
  const markRead = useConvexMutation(api.notifications.markRead);
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (!notification || started.current) return;
    started.current = true;
    void markRead({ notificationId: notification._id }).then(
      async (unreadCount) => {
        closeSystemNotification(notification._id);
        await setAppBadge(unreadCount);
        await navigate({
          to: (safeInternalPath(notification.href) || "/home") as never,
          replace: true,
        });
      },
    );
  }, [markRead, navigate, notification]);

  if (notification === null) throw notFound();

  return (
    <main className="flex min-h-[50svh] items-center justify-center">
      <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </main>
  );
}
