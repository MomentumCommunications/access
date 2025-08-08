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
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";

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
}: ContextualChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const [showLoadMoreButtons, setShowLoadMoreButtons] = useState(false);

  // Find the target message index
  const targetMessageIndex = messages.findIndex(msg => msg._id === targetMessageId);
  const hasTargetMessage = targetMessageIndex !== -1;

  // Scroll to target message on initial load
  const scrollToTargetMessage = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (targetMessageRef.current && !hasScrolledToTarget) {
      targetMessageRef.current.scrollIntoView({ 
        behavior, 
        block: "center" // Center the message in the viewport
      });
      setHasScrolledToTarget(true);
    }
  }, [hasScrolledToTarget]);

  // Auto-scroll to target when messages load initially
  useEffect(() => {
    if (!isLoading && hasTargetMessage && !hasScrolledToTarget) {
      // Small delay to ensure DOM has rendered
      setTimeout(() => {
        scrollToTargetMessage("smooth");
      }, 100);
    }
  }, [isLoading, hasTargetMessage, hasScrolledToTarget, scrollToTargetMessage]);

  // Check scroll position and show/hide load more buttons
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
    setShouldShowScrollButton(
      !isNearBottom && scrollHeight > clientHeight,
    );

    // Show load more buttons when scrolled
    setShowLoadMoreButtons(scrollHeight > clientHeight);

    // Auto-load when reaching extremes (but only if not already loading)
    if (isAtTop && !loadingOlder && hasMoreOlder) {
      onLoadOlder();
    }
    if (isAtBottom && !loadingNewer && hasMoreNewer) {
      onLoadNewer();
    }

    return isNearBottom;
  }, [loadingOlder, loadingNewer, hasMoreOlder, hasMoreNewer, onLoadOlder, onLoadNewer]);

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
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Manual load functions with scroll preservation
  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    // Store current scroll position
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

            {/* Messages */}
            {messages.map((message, index) => {
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
                    ]
                  )}
                  style={{
                    scrollMarginTop: "80px", // Ensure proper scroll positioning
                  }}
                >
                  <MessageComponent
                    message={message}
                    userId={userId}
                    channelId={channelId as Id<"channels">}
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
              onClick={() => scrollToTargetMessage("smooth")}
              className="bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-800/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 text-xs gap-1 shadow-sm"
            >
              <ChevronUp className="w-3 h-3" />
              Go to linked message
            </Button>
          )}
        </div>

        {/* Scroll to bottom button */}
        {shouldShowScrollButton && (
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