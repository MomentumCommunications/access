import {
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export function NotificationsBell() {
  const navigate = useNavigate();
  const currentUser = useConvexQuery(api.users.current, {});
  const notifications = useConvexQuery(api.notifications.listCurrent, {});
  const unreadCount = useConvexQuery(api.notifications.unreadCount, {});
  const markRead = useConvexMutation(api.notifications.markRead);
  const markAllRead = useConvexMutation(api.notifications.markAllRead);

  if (currentUser === null) {
    return null;
  }

  async function openNotification(notification: {
    _id: Id<"notifications">;
    href: string;
  }) {
    await markRead({ notificationId: notification._id });
    await navigate({ to: notification.href as never });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell />
          {(unreadCount || 0) > 0 ? (
            <span
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background"
              aria-label={`${unreadCount} unread notifications`}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-1rem))] p-0"
      >
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              Updates that may need your attention.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!unreadCount}
            onClick={() => void markAllRead({})}
          >
            Clear all
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-80">
          {notifications === undefined ? (
            <div className="flex h-40 items-center justify-center p-4 text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 p-4 text-center">
              <Bell className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                New updates will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const unread = notification.readAt === undefined;
                return (
                  <div
                    key={notification._id}
                    className={cn(
                      "group relative flex gap-2 p-3 transition-colors hover:bg-accent/60",
                      unread && "bg-muted/50",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void openNotification(notification)}
                    >
                      <span className="flex items-start gap-2">
                        {unread ? (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />
                        ) : (
                          <span className="mt-1.5 size-2 shrink-0" />
                        )}
                        <span className="min-w-0 space-y-1">
                          <span className="block text-sm font-medium">
                            {notification.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {notification.body}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              { addSuffix: true },
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                    {unread ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                        aria-label={`Mark ${notification.title} as read`}
                        title="Mark as read"
                        onClick={() =>
                          void markRead({
                            notificationId: notification._id,
                          })
                        }
                      >
                        <Check />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
