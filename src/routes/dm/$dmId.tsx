import { SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { OctagonMinus } from "lucide-react";
import { useEffect, useRef } from "react";
import { BottomScroll } from "~/components/bottom-scroll";
import { Header } from "~/components/header";
import { MessageComponent } from "~/components/message-component";
import { MessageInput } from "~/components/message-input";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { channelNameOrFallback } from "~/lib/utils";

const fetchMessages = (channel: string) => {
  return convexQuery(api.messages.getMessagesByChannel, { channel });
};

export const Route = createFileRoute("/dm/$dmId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const user = useUser();

  if (!user) return null;

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
  );

  const channelId = params.dmId as Id<"channels">;

  const { data: channel } = useQuery(
    convexQuery(api.channels.getChannel, { id: channelId }),
  );

  const { data: channelMembers } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channel?._id }),
  );

  const dmName = channelMembers
    ?.filter((m) => m?._id !== convexUser?._id)
    .map((m) => m?.displayName)
    .filter(Boolean)
    .join(", ");

  const { data: messages, isLoading } = useQuery(fetchMessages(channelId));

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!convexUser) return null;

  if (!channel) return null;

  if (
    channel?.isPrivate &&
    !channelMembers?.some((m) => m?._id === convexUser._id)
  ) {
    return (
      <>
        <Header
          currentPage={channelNameOrFallback(dmName)}
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
        currentPage={channelNameOrFallback(dmName)}
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Direct Message", url: "/channel" },
        ]}
      />
      <div className="flex relative h-[calc(100vh+130px)] sm:h-[calc(100vh-46px)] md:h-[calc(100vh-72px)] overflow-visible md:pt-4 px-4 justify-end flex-col relative">
        <ScrollArea className="flex-grow flex flex-col items-end overflow-auto px-4 overscroll-none">
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
                channelId={channel._id}
                message={m}
                userId={convexUser._id}
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
