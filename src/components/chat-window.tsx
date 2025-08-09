import { useCallback, useEffect, useRef, useState } from "react";
import { Id } from "convex/_generated/dataModel";
import { MessageComponent } from "./message-component";
import { MessageInput } from "./message-input";
import { BottomScroll } from "./bottom-scroll";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import { Message } from "~/lib/message-utils";
import { ArrowDown } from "lucide-react";

interface ChatWindowProps {
  messages?: Message[];
  onLoadMore: () => Promise<void>;
  loading: boolean;
  hasMore: boolean;
  userId: Id<"users">;
  channelId: Id<"channels"> | string;
  isLoading: boolean;
  className?: string;
  channel?: { isDM: boolean };
}

export function ChatWindow({
  messages = [],
  onLoadMore,
  loading,
  hasMore,
  userId,
  channelId,
  isLoading,
  className,
  channel,
}: ChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);

  // Scroll to bottom function
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      bottomRef.current?.scrollIntoView({ behavior });
      // Clear new messages notification when user scrolls to bottom
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    },
    [messages.length],
  );

  // Check if user is near bottom of chat
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    if (!scrollViewport) return false;

    const isNearBottom =
      scrollViewport.scrollTop + scrollViewport.clientHeight >=
      scrollViewport.scrollHeight - 100;

    setShouldShowScrollButton(
      !isNearBottom &&
        scrollViewport.scrollHeight > scrollViewport.clientHeight,
    );

    // Clear new messages notification if user scrolls to bottom
    if (isNearBottom && hasNewMessages) {
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    }

    return isNearBottom;
  }, [hasNewMessages, messages.length]);

  // Handle new messages - auto-scroll if near bottom, otherwise show notification
  useEffect(() => {
    if (messages.length > lastSeenMessageCount && lastSeenMessageCount > 0) {
      // New messages have arrived
      requestAnimationFrame(() => {
        const isNearBottom = checkScrollPosition();
        if (isNearBottom) {
          // User is at bottom, auto-scroll to new messages
          scrollToBottom("smooth");
        } else {
          // User is scrolled up, show notification instead
          setHasNewMessages(true);
        }
      });
    }
  }, [
    messages.length,
    lastSeenMessageCount,
    checkScrollPosition,
    scrollToBottom,
  ]);

  // Handle scroll events for load more and scroll button visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    const handleScroll = () => {
      // Load more messages when scrolling to top
      if (scrollViewport.scrollTop < 50 && !loading && hasMore) {
        // Store current scroll position before loading
        const prevScrollHeight = scrollViewport.scrollHeight;
        const prevScrollTop = scrollViewport.scrollTop;

        onLoadMore().then(() => {
          // After messages are loaded, restore scroll position
          requestAnimationFrame(() => {
            const newScrollHeight = scrollViewport.scrollHeight;
            const heightDiff = newScrollHeight - prevScrollHeight;
            scrollViewport.scrollTop = prevScrollTop + heightDiff;
          });
        });
      }

      // Update scroll button visibility
      checkScrollPosition();
    };

    scrollViewport.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check
    checkScrollPosition();

    return () => {
      scrollViewport.removeEventListener("scroll", handleScroll);
    };
  }, [loading, hasMore, onLoadMore, checkScrollPosition]);

  // Initial scroll to bottom on first load and set baseline message count
  useEffect(() => {
    if (!isLoading && messages.length > 0 && lastSeenMessageCount === 0) {
      scrollToBottom("instant");
      setLastSeenMessageCount(messages.length);
    }
  }, [isLoading, scrollToBottom, messages.length, lastSeenMessageCount]);

  return (
    <div
      className={cn(
        // CSS Grid layout for perfect behavior
        "grid grid-rows-[1fr_auto] h-full min-h-0",
        // Ensure proper spacing and background
        "bg-background",
        className,
      )}
    >
      {/* Messages Area - Row 1: Takes all available space */}
      <div className="min-h-0 relative">
        <ScrollArea ref={scrollContainerRef} className="h-full">
          <div className="px-4 py-4 space-y-4">
            {/* Loading indicator for pagination */}
            {loading && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  Loading more messages...
                </div>
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <Alert className="max-w-sm mx-auto">
                  <AlertDescription className="text-center">
                    No messages yet. Start the conversation!
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Loading skeleton for initial load */}
            {isLoading && messages.length === 0 && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-16 h-4" />
                    </div>
                    <Skeleton className="w-full h-16" />
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <MessageComponent
                key={message._id}
                message={message}
                userId={userId}
                channelId={channelId as Id<"channels">}
                channel={channel}
              />
            ))}

            {/* Scroll target */}
            <div ref={bottomRef} className="h-px" />
          </div>
        </ScrollArea>

        {/* Jump to new messages button */}
        {hasNewMessages && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
            <Button
              onClick={() => scrollToBottom("smooth")}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-0 text-sm px-4 py-2 h-auto"
              size="sm"
            >
              <ArrowDown className="w-4 h-4 mr-2" />
              Jump to new messages
            </Button>
          </div>
        )}

        {/* Scroll to bottom button */}
        {shouldShowScrollButton && !hasNewMessages && (
          <div className="absolute bottom-0 right-4 z-10">
            <BottomScroll bottomRef={bottomRef} />
          </div>
        )}
      </div>

      {/* Message Input - Row 2: Fixed height at bottom */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-3">
        <MessageInput userId={userId} channel={channelId} />
      </div>
    </div>
  );
}
