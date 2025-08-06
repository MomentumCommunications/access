import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Cog, OctagonMinus } from "lucide-react";
import { useRef } from "react";
import { BottomScroll } from "~/components/bottom-scroll";
import { Header } from "~/components/header";
import { MessageComponent } from "~/components/message-component";
import { MessageInput } from "~/components/message-input";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";

const fetchMessages = (channel: string) => {
  return convexQuery(api.messages.getMessagesByChannel, { channel });
};

export const Route = createFileRoute("/channel/$channel")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const user = useUser();

  if (!user) return null;

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
  );

  const channelId = params.channel as Id<"channels">;

  const { data: channel } = useQuery(
    convexQuery(api.channels.getChannel, { id: channelId }),
  );

  const { data: channelMembers } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channel?._id }),
  );

  const { data: messages, isLoading } = useQuery(fetchMessages(channelId));

  const bottomRef = useRef<HTMLDivElement>(null);

  if (!convexUser) return null;

  if (!channel) return null;

  if (
    channel?.isPrivate &&
    !channelMembers?.some((m) => m?._id === convexUser._id)
  ) {
    return (
      <>
        <Header
          currentPage={channel.name}
          breadcrumbs={[
            { title: "Home", url: "/" },
            { title: "Channel", url: "/Channel" },
          ]}
        />
        <div className="w-full h-[calc(100vh-46px)] px-4 flex items-center justify-center">
          <Alert className="max-w-sm">
            <OctagonMinus color="red" />
            <AlertTitle>Restricted</AlertTitle>
            <AlertDescription>
              You are not a member of this channel.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        currentPage={channel.name}
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "channel", url: "/channel" },
        ]}
      />
      <div className="flex h-[calc(100vh+148px)] sm:h-[calc(100vh-46px)] md:h-[calc(100vh-64px)] overflow-visible md:pt-4 px-4 justify-end flex-col relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="absolute -top-4 right-4">
              <Cog />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Channel Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Add Members</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ScrollArea className="flex-grow flex flex-col items-end overflow-auto px-4 overscroll-none p-2">
          {messages?.length === 0 && (
            <div className="w-full h-full flex items-center justify-center">
              <Alert className="max-w-sm">
                <AlertDescription>No messages yet...</AlertDescription>
              </Alert>
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="w-full h-24" />
              <Skeleton className="w-full h-24" />
              <Skeleton className="w-full h-24" />
            </div>
          ) : (
            messages?.map((m) => (
              <MessageComponent
                key={m._id}
                message={m}
                userId={convexUser._id}
              />
            ))
          )}
          <div id="bottom" ref={bottomRef}></div>
          <BottomScroll bottomRef={bottomRef} />
        </ScrollArea>
        {channel && (
          <MessageInput userId={convexUser._id} channel={channel._id} />
        )}
      </div>
    </>
  );
}
