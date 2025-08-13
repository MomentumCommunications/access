import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Id } from "convex/_generated/dataModel";
import { MessageComponent } from "./message-component";
import { MessageInput } from "./message-input";
import { BottomScroll } from "./bottom-scroll";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";
import { cn } from "~/lib/utils";
import { Message, groupMessagesByDate } from "~/lib/message-utils";
import { ArrowDown } from "lucide-react";
import { DateSeparator } from "./date-separator";
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
  adminControlled?: boolean;
  disableHighlight?: boolean;
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
  adminControlled,
  disableHighlight = false,
}: ContextualChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const [lastTargetMessageId, setLastTargetMessageId] =
    useState<Id<"messages"> | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | undefined>();
  const [isRestoringScrollPosition, setIsRestoringScrollPosition] =
    useState(false);
  const scrollEventDisabled = useRef(false);
  const restorationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadTime = useRef<number>(0);

  // Initialize read tracking
  const { registerMessageElement } = useMessageReadTracking({
    messages,
    userId,
    channelId: channelId as Id<"channels">,
    scrollContainerRef,
    enabled: true,
  });

  // Group messages by date for separators
  const messageGroups = useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (restorationTimeoutRef.current) {
        clearTimeout(restorationTimeoutRef.current);
      }
    };
  }, []);

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

        // setHasScrolledToTarget(true);
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
      // setHasScrolledToTarget(false);
      setLastTargetMessageId(targetMessageId);
    }
  }, [targetMessageId, lastTargetMessageId]);

  // Scroll to bottom function for new messages
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      bottomRef.current?.scrollIntoView({ behavior });
      // Clear new messages notification when user scrolls to bottom
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    },
    [messages.length],
  );

  // Handle new messages - show notification if user isn't at bottom
  useEffect(() => {
    // Skip new message detection during scroll restoration or loading
    if (isRestoringScrollPosition || loadingOlder || loadingNewer) {
      return;
    }

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
  }, [
    messages.length,
    lastSeenMessageCount,
    isRestoringScrollPosition,
    loadingOlder,
    loadingNewer,
  ]);

  // Initialize message count when messages first load
  useEffect(() => {
    if (messages.length > 0 && lastSeenMessageCount === 0) {
      setLastSeenMessageCount(messages.length);
    }
  }, [messages.length, lastSeenMessageCount]);

  // Position target message in center immediately on initial load, or scroll to bottom for regular chat
  useEffect(() => {
    console.log("Initial positioning effect triggered:", {
      isLoading,
      hasTargetMessage,
      hasScrolledToTarget,
      messagesLength: messages.length,
      targetMessageIndex,
      disableHighlight,
    });

    if (!isLoading && messages.length > 0) {
      if (disableHighlight || !hasTargetMessage) {
        // For regular chat mode, scroll to bottom on initial load
        setTimeout(() => {
          scrollToBottom("auto");
        }, 50);
      } else if (hasTargetMessage && !hasScrolledToTarget) {
        console.log("Positioning target message in center immediately");

        // Small delay to ensure DOM is fully rendered, then position instantly
        setTimeout(() => {
          scrollToTargetMessage("auto");
        }, 50);
      }
    }
  }, [
    isLoading,
    hasTargetMessage,
    hasScrolledToTarget,
    scrollToTargetMessage,
    scrollToBottom,
    messages.length,
    disableHighlight,
  ]);

  // Check scroll position and handle auto-loading with scroll preservation
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    if (!scrollViewport) return false;

    // Skip all UI updates and auto-loading while restoring scroll position
    if (isRestoringScrollPosition) {
      return false;
    }

    const scrollTop = scrollViewport.scrollTop;
    const scrollHeight = scrollViewport.scrollHeight;
    const clientHeight = scrollViewport.clientHeight;

    // Trigger load earlier (100px from top) so users don't need to stop scrolling
    const isAtTop = scrollTop < 100;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    // Simplified scroll button logic - only show when scrolled away from bottom and not loading
    const shouldShow =
      !isNearBottom && scrollHeight > clientHeight && !loadingOlder;
    setShouldShowScrollButton(shouldShow);

    // Clear new messages notification if user scrolls to bottom - debounce during loads
    if (
      isNearBottom &&
      hasNewMessages &&
      !loadingOlder &&
      !loadingNewer &&
      !isRestoringScrollPosition
    ) {
      setHasNewMessages(false);
      setLastSeenMessageCount(messages.length);
    }

    // Auto-load older messages when at top (with scroll preservation and cooldown)
    const now = Date.now();
    const canLoad = now - lastLoadTime.current > 1000; // 1000ms cooldown to prevent rapid requests

    if (
      isAtTop &&
      !loadingOlder &&
      hasMoreOlder &&
      !isRestoringScrollPosition &&
      canLoad
    ) {
      lastLoadTime.current = now;
      // Disable scroll events during restoration
      scrollEventDisabled.current = true;
      setIsRestoringScrollPosition(true);

      // Simplified anchor selection - use center-most message
      let anchorMessageElement: HTMLElement | null = null;
      let anchorMessageId: string | null = null;
      let anchorOffset = 0;

      try {
        const messageElements =
          scrollViewport.querySelectorAll("[data-message-id]");
        const viewportRect = scrollViewport.getBoundingClientRect();
        const viewportCenter = viewportRect.top + viewportRect.height / 2;

        let closestDistance = Infinity;

        // Find the message closest to viewport center
        for (const element of messageElements) {
          const rect = element.getBoundingClientRect();
          const elementCenter = rect.top + rect.height / 2;
          const distance = Math.abs(elementCenter - viewportCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            anchorMessageElement = element as HTMLElement;
            anchorMessageId = element.getAttribute("data-message-id");
          }
        }

        if (anchorMessageElement) {
          anchorOffset =
            anchorMessageElement.offsetTop - scrollViewport.scrollTop;
        }
      } catch (error) {
        console.error("Error selecting anchor message:", error);
        // Fallback: use current scroll position
        anchorOffset = scrollViewport.scrollTop;
      }

      const messageCountBefore = messages.length;

      onLoadOlder()
        .then(() => {
          // Wait for parent state to update, then check if messages were loaded
          setTimeout(() => {
            const messageCountAfter = messages.length;
            const messagesWereLoaded = messageCountAfter > messageCountBefore;

            console.log("Load check:", {
              before: messageCountBefore,
              after: messageCountAfter,
              loaded: messagesWereLoaded,
              hasMoreOlder,
            });

            try {
              // Only restore scroll position if messages were loaded
              if (messagesWereLoaded && anchorMessageId) {
                const newAnchorElement = scrollViewport.querySelector(
                  `[data-message-id="${anchorMessageId}"]`,
                ) as HTMLElement;

                if (newAnchorElement) {
                  const newScrollTop =
                    newAnchorElement.offsetTop - anchorOffset;
                  scrollViewport.scrollTop = Math.max(0, newScrollTop);
                } else {
                  // Anchor not found, use height difference fallback
                  const heightDiff = scrollViewport.scrollHeight - anchorOffset;
                  scrollViewport.scrollTop = Math.max(0, heightDiff);
                }
              } else if (!messagesWereLoaded) {
                // No messages loaded, add longer cooldown to prevent immediate retry
                lastLoadTime.current = now + 2000; // Extra 2 second delay
              }
            } catch (error) {
              console.error("Error restoring scroll position:", error);
            } finally {
              // Simple cleanup with minimal delay
              restorationTimeoutRef.current = setTimeout(
                () => {
                  scrollEventDisabled.current = false;
                  setIsRestoringScrollPosition(false);
                },
                messagesWereLoaded ? 50 : 200,
              ); // Longer delay if no messages loaded
            }
          }, 100); // Wait 100ms for parent state to update
        })
        .catch((error) => {
          // Handle loading errors - add extra cooldown
          console.error("Error loading older messages:", error);
          lastLoadTime.current = now + 2000; // Extra delay on error
          scrollEventDisabled.current = false;
          setIsRestoringScrollPosition(false);
        });
    }

    // Auto-load newer messages when at bottom (no scroll preservation needed)
    if (
      isAtBottom &&
      !loadingNewer &&
      hasMoreNewer &&
      !isRestoringScrollPosition
    ) {
      onLoadNewer().then(() => {
        // Re-check scroll position after load
        setTimeout(() => checkScrollPosition(), 100);
      });
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
    isRestoringScrollPosition,
  ]);

  // Handle scroll events with throttling for better performance
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollViewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    if (!scrollViewport) return;

    let throttleTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Completely ignore scroll events when disabled
      if (scrollEventDisabled.current) return;

      if (throttleTimer) return;

      // More aggressive throttling during loading or restoration
      const throttleDelay =
        loadingOlder || loadingNewer || isRestoringScrollPosition ? 100 : 16;

      throttleTimer = setTimeout(() => {
        // Double-check that events are still enabled
        if (!scrollEventDisabled.current) {
          checkScrollPosition();
        }
        throttleTimer = null;
      }, throttleDelay);
    };

    scrollViewport.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check - delayed if we're in restoration mode
    const initialDelay = isRestoringScrollPosition ? 300 : 100;
    setTimeout(checkScrollPosition, initialDelay);

    return () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
      scrollViewport.removeEventListener("scroll", handleScroll);
    };
  }, [
    checkScrollPosition,
    loadingOlder,
    loadingNewer,
    isRestoringScrollPosition,
  ]);

  // Scroll to bottom function
  // const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
  //   bottomRef.current?.scrollIntoView({ behavior });
  // }, []);

  // Manual load functions
  // const handleLoadOlder = useCallback(async () => {
  //   if (loadingOlder || !hasMoreOlder) return;

  //   const container = scrollContainerRef.current;
  //   if (!container) return;
  //
  //   const scrollViewport = container.querySelector(
  //     "[data-radix-scroll-area-viewport]",
  //   ) as HTMLElement;
  //   if (!scrollViewport) return;
  //
  //   // Store current scroll position for manual loads too
  //   const prevScrollHeight = scrollViewport.scrollHeight;
  //   const prevScrollTop = scrollViewport.scrollTop;
  //
  //   await onLoadOlder();
  //
  //   // Restore scroll position after messages load
  //   requestAnimationFrame(() => {
  //     const newScrollHeight = scrollViewport.scrollHeight;
  //     const heightDiff = newScrollHeight - prevScrollHeight;
  //     scrollViewport.scrollTop = prevScrollTop + heightDiff;
  //   });
  // }, [loadingOlder, hasMoreOlder, onLoadOlder]);
  //
  // // const handleLoadNewer = useCallback(async () => {
  // //   if (loadingNewer || !hasMoreNewer) return;
  // //   await onLoadNewer();
  // // }, [loadingNewer, hasMoreNewer, onLoadNewer]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(undefined);
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
        <ScrollArea ref={scrollContainerRef} className="h-full">
          <div className="px-4 py-4 space-y-4">
            {/* Load More Older Messages Button */}
            {/* {showLoadMoreButtons && hasMoreOlder && ( */}
            {/*   <div className="flex justify-center py-2"> */}
            {/*     <Button */}
            {/*       variant="outline" */}
            {/*       size="sm" */}
            {/*       onClick={handleLoadOlder} */}
            {/*       disabled={loadingOlder} */}
            {/*       className="text-xs gap-1" */}
            {/*     > */}
            {/*       {loadingOlder ? ( */}
            {/*         <Skeleton className="w-4 h-4 rounded-full" /> */}
            {/*       ) : ( */}
            {/*         <ArrowUp className="w-3 h-3" /> */}
            {/*       )} */}
            {/*       {loadingOlder ? "Loading..." : "Load older messages"} */}
            {/*     </Button> */}
            {/*   </div> */}
            {/* )} */}
            {/**/}
            {/* Loading indicator for older messages */}
            {loadingOlder && messages.length > 0 && (
              <div className="absolute top-0 inset-x-0 flex justify-center py-2">
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

            {/* Messages grouped by date */}
            <div className="space-y-0 md:space-y-4">
              <p>This is the beginning of the conversation.</p>
            </div>
            {messageGroups.map((group) => (
              <div key={`group-${group.date.toISOString()}`}>
                {/* Date separator */}
                <DateSeparator dateLabel={group.dateLabel} />

                {/* Messages in this date group */}
                {group.messages.map((message) => {
                  const isTargetMessage = message._id === targetMessageId;
                  return (
                    <div
                      key={message._id}
                      ref={isTargetMessage ? targetMessageRef : undefined}
                      data-message-id={message._id}
                      className={cn(
                        isTargetMessage &&
                          !disableHighlight && [
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
                        onReply={handleReply}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Loading indicator for newer messages */}
            {loadingNewer && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="absolute bottom-2 inset-x-0 flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  Loading newer messages...
                </div>
              </div>
            )}

            {/* Load More Newer Messages Button */}
            {/* {showLoadMoreButtons && hasMoreNewer && ( */}
            {/*   <div className="flex justify-center py-2"> */}
            {/*     <Button */}
            {/*       variant="outline" */}
            {/*       size="sm" */}
            {/*       onClick={handleLoadNewer} */}
            {/*       disabled={loadingNewer} */}
            {/*       className="text-xs gap-1" */}
            {/*     > */}
            {/*       {loadingNewer ? ( */}
            {/*         <Skeleton className="w-4 h-4 rounded-full" /> */}
            {/*       ) : ( */}
            {/*         <ArrowDown className="w-3 h-3" /> */}
            {/*       )} */}
            {/*       {loadingNewer ? "Loading..." : "Load newer messages"} */}
            {/*     </Button> */}
            {/*   </div> */}
            {/* )} */}
            {/**/}
            {/* Scroll target */}
            <div ref={bottomRef} className="h-px" />
          </div>
        </ScrollArea>

        {/* Floating Action Buttons */}
        {/* <div className="absolute top-4 left-4 z-10 space-y-2"> */}
        {/*   {hasTargetMessage && hasScrolledToTarget && ( */}
        {/*     <Button */}
        {/*       variant="secondary" */}
        {/*       size="sm" */}
        {/*       onClick={() => { */}
        {/*         // Scroll to target with smooth animation */}
        {/*         scrollToTargetMessage("smooth"); */}
        {/*       }} */}
        {/*     > */}
        {/*       <ChevronUp className="w-3 h-3" /> */}
        {/*       Go to linked message */}
        {/*     </Button> */}
        {/*   )} */}
        {/* </div> */}

        {/* Jump to new messages button - hide during scroll position restoration */}
        {hasNewMessages && !isRestoringScrollPosition && !loadingOlder && (
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

        {/* Scroll to bottom button - hide during scroll position restoration */}
        {shouldShowScrollButton &&
          !hasNewMessages &&
          !isRestoringScrollPosition &&
          !loadingOlder && (
            <div className="absolute bottom-0 right-4 z-10">
              <BottomScroll bottomRef={bottomRef} />
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
