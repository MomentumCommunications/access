import { SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { MessageSquare, OctagonMinus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatWindow } from "~/components/chat-window";
import { ContextualChatWindow } from "~/components/contextual-chat-window";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { channelNameOrFallback } from "~/lib/utils";
import {
  Message,
  mergeMessages,
  mergeOlderMessages,
  mergeNewerMessages,
  getOldestMessageTime,
  areMessageArraysEqual,
  BidirectionalPaginationState,
} from "~/lib/message-utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";

const fetchMessages = (channel: string) => {
  return convexQuery(api.messages.getMessagesByChannel, { channel });
};


export const Route = createFileRoute("/_app/dm/$dmId")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      messageId: search.messageId as string | undefined,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const convex = useConvex();
  const user = useUser();
  const channelId = params.dmId as Id<"channels">;
  const messageId = search.messageId as Id<"messages"> | undefined;

  console.log("channelId:", channelId, "messageId from search:", messageId);

  // Queries (must be declared unconditionally)
  const { data: messages, isLoading: messagesLoading } = useQuery(
    fetchMessages(channelId),
  );

  // Contextual message query (only when messageId is present)
  const {
    data: messageContext,
    isLoading: contextLoading,
    error: contextError,
  } = useQuery({
    ...convexQuery(api.messages.getMessageContext, {
      messageId: messageId || ("" as Id<"messages">),
      contextSize: 15,
    }),
    enabled: !!messageId,
  });

  console.log("messageContext data:", messageContext);

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user?.user?.id }),
  );

  const { data: channel } = useQuery(
    convexQuery(api.channels.getChannel, { id: channelId }),
  );

  const { data: channelMembers } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channel?._id }),
  );

  // Regular pagination state
  const [messageArray, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Contextual chat state (when messageId is provided)
  const [contextualMessageArray, setContextualMessages] = useState<Message[]>(
    [],
  );
  const [contextualPaginationState, setContextualPaginationState] =
    useState<BidirectionalPaginationState>({
      canLoadOlder: true,
      canLoadNewer: true,
      loadingOlder: false,
      loadingNewer: false,
      targetMessageId: messageId || ("" as Id<"messages">),
      hasScrolledToTarget: false,
    });

  // Initialize contextual messages when messageContext loads
  useEffect(() => {
    if (messageContext?.messages && messageId) {
      console.log("Initializing contextual messages:", messageContext.messages);
      setContextualMessages(messageContext.messages);
      setContextualPaginationState((prev) => ({
        ...prev,
        targetMessageId: messageId as Id<"messages">,
        hasScrolledToTarget: false,
      }));
    }
  }, [messageContext, messageId]);

  // Properly merge messages from TanStack Query with chronological ordering
  const orderedMessages = useMemo(() => {
    if (!messages?.length) return [];

    if (messageArray.length === 0) {
      // Initial load - messages from DB are already sorted
      return messages;
    } else {
      // Handle real-time updates - properly merge and sort
      return mergeMessages(messageArray, messages);
    }
  }, [messages, messageArray]);

  // Update state only when messages actually change
  useEffect(() => {
    if (
      orderedMessages.length > 0 &&
      !areMessageArraysEqual(messageArray, orderedMessages)
    ) {
      setMessages(orderedMessages);
    }
  }, [orderedMessages, messageArray]);

  // Load older messages with proper chronological handling
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !channelId) return;

    setLoading(true);
    const beforeTime = getOldestMessageTime(messageArray);

    try {
      const olderMessages = await convex.query(api.messages.getOlderMessages, {
        channelId,
        beforeTime,
        limit: 20,
      });

      if (olderMessages.length > 0) {
        // Use proper merge function to maintain chronological order
        setMessages((prev) => mergeOlderMessages(prev, olderMessages));
      }

      // Update hasMore based on whether we got a full page
      setHasMore(olderMessages.length === 20);
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setLoading(false);
    }
  }, [convex, channelId, messageArray, loading, hasMore]);

  // Bidirectional pagination functions for contextual chat
  const loadOlderContextualMessages = useCallback(async () => {
    if (
      contextualPaginationState.loadingOlder ||
      !contextualPaginationState.canLoadOlder ||
      !messageId
    ) {
      return;
    }

    setContextualPaginationState((prev) => ({ ...prev, loadingOlder: true }));

    try {
      // Find the oldest message in our current contextual array
      const oldestMessage = contextualMessageArray[0];
      if (!oldestMessage) return;

      const olderMessages = await convex.query(
        api.messages.getMessagesBeforeMessage,
        {
          messageId: oldestMessage._id,
          limit: 15,
        },
      );

      if (olderMessages.length > 0) {
        setContextualMessages((prev) =>
          mergeOlderMessages(prev, olderMessages),
        );
        setContextualPaginationState((prev) => ({
          ...prev,
          canLoadOlder: olderMessages.length === 15,
        }));
      } else {
        setContextualPaginationState((prev) => ({
          ...prev,
          canLoadOlder: false,
        }));
      }
    } catch (error) {
      console.error("Failed to load older contextual messages:", error);
    } finally {
      setContextualPaginationState((prev) => ({
        ...prev,
        loadingOlder: false,
      }));
    }
  }, [
    convex,
    contextualMessageArray,
    contextualPaginationState.loadingOlder,
    contextualPaginationState.canLoadOlder,
    messageId,
  ]);

  const loadNewerContextualMessages = useCallback(async () => {
    if (
      contextualPaginationState.loadingNewer ||
      !contextualPaginationState.canLoadNewer ||
      !messageId
    ) {
      return;
    }

    setContextualPaginationState((prev) => ({ ...prev, loadingNewer: true }));

    try {
      // Find the newest message in our current contextual array
      const newestMessage =
        contextualMessageArray[contextualMessageArray.length - 1];
      if (!newestMessage) return;

      const newerMessages = await convex.query(
        api.messages.getMessagesAfterMessage,
        {
          messageId: newestMessage._id,
          limit: 15,
        },
      );

      if (newerMessages.length > 0) {
        setContextualMessages((prev) =>
          mergeNewerMessages(prev, newerMessages),
        );
        setContextualPaginationState((prev) => ({
          ...prev,
          canLoadNewer: newerMessages.length === 15,
        }));
      } else {
        setContextualPaginationState((prev) => ({
          ...prev,
          canLoadNewer: false,
        }));
      }
    } catch (error) {
      console.error("Failed to load newer contextual messages:", error);
    } finally {
      setContextualPaginationState((prev) => ({
        ...prev,
        loadingNewer: false,
      }));
    }
  }, [
    convex,
    contextualMessageArray,
    contextualPaginationState.loadingNewer,
    contextualPaginationState.canLoadNewer,
    messageId,
  ]);

  // Generate DM name from other participants
  const dmName = channelMembers
    ?.filter((m) => m?._id !== convexUser?._id)
    .map((m) => m?.displayName)
    .filter(Boolean)
    .join(", ");

  // Don't render anything while loading essential data
  if (!user || !convexUser || !channel) return null;

  // Check if user has access to private DM
  if (
    channel?.isPrivate &&
    !channelMembers?.some((m) => m?._id === convexUser._id)
  ) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <Alert className="max-w-sm">
          <OctagonMinus color="red" />
          <AlertTitle>Restricted</AlertTitle>
          <AlertDescription>
            You are not a member of this conversation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex align-middle flex-row py-2 px-4 justify-between">
        <div className="flex flex-row gap-3 items-center align-middle">
          <MessageSquare color="#ce2128" />
          <h1 className="text-2xl font-bold">{dmName}</h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-0 relative">
        {/* Chat Window - Conditional rendering based on messageId */}
        {messageId ? (
          <ContextualChatWindow
            messages={contextualMessageArray}
            onLoadOlder={loadOlderContextualMessages}
            onLoadNewer={loadNewerContextualMessages}
            loadingOlder={contextualPaginationState.loadingOlder}
            loadingNewer={contextualPaginationState.loadingNewer}
            hasMoreOlder={contextualPaginationState.canLoadOlder}
            hasMoreNewer={contextualPaginationState.canLoadNewer}
            userId={convexUser._id}
            channelId={channel._id}
            targetMessageId={messageId as Id<"messages">}
            isLoading={contextLoading}
            className="h-full w-full"
            channel={channel}
          />
        ) : (
          <ChatWindow
            messages={messageArray}
            onLoadMore={loadMore}
            loading={loading}
            hasMore={hasMore}
            userId={convexUser._id}
            channelId={channel._id}
            isLoading={messagesLoading}
            className="h-full w-full"
            channel={channel}
          />
        )}

        <SignedOut>
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center space-y-4">
              <Alert className="max-w-sm">
                <OctagonMinus color="red" />
                <AlertDescription>
                  You must be signed in to view this conversation.
                </AlertDescription>
              </Alert>
              <SignInPrompt />
            </div>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}
