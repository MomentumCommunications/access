import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Message } from "~/lib/message-utils";

interface UseChatMessagesProps {
  channelId: Id<"channels">;
  targetMessageId?: Id<"messages">;
  initialLimit?: number;
}

export function useChatMessages({
  channelId,
  targetMessageId,
  initialLimit = 50,
}: UseChatMessagesProps) {
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const convex = useConvex();

  // Initial messages query
  const {
    data: initialMessages,
    isLoading: isLoadingInitial,
    error,
  } = useQuery({
    ...convexQuery(api.messages.getChatMessages, {
      channelId,
      limit: initialLimit,
    }),
    staleTime: 0, // Always fresh
  });

  // Handle target message context if provided
  const {
    data: messageContext,
    isLoading: isLoadingContext,
  } = useQuery({
    ...convexQuery(api.messages.getMessageContext, {
      messageId: targetMessageId || ("" as Id<"messages">),
      contextSize: 25, // More context for target messages
    }),
    enabled: !!targetMessageId,
    staleTime: 0,
  });

  // Determine which messages to use
  const messages = useMemo(() => {
    if (targetMessageId && messageContext) {
      // If we have a target message, use the context messages
      return messageContext.messages || [];
    }
    return initialMessages || [];
  }, [targetMessageId, messageContext, initialMessages]);

  // Combine with any additional loaded messages
  const combinedMessages = useMemo(() => {
    if (allMessages.length === 0) {
      return messages;
    }
    
    // Merge messages and remove duplicates
    const messageMap = new Map();
    
    // Add existing loaded messages first (older messages)
    allMessages.forEach(msg => messageMap.set(msg._id, msg));
    
    // Add initial/context messages (more recent or contextual)
    messages.forEach(msg => messageMap.set(msg._id, msg));
    
    // Convert back to array and sort by creation time
    return Array.from(messageMap.values()).sort(
      (a, b) => a._creationTime - b._creationTime
    );
  }, [allMessages, messages]);

  // Load older messages function
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreOlder) return;

    setIsLoadingOlder(true);

    try {
      // Get the oldest message timestamp
      const oldestMessage = combinedMessages[0];
      const beforeTime = oldestMessage ? oldestMessage._creationTime : undefined;

      // Use getChatMessages query for loading older messages
      const olderMessages = await convex.query(api.messages.getChatMessages, {
        channelId,
        limit: initialLimit,
        beforeTime,
      });

      if (olderMessages && olderMessages.length > 0) {
        // Add older messages to the beginning of our list
        setAllMessages(prev => {
          const messageMap = new Map();
          
          // Add older messages first
          olderMessages.forEach(msg => messageMap.set(msg._id, msg));
          
          // Add existing messages
          prev.forEach(msg => messageMap.set(msg._id, msg));
          
          return Array.from(messageMap.values()).sort(
            (a, b) => a._creationTime - b._creationTime
          );
        });

        // If we got fewer messages than requested, we've reached the end
        if (olderMessages.length < initialLimit) {
          setHasMoreOlder(false);
        }
      } else {
        // No more messages
        setHasMoreOlder(false);
      }
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, hasMoreOlder, combinedMessages, channelId, initialLimit]);

  return {
    messages: combinedMessages,
    isLoading: isLoadingInitial || isLoadingContext,
    isLoadingOlder,
    hasMoreOlder,
    loadOlderMessages,
    error,
    targetMessageIndex: targetMessageId && messageContext 
      ? messageContext.targetMessageIndex 
      : undefined,
  };
}