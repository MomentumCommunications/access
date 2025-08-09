import { useCallback, useEffect, useRef, useState } from "react";
import { Id } from "convex/_generated/dataModel";
import { MessageComponent } from "./message-component";
import { MessageInput } from "./message-input";
import { BottomScroll } from "./bottom-scroll";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";
import { cn } from "~/lib/utils";
import { Message } from "~/lib/message-utils";
import { ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import { useMessageReadTracking } from "~/hooks/useMessageReadTracking";

interface ContextualChatWindowProps {
  messages?: Message[];
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
  loadingOlder: boolean;
  loadingNewer: boolean;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  userId: Id<"users">;
  channelId: Id<"channels"> | string;
  targetMessageId: Id<"messages">;
  isLoading: boolean;
  className?: string;
  channel?: { isDM: boolean };
}

export function ContextualChatWindow({
  messages = [],
  onLoadOlder,
  onLoadNewer,
  loadingOlder,
  loadingNewer,
  hasMoreOlder,
  hasMoreNewer,
  userId,
  channelId,
  targetMessageId,
  isLoading,
  className,
  channel,
}: ContextualChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const [lastTargetMessageId, setLastTargetMessageId] =
    useState<Id<"messages"> | null>(null);
  const [showLoadMoreButtons, setShowLoadMoreButtons] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);

  // Initialize read tracking
  const { registerMessageElement } = useMessageReadTracking({
    messages,
    userId,
    channelId: channelId as Id<"channels">,
    scrollContainerRef,
    enabled: true,
  });

  console.log("ContextualChatWindow messages:", messages);

  // Find the target message index
  const targetMessageIndex = messages.findIndex(
    (msg) => msg._id === targetMessageId,
  );
  const hasTargetMessage = targetMessageIndex !== -1;

  // Position target message in center immediately
  const scrollToTargetMessage = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      console.log("scrollToTargetMessage called:", {
        hasTargetRef: !!targetMessageRef.current,
        behavior,
        targetMessageId,
      });

      if (targetMessageRef.current) {
        // Simple and direct: use scrollIntoView to center the message
        targetMessageRef.current.scrollIntoView({
          behavior,
          block: "center",
          inline: "nearest",
        });

        setHasScrolledToTarget(true);
        console.log("Target message positioned in center");
      }
    },
    [targetMessageId],
  );

  // Reset scroll state when target message changes
  useEffect(() => {
    if (targetMessageId !== lastTargetMessageId) {
      console.log("Target message changed, resetting scroll state:", {
        oldTarget: lastTargetMessageId,
        newTarget: targetMessageId,
      });
      setHasScrolledToTarget(false);
      setLastTargetMessageId(targetMessageId);
    }
  }, [targetMessageId, lastTargetMessageId]);

  // Scroll to bottom function for new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    // Clear new messages notification when user scrolls to bottom
    setHasNewMessages(false);
    setLastSeenMessageCount(messages.length);
  }, [messages.length]);

  // Handle new messages - show notification if user isn't at bottom
  useEffect(() => {
    if (messages.length > lastSeenMessageCount && lastSeenMessageCount > 0) {
      // New messages have arrived, check if user is at bottom
      const container = scrollContainerRef.current;
      if (container) {
        const scrollViewport = container.querySelector(
          "[data-radix-scroll-area-viewport]",
        ) as HTMLElement;
        
        if (scrollViewport) {
          const isNearBottom = 
            scrollViewport.scrollTop + scrollViewport.clientHeight >= 
            scrollViewport.scrollHeight - 100;
          
          if (!isNearBottom) {
            // User is scrolled up, show notification
            setHasNewMessages(true);
          } else {
            // User is at bottom, update count without notification
            setLastSeenMessageCount(messages.length);
          }
        }
      }
    }
  }, [messages.length, lastSeenMessageCount]);

  // Initialize message count when messages first load
  useEffect(() => {
    if (messages.length > 0 && lastSeenMessageCount === 0) {
      setLastSeenMessageCount(messages.length);
    }
  }, [messages.length, lastSeenMessageCount]);

  // Position target message in center immediately on initial load
  useEffect(() => {
    console.log("Initial positioning effect triggered:", {
      isLoading,
      hasTargetMessage,
      hasScrolledToTarget,
      messagesLength: messages.length,
      targetMessageIndex,
    });

    if (!isLoading && hasTargetMessage && !hasScrolledToTarget) {
      console.log("Positioning target message in center immediately");

      // Small delay to ensure DOM is fully rendered, then position instantly
      setTimeout(() => {
        scrollToTargetMessage("auto");
      }, 50);
    }
  }, [
    isLoading,
    hasTargetMessage,
    hasScrolledToTarget,
    scrollToTargetMessage,
    messages.length,
  ]);

  // Check scroll position and handle auto-loading with scroll preservation
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    if (!scrollViewport) return false;

    const scrollTop = scrollViewport.scrollTop;
    const scrollHeight = scrollViewport.scrollHeight;
    const clientHeight = scrollViewport.clientHeight;

    const isAtTop = scrollTop < 50;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    // Show scroll to bottom button
    setShouldShowScrollButton(!isNearBottom && scrollHeight > clientHeight);

    // Show load more buttons when scrolled
    setShowLoadMoreButtons(scrollHeight > clientHeight);

    // Clear new messages notification if user scrolls to bottom
    if (isNearBottom && hasNewMessages) {
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    }

    // Auto-load older messages when at top (with scroll preservation)
    if (isAtTop && !loadingOlder && hasMoreOlder) {
      // Store current scroll position before loading
      const prevScrollHeight = scrollViewport.scrollHeight;
      const prevScrollTop = scrollViewport.scrollTop;

      onLoadOlder().then(() => {
        // Restore scroll position after messages load
        requestAnimationFrame(() => {
          const newScrollHeight = scrollViewport.scrollHeight;
          const heightDiff = newScrollHeight - prevScrollHeight;
          scrollViewport.scrollTop = prevScrollTop + heightDiff;
        });
      });
    }

    // Auto-load newer messages when at bottom (no scroll preservation needed)
    if (isAtBottom && !loadingNewer && hasMoreNewer) {
      onLoadNewer();
    }

    return isNearBottom;
  }, [
    loadingOlder,
    loadingNewer,
    hasMoreOlder,
    hasMoreNewer,
    onLoadOlder,
    onLoadNewer,
    hasNewMessages,
    messages.length,
  ]);

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    const handleScroll = () => {
      checkScrollPosition();
    };

    scrollViewport.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check
    setTimeout(checkScrollPosition, 100);

    return () => {
      scrollViewport.removeEventListener("scroll", handleScroll);
    };
  }, [checkScrollPosition]);

  // Scroll to bottom function
  // const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
  //   bottomRef.current?.scrollIntoView({ behavior });
  // }, []);

  // Manual load functions
  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    // Store current scroll position for manual loads too
    const prevScrollHeight = scrollViewport.scrollHeight;
    const prevScrollTop = scrollViewport.scrollTop;

    await onLoadOlder();

    // Restore scroll position after messages load
    requestAnimationFrame(() => {
      const newScrollHeight = scrollViewport.scrollHeight;
      const heightDiff = newScrollHeight - prevScrollHeight;
      scrollViewport.scrollTop = prevScrollTop + heightDiff;
    });
  }, [loadingOlder, hasMoreOlder, onLoadOlder]);

  const handleLoadNewer = useCallback(async () => {
    if (loadingNewer || !hasMoreNewer) return;
    await onLoadNewer();
  }, [loadingNewer, hasMoreNewer, onLoadNewer]);

  return (
    <div
      className={cn(
        "grid grid-rows-[1fr_auto] h-full min-h-0",
        "bg-background relative",
        className,
      )}
    >
      {/* Messages Area */}
      <div className="min-h-0 relative">
        <ScrollArea ref={scrollContainerRef} className="h-full">
          <div className="px-4 py-4 space-y-4">
            {/* Load More Older Messages Button */}
            {showLoadMoreButtons && hasMoreOlder && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="text-xs gap-1"
                >
                  {loadingOlder ? (
                    <Skeleton className="w-4 h-4 rounded-full" />
                  ) : (
                    <ArrowUp className="w-3 h-3" />
                  )}
                  {loadingOlder ? "Loading..." : "Load older messages"}
                </Button>
              </div>
            )}

            {/* Loading indicator for older messages */}
            {loadingOlder && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  Loading older messages...
                </div>
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <Alert className="max-w-sm mx-auto">
                  <AlertDescription className="text-center">
                    This message could not be found or loaded.
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

            {/* Messages, there was an unused index varible that may be useful one day */}
            {messages.map((message) => {
              const isTargetMessage = message._id === targetMessageId;
              return (
                <div
                  key={message._id}
                  ref={isTargetMessage ? targetMessageRef : undefined}
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    isTargetMessage && [
                      "relative",
                      "animate-pulse-highlight", // We'll define this in CSS
                      "before:absolute before:inset-0 before:-z-10",
                      "before:bg-yellow-200/20 dark:before:bg-yellow-500/10",
                      "before:rounded-lg before:border before:border-yellow-300/30",
                      "before:shadow-sm",
                      "p-2 -m-2", // Add padding to highlight area
                    ],
                  )}
                  style={{
                    scrollMarginTop: "80px", // Ensure proper scroll positioning
                  }}
                >
                  <MessageComponent
                    message={message}
                    userId={userId}
                    channelId={channelId as Id<"channels">}
                    channel={channel}
                    onRegisterElement={registerMessageElement}
                  />
                </div>
              );
            })}

            {/* Loading indicator for newer messages */}
            {loadingNewer && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  Loading newer messages...
                </div>
              </div>
            )}

            {/* Load More Newer Messages Button */}
            {showLoadMoreButtons && hasMoreNewer && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadNewer}
                  disabled={loadingNewer}
                  className="text-xs gap-1"
                >
                  {loadingNewer ? (
                    <Skeleton className="w-4 h-4 rounded-full" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  {loadingNewer ? "Loading..." : "Load newer messages"}
                </Button>
              </div>
            )}

            {/* Scroll target */}
            <div ref={bottomRef} className="h-px" />
          </div>
        </ScrollArea>

        {/* Floating Action Buttons */}
        <div className="absolute top-4 left-4 z-10 space-y-2">
          {/* Jump to Target Message Button */}
          {hasTargetMessage && hasScrolledToTarget && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // Scroll to target with smooth animation
                scrollToTargetMessage("smooth");
              }}
            >
              <ChevronUp className="w-3 h-3" />
              Go to linked message
            </Button>
          )}
        </div>

        {/* Jump to new messages button */}
        {hasNewMessages && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
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

      {/* Message Input */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-3">
        <MessageInput userId={userId} channel={channelId} />
      </div>
    </div>
  );
}
