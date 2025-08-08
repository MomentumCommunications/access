import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Cog, OctagonMinus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { SignInPrompt } from "~/components/sign-in-prompt";
import { channelNameOrFallback } from "~/lib/utils";
import { DeleteChannelButton } from "~/components/channel-delete-button";
import { ManageMembers } from "~/components/manage-members";

const fetchMessages = (channel: string) => {
  return convexQuery(api.messages.getMessagesByChannel, { channel });
};

type Message = {
  _id: Id<"messages">;
  _creationTime: number;
  body: string;
  date?: string;
  author: Id<"users">;
  image?: string;
  format?: string;
  channel: string;
  reactions?: string;
  edited?: boolean;
};

export const Route = createFileRoute("/channel/$channelId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const convex = useConvex();
  const user = useUser();
  const channelId = params.channelId as Id<"channels">;

  // Queries (must be declared unconditionally)
  const { data: messages, isLoading: messagesLoading } = useQuery(
    fetchMessages(channelId),
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

  // Pagination state
  const [messageArray, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Initialize messages once
  useEffect(() => {
    if (!messagesLoading && messages?.length) {
      setMessages(messages);
      scrollToBottom();
    }
  }, [messages, messagesLoading]);

  // Scroll to bottom
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load older messages
  const loadMore = async () => {
    if (loading || !hasMore) return;
    if (!channelId) return;

    console.log("loading more");

    const container = scrollContainerRef.current;
    if (!container) return;

    setLoading(true);

    const beforeId = messageArray[0]?._id;

    // Store scroll height before loading more
    const prevScrollHeight = container.scrollHeight;

    const olderMessages = await convex.query(api.messages.getOlderMessages, {
      channelId,
      beforeId,
      limit: 20,
    });

    setMessages((prev) => [...olderMessages, ...prev]);
    setHasMore(olderMessages.length === 20);
    setLoading(false);

    // Adjust scrollTop to maintain position after messages are prepended
    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      const heightDiff = newScrollHeight - prevScrollHeight;
      container.scrollTop += heightDiff;
    });
  };

  // Scroll event to trigger loadMore
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 20 && !loading && hasMore) {
        loadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [loading, hasMore, messageArray]);

  if (!user || !convexUser || !channel) return null;
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
            { title: "Channel", url: "/Channel" },
          ]}
        />
        <div className="w-full h-[calc(100vh-46px)] px-4 flex items-center justify-center">
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
    <>
      <Header
        currentPage={channelNameOrFallback(channel.name)}
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "channel", url: "/channel" },
        ]}
      />
      <div className="flex relative h-[calc(100vh+130px)] sm:h-[calc(100vh-46px)] md:h-[calc(100vh-64px)] overflow-visible md:pt-4 px-4 justify-end flex-col relative">
        <SignedIn>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="absolute -top-4 right-4 z-10">
                <Cog />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Channel Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <ManageMembers channelId={channel._id} />
              </DropdownMenuItem>
              <DeleteChannelButton channelId={channel._id} />
            </DropdownMenuContent>
          </DropdownMenu>
          <ScrollArea
            ref={scrollContainerRef}
            className="flex-grow flex flex-col items-end overflow-auto px-4 overscroll-none"
          >
            {messages?.length === 0 && (
              <div className="w-full h-full flex items-center justify-center">
                <Alert className="max-w-sm">
                  <AlertDescription>No messages yet...</AlertDescription>
                </Alert>
              </div>
            )}
            {messagesLoading ? (
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
                  channelId={channel._id}
                />
              ))
            )}
            <div className="h-22"></div>
            <div id="bottom" ref={bottomRef}></div>
          </ScrollArea>
          {channel && (
            <div className="absolute inset-x-0 bottom-0 bg-background z-20 px-4 pb-4">
              <BottomScroll bottomRef={bottomRef} />
              <MessageInput userId={convexUser._id} channel={channel._id} />
            </div>
          )}
        </SignedIn>
        <SignedOut>
          <Alert className="max-w-sm">
            <OctagonMinus color="red" />
            <AlertDescription>
              You must be signed in to view this channel.
            </AlertDescription>
          </Alert>
          <SignInPrompt />
        </SignedOut>
      </div>
    </>
  );
}
