import { useCallback, useEffect, useRef } from "react";
import { useConvex } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Message } from "~/lib/message-utils";

interface UseMessageReadTrackingProps {
  messages: Message[];
  userId: Id<"users">;
  channelId: Id<"channels"> | string;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  enabled?: boolean;
}

export function useMessageReadTracking({
  messages,
  userId,
  channelId,
  scrollContainerRef,
  enabled = true,
}: UseMessageReadTrackingProps) {
  const convex = useConvex();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const messageElementsRef = useRef<Map<string, Element>>(new Map());

  const markMessageAsRead = useCallback(
    (messageId: Id<"messages">) => {
      if (!enabled) return;
      
      convex.mutation(api.messages.markMessageAsRead, {
        messageId,
        userId,
        channelId,
      }).catch(error => {
        console.error("Failed to mark message as read:", error);
      });
    },
    [convex, userId, channelId, enabled]
  );

  // Setup intersection observer for viewport tracking
  useEffect(() => {
    if (!enabled || !scrollContainerRef.current) return;

    const scrollViewport = scrollContainerRef.current.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;

    if (!scrollViewport) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Message is more than 50% visible
            const messageId = entry.target.getAttribute("data-message-id");
            if (messageId) {
              markMessageAsRead(messageId as Id<"messages">);
            }
          }
        });
      },
      {
        root: scrollViewport,
        rootMargin: "0px",
        threshold: 0.5, // Trigger when message is 50% visible
      }
    );

    // Observe all message elements
    messageElementsRef.current.forEach((element) => {
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [scrollContainerRef, markMessageAsRead, enabled]);

  // Register message element for observation
  const registerMessageElement = useCallback(
    (messageId: string, element: Element | null) => {
      if (!element) {
        messageElementsRef.current.delete(messageId);
        return;
      }

      messageElementsRef.current.set(messageId, element);

      // Add data attribute for identification
      element.setAttribute("data-message-id", messageId);

      // If observer exists, start observing this element
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    },
    []
  );

  // Mark messages as read when they first become visible (for already rendered messages)
  useEffect(() => {
    if (!enabled || messages.length === 0) return;

    // Use a timeout to ensure DOM has settled
    const timeoutId = setTimeout(() => {
      messages.forEach((message) => {
        const element = messageElementsRef.current.get(message._id);
        if (element && observerRef.current) {
          // Check if element is already in viewport
          const scrollViewport = scrollContainerRef.current?.querySelector(
            "[data-radix-scroll-area-viewport]"
          ) as HTMLElement;
          
          if (scrollViewport) {
            const elementRect = element.getBoundingClientRect();
            const viewportRect = scrollViewport.getBoundingClientRect();
            
            const isVisible = 
              elementRect.top < viewportRect.bottom &&
              elementRect.bottom > viewportRect.top &&
              elementRect.left < viewportRect.right &&
              elementRect.right > viewportRect.left;

            if (isVisible) {
              markMessageAsRead(message._id);
            }
          }
        }
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [messages, markMessageAsRead, enabled, scrollContainerRef]);

  return {
    registerMessageElement,
  };
}