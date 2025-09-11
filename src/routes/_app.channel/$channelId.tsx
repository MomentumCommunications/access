import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import {
  Cog,
  DotIcon,
  Hash,
  Info,
  LockIcon,
  OctagonMinus,
  ShieldOff,
} from "lucide-react";
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
import { DeleteChannelButton } from "~/components/channel-delete-button";
import { LazyManageMembers } from "~/components/lazy/AdminComponents";
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
import LazyChatWindow from "~/components/lazy/ChatWindow";
import { useChatMessages } from "~/hooks/useChatMessages";
import Delayed from "~/components/delayed";

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
  const user = useUser();
  const channelId = params.channelId as Id<"channels">;
  const messageId = search.messageId as Id<"messages"> | undefined;
  const isMobile = useIsMobile();

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

  // Don't render anything while loading essential data
  if (!channel) return null;

  if (!user || !convexUser)
    return (
      <Delayed>
        <div className="flex h-[calc(100vh-64px)] max-w-4xl mx-auto items-center justify-center px-4">
          <Alert variant="default">
            <ShieldOff />
            <AlertTitle>Hold up!</AlertTitle>
            <AlertDescription>
              You must be signed in to access this channel.
              <div className="flex gap-2 py-2">
                <Button
                  asChild
                  variant="outline"
                  className="w-min cursor-pointer text-foreground"
                >
                  <a href="/sign-in">Sign in</a>
                </Button>
                <Button asChild className="w-min cursor-pointer">
                  <a href="/sign-up">Sign up</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </Delayed>
    );

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
      <div className="flex align-middle flex-row py-2 px-2 md:px-4 justify-between">
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
                  <LazyManageMembers channelId={channel._id} />
                </DropdownMenuItem>
              )}
              <DeleteChannelButton channelId={channel._id} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full min-h-0 relative">
        {user && convexUser && (
          <LazyChatWindow
            messages={messages}
            onLoadOlder={loadOlderMessages}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={isLoadingOlder}
            userId={convexUser._id}
            channelId={channelId}
            targetMessageId={messageId}
            isLoading={messagesLoading}
            channel={{ isDM: false }}
            adminControlled={channel?.adminControlled}
            disableHighlight={disableHighlight}
          />
        )}
      </div>
    </div>
  );
}
