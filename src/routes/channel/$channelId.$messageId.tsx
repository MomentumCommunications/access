import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Cog, OctagonMinus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "~/components/header";
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
import { channelNameOrFallback } from "~/lib/utils";
import { DeleteChannelButton } from "~/components/channel-delete-button";
import { ManageMembers } from "~/components/manage-members";
import { 
  Message, 
  mergeMessages,
  mergeOlderMessages,
  mergeNewerMessages,
  getOldestMessageTime,
  getNewestMessageTime,
  areMessageArraysEqual,
  MessageContext,
  BidirectionalPaginationState
} from "~/lib/message-utils";

const fetchMessageContext = (messageId: Id<"messages">, contextSize?: number) => {
  return convexQuery(api.messages.getMessageContext, { messageId, contextSize });
};

export const Route = createFileRoute("/channel/$channelId/$messageId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const router = useRouter();
  const convex = useConvex();
  const user = useUser();
  
  const channelId = params.channelId as Id<"channels">;
  const messageId = params.messageId as Id<"messages">;

  // Core queries
  const { data: messageContext, isLoading: contextLoading, error: contextError } = useQuery(
    fetchMessageContext(messageId, 15) // Load 15 messages before and after
  );

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user?.user?.id }),
  );

  const { data: channel } = useQuery(
    convexQuery(api.channels.getChannel, { id: channelId }),
  );

  const { data: channelMembers } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channel?._id }),
  );

  // State for bidirectional pagination
  const [messageArray, setMessages] = useState<Message[]>([]);
  const [paginationState, setPaginationState] = useState<BidirectionalPaginationState>({
    canLoadOlder: true,
    canLoadNewer: true,
    loadingOlder: false,
    loadingNewer: false,
    targetMessageId: messageId,
    hasScrolledToTarget: false,
  });

  // Initialize messages from context
  useEffect(() => {
    if (messageContext?.messages && messageArray.length === 0) {
      setMessages(messageContext.messages);
      // Estimate if we can load more based on context size
      const contextSize = 15;
      setPaginationState(prev => ({
        ...prev,
        canLoadOlder: messageContext.messages.length > contextSize,
        canLoadNewer: messageContext.messages.length > contextSize,
      }));
    }
  }, [messageContext, messageArray.length]);

  // Handle real-time message updates
  const { data: latestMessages } = useQuery(
    convexQuery(api.messages.getMessagesByChannel, { channel: channelId })
  );

  // Merge real-time updates with existing messages
  const orderedMessages = useMemo(() => {
    if (!latestMessages?.length) return messageArray;
    
    if (messageArray.length === 0) {
      return latestMessages;
    }
    
    // Only merge if there are actually new messages
    const merged = mergeMessages(messageArray, latestMessages);
    return merged;
  }, [latestMessages, messageArray]);

  // Update state when messages change
  useEffect(() => {
    if (orderedMessages.length > 0 && !areMessageArraysEqual(messageArray, orderedMessages)) {
      setMessages(orderedMessages);
    }
  }, [orderedMessages, messageArray]);

  // Load older messages (bidirectional pagination upward)
  const loadOlderMessages = useCallback(async () => {
    if (paginationState.loadingOlder || !paginationState.canLoadOlder) return;

    setPaginationState(prev => ({ ...prev, loadingOlder: true }));

    try {
      const oldestMessage = messageArray[0];
      if (!oldestMessage) return;

      const olderMessages = await convex.query(api.messages.getMessagesBeforeMessage, {
        messageId: oldestMessage._id,
        limit: 20,
      });

      if (olderMessages.length > 0) {
        setMessages(prev => mergeOlderMessages(prev, olderMessages));
      }

      setPaginationState(prev => ({
        ...prev,
        canLoadOlder: olderMessages.length === 20,
      }));
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setPaginationState(prev => ({ ...prev, loadingOlder: false }));
    }
  }, [convex, messageArray, paginationState.loadingOlder, paginationState.canLoadOlder]);

  // Load newer messages (bidirectional pagination downward)
  const loadNewerMessages = useCallback(async () => {
    if (paginationState.loadingNewer || !paginationState.canLoadNewer) return;

    setPaginationState(prev => ({ ...prev, loadingNewer: true }));

    try {
      const newestMessage = messageArray[messageArray.length - 1];
      if (!newestMessage) return;

      const newerMessages = await convex.query(api.messages.getMessagesAfterMessage, {
        messageId: newestMessage._id,
        limit: 20,
      });

      if (newerMessages.length > 0) {
        setMessages(prev => mergeNewerMessages(prev, newerMessages));
      }

      setPaginationState(prev => ({
        ...prev,
        canLoadNewer: newerMessages.length === 20,
      }));
    } catch (error) {
      console.error("Failed to load newer messages:", error);
    } finally {
      setPaginationState(prev => ({ ...prev, loadingNewer: false }));
    }
  }, [convex, messageArray, paginationState.loadingNewer, paginationState.canLoadNewer]);

  // Error handling
  if (contextError) {
    return (
      <>
        <Header
          currentPage="Message Not Found"
          breadcrumbs={[
            { title: "Home", url: "/" },
            { title: "Channel", url: "/channel" },
          ]}
        />
        <div className="h-[calc(100vh-64px)] flex items-center justify-center px-4">
          <Alert className="max-w-sm">
            <OctagonMinus color="red" />
            <AlertTitle>Message Not Found</AlertTitle>
            <AlertDescription>
              This message doesn't exist or you don't have permission to view it.
              <div className="py-2">
                <Button asChild className="w-min cursor-pointer">
                  <a href="/">Go Home</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  // Loading state
  if (!user || !convexUser || !channel || contextLoading) {
    return (
      <>
        <Header
          currentPage="Loading..."
          breadcrumbs={[
            { title: "Home", url: "/" },
            { title: "Channel", url: "/channel" },
          ]}
        />
        <div className="h-[calc(100vh-64px)] flex items-center justify-center">
          <div>Loading message context...</div>
        </div>
      </>
    );
  }

  // Permission check
  if (
    channel?.isPrivate &&
    !channelMembers?.some((m) => m?._id === convexUser._id)
  ) {
    return (
      <>
        <Header
          currentPage={channelNameOrFallback(channel.name)}
          breadcrumbs={[
            { title: "Home", url: "/" },
            { title: "Channel", url: "/channel" },
          ]}
        />
        <div className="h-[calc(100vh-64px)] flex items-center justify-center px-4">
          <Alert className="max-w-sm">
            <OctagonMinus color="red" />
            <AlertTitle>Restricted</AlertTitle>
            <AlertDescription>
              You are not a member of this channel.
              <div className="py-2">
                <Button asChild className="w-min cursor-pointer">
                  <a href="/">Go Home</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <Header
        currentPage={`${channelNameOrFallback(channel.name)} - Message Link`}
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Channel", url: "/channel" },
          { title: channelNameOrFallback(channel.name), url: `/channel/${channelId}` },
        ]}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        <SignedIn>
          {/* Channel Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute top-4 right-4 z-20 bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors"
              >
                <Cog className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Channel Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => router.navigate({ to: `/channel/${channelId}` })}
              >
                View Full Channel
              </DropdownMenuItem>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <ManageMembers channelId={channel._id} />
              </DropdownMenuItem>
              <DeleteChannelButton channelId={channel._id} />
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Contextual Chat Window */}
          <ContextualChatWindow
            messages={messageArray}
            onLoadOlder={loadOlderMessages}
            onLoadNewer={loadNewerMessages}
            loadingOlder={paginationState.loadingOlder}
            loadingNewer={paginationState.loadingNewer}
            hasMoreOlder={paginationState.canLoadOlder}
            hasMoreNewer={paginationState.canLoadNewer}
            userId={convexUser._id}
            channelId={channel._id}
            targetMessageId={messageId}
            isLoading={contextLoading}
            className="h-full"
          />
        </SignedIn>
        
        <SignedOut>
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center space-y-4">
              <Alert className="max-w-sm">
                <OctagonMinus color="red" />
                <AlertDescription>
                  You must be signed in to view this message.
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
