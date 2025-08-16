import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Id } from "convex/_generated/dataModel";
import { MessageComponent } from "./message-component";
import { MessageInput } from "./message-input";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { cn } from "~/lib/utils";
import { Message, groupMessagesByDate } from "~/lib/message-utils";
import { ArrowDown } from "lucide-react";
import { DateSeparator } from "./date-separator";
import { Button } from "./ui/button";
import { useMessageReadTracking } from "~/hooks/useMessageReadTracking";
import React from "react";

interface ChatWindowProps {
  messages?: Message[];
  onLoadOlder: () => Promise<void>;
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  userId: Id<"users">;
  channelId: Id<"channels">;
  targetMessageId?: Id<"messages">;
  isLoading: boolean;
  className?: string;
  channel?: { isDM: boolean };
  adminControlled?: boolean;
  disableHighlight?: boolean;
}

export function ChatWindow({
  messages = [],
  onLoadOlder,
  hasMoreOlder,
  loadingOlder,
  userId,
  channelId,
  targetMessageId,
  isLoading,
  className,
  channel,
  adminControlled,
  disableHighlight,
}: ChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | undefined>();
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);

  function backToChannel(channelId: Id<"channels">) {
    window.location.href = `/channel/${channelId}`;
  }

  // Initialize read tracking
  const { registerMessageElement } = useMessageReadTracking({
    messages,
    userId,
    channelId,
    scrollContainerRef,
    enabled: true,
  });

  // Group messages by date for separators
  const messageGroups = useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  // Determine target message - either from URL or most recent message
  const actualTargetMessageId = useMemo(() => {
    if (targetMessageId) {
      return targetMessageId;
    }
    // If no target specified, use the last (most recent) message as target
    return messages.length > 0 ? messages[messages.length - 1]._id : undefined;
  }, [targetMessageId, messages]);

  // Find the target message index
  const targetMessageIndex = useMemo(() => {
    if (!actualTargetMessageId) return -1;
    return messages.findIndex((msg) => msg._id === actualTargetMessageId);
  }, [actualTargetMessageId, messages]);

  const hasTargetMessage = targetMessageIndex !== -1;

  // Scroll to bottom function
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "instant") => {
      bottomRef.current?.scrollIntoView({ behavior });
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
      setIsAtBottom(true);
    },
    [messages.length],
  );

  // Scroll to target message function
  const scrollToTargetMessage = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      if (targetMessageRef.current) {
        targetMessageRef.current.scrollIntoView({
          behavior,
          block: "center",
          inline: "nearest",
        });
        setHasScrolledToTarget(true);
      }
    },
    [],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!scrollViewport) return;

    const handleScroll = () => {
      const distanceFromBottom =
        scrollViewport.scrollHeight -
        (scrollViewport.scrollTop + scrollViewport.clientHeight);

      setIsNearBottom(distanceFromBottom <= 100); // buffer zone
    };

    scrollViewport.addEventListener("scroll", handleScroll);
    handleScroll(); // initialize

    return () => {
      scrollViewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Handle new messages - auto scroll if at bottom, show notification if not
  useEffect(() => {
    if (isLoading || loadingOlder) return;

    if (messages.length > lastSeenMessageCount && lastSeenMessageCount > 0) {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollViewport = container.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null;

      if (!scrollViewport) return;

      if (isNearBottom) {
        requestAnimationFrame(() => {
          scrollToBottom("instant");
        });
      } else {
        setHasNewMessages(true);
      }
    }
  }, [
    messages.length,
    lastSeenMessageCount,
    isLoading,
    loadingOlder,
    scrollToBottom,
  ]);
  // Initialize message count when messages first load
  useEffect(() => {
    if (messages.length > 0 && lastSeenMessageCount === 0) {
      setLastSeenMessageCount(messages.length);
    }
  }, [messages.length, lastSeenMessageCount]);

  // Initial scroll positioning
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      if (hasTargetMessage && !hasScrolledToTarget) {
        // If we have a target message (from URL or first message), scroll to it
        setTimeout(() => {
          scrollToTargetMessage("auto");
        }, 100);
      } else if (!hasTargetMessage && !hasScrolledToTarget) {
        // If no target, scroll to bottom (most recent)
        setTimeout(() => {
          scrollToBottom("auto");
          setHasScrolledToTarget(true);
        }, 100);
      }
    }
  }, [
    isLoading,
    messages.length,
    hasTargetMessage,
    hasScrolledToTarget,
    scrollToTargetMessage,
    scrollToBottom,
  ]);

  // Handle scroll events for loading older messages and UI updates
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    if (!scrollViewport) return;

    const scrollTop = scrollViewport.scrollTop;
    const scrollHeight = scrollViewport.scrollHeight;
    const clientHeight = scrollViewport.clientHeight;

    const isAtTop = scrollTop < 100;

    // Update bottom position state
    setIsAtBottom(isNearBottom);

    // Show/hide scroll to bottom button
    setShouldShowScrollButton(!isNearBottom && scrollHeight > clientHeight);

    // Clear new messages notification if at bottom
    if (isNearBottom && hasNewMessages) {
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    }

    // Load older messages when scrolled to top
    if (isAtTop && !loadingOlder && hasMoreOlder) {
      // Store current scroll position to maintain it after loading
      const previousScrollHeight = scrollViewport.scrollHeight;
      const previousScrollTop = scrollViewport.scrollTop;

      onLoadOlder().then(() => {
        // Restore scroll position after new messages are loaded
        requestAnimationFrame(() => {
          const newScrollHeight = scrollViewport.scrollHeight;
          const heightDiff = newScrollHeight - previousScrollHeight;
          scrollViewport.scrollTop = previousScrollTop + heightDiff;
        });
      });
    }
  }, [
    loadingOlder,
    hasMoreOlder,
    hasNewMessages,
    messages.length,
    onLoadOlder,
  ]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    let throttleTimer: NodeJS.Timeout | null = null;

    const throttledScroll = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        handleScroll();
        throttleTimer = null;
      }, 16); // ~60fps
    };

    scrollViewport.addEventListener("scroll", throttledScroll, {
      passive: true,
    });

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      scrollViewport.removeEventListener("scroll", throttledScroll);
    };
  }, [handleScroll]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(undefined);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        scrollToBottom("smooth");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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
        <ScrollArea
          ref={scrollContainerRef}
          className="h-full content-end grid grid-cols-1"
        >
          <div className="px-4 py-4 space-y-2">
            {/* Loading indicator for older messages */}
            {loadingOlder && (
              <div className="absolute top-0 left-0 right-0 flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  Loading older messages...
                </div>
              </div>
            )}
            {/* Empty state */}
            {/* {messages.length === 0 && !isLoading && ( */}
            {/*   <div className="h-full flex items-center justify-center"> */}
            {/*     <Alert className="max-w-sm mx-auto"> */}
            {/*       <AlertDescription className="text-center"> */}
            {/*         This is the beginning of the conversation. */}
            {/*       </AlertDescription> */}
            {/*     </Alert> */}
            {/*   </div> */}
            {/* )} */}
            {/* Loading skeleton for initial load */}
            {isLoading && messages.length === 0 && (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
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

            {/* Messages grouped by date */}
            <div className="space-y-2 space-x-8">
              <h2 className="text-lg font-semibold">
                This is the start of the conversation.
              </h2>
            </div>
            {messageGroups.map((group) => (
              <div
                key={`group-${group.date.toISOString()}`}
                className="space-y-2"
              >
                {/* Date separator */}
                <DateSeparator dateLabel={group.dateLabel} />

                {/* Messages in this date group */}
                {group.messages.map((message) => {
                  const isTargetMessage = message._id === actualTargetMessageId;
                  const shouldHighlight = isTargetMessage && !disableHighlight;
                  return (
                    <div
                      key={message._id}
                      ref={isTargetMessage ? targetMessageRef : undefined}
                      data-message-id={message._id}
                      className={cn(
                        shouldHighlight && [
                          "relative",
                          "animate-pulse-highlight", // We'll define this in CSS
                          "before:absolute before:inset-0 before:-z-10",
                          "before:shadow-sm",
                          "p-2 -m-2", // Add padding to highlight area
                        ],
                      )}
                      style={{
                        scrollMarginTop: "80px",
                      }}
                    >
                      <MessageComponent
                        message={message}
                        userId={userId}
                        channelId={channelId}
                        channel={channel}
                        onRegisterElement={registerMessageElement}
                        onReply={handleReply}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Scroll target */}
            <div ref={bottomRef} className="h-px" />
          </div>
        </ScrollArea>

        {/* Jump to new messages button */}
        {hasNewMessages && disableHighlight && (
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

        {/* Back to present button for new because I'm afaid of the confilcts with the load newer messages */}
        {!disableHighlight && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
            <Button
              onClick={() => backToChannel(channelId)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-0 text-sm px-4 py-2 h-auto"
              size="sm"
            >
              <ArrowDown className="w-4 h-4 mr-2" />
              Back to present
            </Button>
          </div>
        )}

        {/* Scroll to bottom button */}
        {shouldShowScrollButton && !hasNewMessages && (
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-10">
            <Button
              onClick={() => scrollToBottom("smooth")}
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-3">
        <MessageInput
          userId={userId}
          channel={channelId}
          adminControlled={adminControlled}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
        />
      </div>
    </div>
  );
}
