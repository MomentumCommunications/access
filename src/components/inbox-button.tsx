import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { InboxIcon, Hash, MessageSquare, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useAppBadge } from "~/hooks/useAppBadge";

function formatTimeAgo(timestamp: number) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function truncateMessage(body: string) {
  const words = body.split(" ");
  if (words.length <= 15) return body;
  return words.slice(0, 15).join(" ") + "...";
}

interface UnreadMessageItemProps {
  message: {
    _id: string;
    body: string;
    _creationTime: number;
    authorName: string;
    channelInfo: {
      name: string;
      isDM: boolean;
      channelId?: string;
      dmId?: string;
    } | null;
    format?: string;
  };
  onClick: () => void;
}

function UnreadMessageItem({ message, onClick }: UnreadMessageItemProps) {
  const channelName = message.channelInfo?.name || "Unknown Channel";
  const isImage = message.format === "image";

  return (
    <div
      className="flex flex-col gap-2 p-3 hover:bg-accent rounded-md cursor-pointer border-l-2 border-l-blue-500"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {message.channelInfo?.isDM ? (
            <MessageSquare className="h-3 w-3" />
          ) : (
            <Hash className="h-3 w-3" />
          )}
          <span className="truncate">{channelName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(message._creationTime)}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <span className="font-medium">{message.authorName}:</span>{" "}
        {isImage ? (
          <span className="italic">sent an image</span>
        ) : (
          <span>{truncateMessage(message.body)}</span>
        )}
      </div>
    </div>
  );
}

export function InboxButton() {
  const user = useUser();

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
  );

  const { data: unreadMessages, isLoading } = useQuery({
    ...convexQuery(api.messages.getUnreadMessages, {
      userId: convexUser?._id,
      limit: 20,
    }),
    enabled: !!convexUser?._id,
  });

  // Get total unread count (not limited to 20)
  const { data: totalUnreadCount, isLoading: isLoadingTotal } = useQuery({
    ...convexQuery(api.messages.getTotalUnreadCount, {
      userId: convexUser?._id,
    }),
    enabled: !!convexUser?._id,
  });

  const displayedCount = unreadMessages?.length || 0;
  const actualTotalCount = totalUnreadCount || 0;

  // Use the app badge hook to automatically manage the app icon badge
  // Always pass a number to ensure stable hook execution
  const { isSupported: isBadgeSupported } = useAppBadge(actualTotalCount);

  const handleMessageClick = (message: UnreadMessageItemProps["message"]) => {
    if (message.channelInfo?.isDM && message.channelInfo.dmId) {
      window.location.href = `/dm/${message.channelInfo.dmId}`;
    } else if (message.channelInfo?.channelId) {
      window.location.href = `/channel/${message.channelInfo.channelId}`;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <InboxIcon className="h-4 w-4" />
          {actualTotalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {actualTotalCount > 99 ? "99+" : actualTotalCount}
            </span>
          )}
          <span className="sr-only">Inbox</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Unread Messages</h4>
              <p className="text-sm text-muted-foreground">
                {actualTotalCount} unread message{actualTotalCount !== 1 ? "s" : ""}
              </p>
            </div>
            {isBadgeSupported && actualTotalCount > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                App badge active
              </div>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading || isLoadingTotal ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : unreadMessages && unreadMessages.length > 0 ? (
            <div className="divide-y">
              {unreadMessages.map((message) => (
                <UnreadMessageItem
                  key={message._id}
                  message={message}
                  onClick={() => handleMessageClick(message)}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No unread messages
            </div>
          )}
        </div>

        {actualTotalCount > 20 && (
          <div className="p-3 border-t bg-muted/50">
            <p className="text-xs text-center text-muted-foreground">
              Showing 20 of {actualTotalCount} unread messages
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

