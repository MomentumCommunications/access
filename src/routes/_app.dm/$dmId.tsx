import { SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { MessageSquare, OctagonMinus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { ChatWindow } from "~/components/chat-window";
import { useChatMessages } from "~/hooks/useChatMessages";

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
  const user = useUser();
  const channelId = params.dmId as Id<"channels">;
  const messageId = search.messageId as Id<"messages"> | undefined;

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user?.user?.id }),
  );

  const { data: channel } = useQuery(
    convexQuery(api.channels.getChannel, { id: channelId }),
  );

  const { data: channelMembers } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channel?._id }),
  );

  // Use the new chat messages hook
  const {
    messages,
    isLoading: messagesLoading,
    isLoadingOlder,
    hasMoreOlder,
    loadOlderMessages,
  } = useChatMessages({
    channelId,
    targetMessageId: messageId,
    initialLimit: 50,
  });

  const disableHighlight = search.messageId === undefined;

  const dmName = channelMembers
    ?.filter((m) => m?._id !== convexUser?._id)
    .map((m) => m?.displayName || m?.name)
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
    <div className="h-[calc(100vh-54px)] flex flex-col">
      <div className="flex align-middle flex-row py-2 px-4 justify-between">
        <div className="flex flex-row gap-3 items-center align-middle">
          <MessageSquare color="#ce2128" />
          <h1 className="text-2xl font-bold">{dmName}</h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full min-h-0 relative">
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

        {/* Chat Window */}
        {user && convexUser && (
          <ChatWindow
            messages={messages}
            onLoadOlder={loadOlderMessages}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={isLoadingOlder}
            userId={convexUser._id}
            channelId={channelId}
            targetMessageId={messageId}
            isLoading={messagesLoading}
            channel={{ isDM: true }}
            adminControlled={false}
            disableHighlight={disableHighlight}
          />
        )}
      </div>
    </div>
  );
}
