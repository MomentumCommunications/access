import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Cog, DotIcon, Hash, Info, LockIcon, OctagonMinus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatWindow } from "~/components/chat-window";
import { ContextualChatWindow } from "~/components/contextual-chat-window";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { DeleteChannelButton } from "~/components/channel-delete-button";
import { ManageMembers } from "~/components/manage-members";
import {
  Message,
  mergeMessages,
  mergeOlderMessages,
  mergeNewerMessages,
  getOldestMessageTime,
  areMessageArraysEqual,
  BidirectionalPaginationState,
} from "~/lib/message-utils";
import { EditChannel } from "~/components/edit-channel";
import { channelNameOrFallback } from "~/lib/utils";
import { useIsMobile } from "~/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

const fetchMessages = (channel: string) => {
  return convexQuery(api.messages.getMessagesByChannel, { channel });
};

const fetchMessageContext = (
  messageId: Id<"messages">,
  contextSize?: number,
) => {
  return convexQuery(api.messages.getMessageContext, {
    messageId,
    contextSize,
  });
};

export const Route = createFileRoute("/_app/channel/$channelId")({
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
  const channelId = params.channelId as Id<"channels">;
  const messageId = search.messageId as Id<"messages"> | undefined;
  const isMobile = useIsMobile();

  // Queries (must be declared unconditionally)
  const { data: messages, isLoading: messagesLoading } = useQuery(
    fetchMessages(channelId),
  );

  // Contextual message query (only when messageId is present)
  const {
    data: messageContext,
    isLoading: contextLoading,
    // error: contextError
  } = useQuery({
    ...(messageId
      ? fetchMessageContext(messageId as Id<"messages">, 15)
      : { queryKey: ["disabled"], queryFn: () => null }),
    enabled: !!messageId,
  });

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

  // Don't render anything while loading essential data
  if (!user || !convexUser || !channel) return null;

  // Check if user has access to private channel
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
            You are not a member of this channel.
            <div className="py-2">
              <Button asChild className="w-min cursor-pointer">
                <a href="/home">Go Home</a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-54px)] flex flex-col">
      <div className="flex align-middle flex-row py-2 px-4 justify-between">
        <div className="flex flex-row gap-2 items-center align-middle">
          {channel?.isPrivate ? (
            <LockIcon color="#ce2128" className="size-5 md:size-6" />
          ) : (
            <Hash color="#ce2128" className="size-5 md:size-6" />
          )}
          <h1 className="text-md md:text-2xl font-bold">
            {channelNameOrFallback(channel.name)}
          </h1>
          {!isMobile && (
            <div className="pt-1 flex flex-row gap-2 align-middle items-center">
              <DotIcon className="text-muted-foreground" />
              <p className="text-xs align-bottom text-muted-foreground">
                {channel.description}
              </p>
            </div>
          )}
          {isMobile && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost">
                  <Info className="text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Channel Description</DialogTitle>
                </DialogHeader>
                <DialogDescription>{channel.description}</DialogDescription>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {/* Channel Settings Dropdown */}
        {convexUser?.role === "admin" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className=" bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors"
              >
                <Cog className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Channel Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <EditChannel channel={channel} />
              </DropdownMenuItem>
              {channel?.isPrivate && (
                <DropdownMenuItem asChild>
                  <ManageMembers channelId={channel._id} />
                </DropdownMenuItem>
              )}
              <DeleteChannelButton channelId={channel._id} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 w-full relative">
        <SignedIn>
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
              adminControlled={channel.adminControlled}
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
              adminControlled={channel.adminControlled}
            />
          )}
        </SignedIn>

        <SignedOut>
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center space-y-4">
              <Alert className="max-w-sm">
                <OctagonMinus color="red" />
                <AlertDescription>
                  You must be signed in to view this channel.
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
