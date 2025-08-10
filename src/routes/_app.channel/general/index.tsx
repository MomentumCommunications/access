import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useEffect, useRef } from "react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { BottomScroll } from "~/components/bottom-scroll";
import { MessageComponent } from "~/components/message-component";
import { MessageInput } from "~/components/message-input";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";

export const Route = createFileRoute("/_app/channel/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useUser();

  const { data: channelId } = useQuery(
    convexQuery(api.etcFunctions.getChannelIdByName, { name: "general" }),
  );

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user?.id as string }),
  );

  const { data: messages, isLoading } = useQuery(
    convexQuery(api.messages.getGeneralMessages, {}),
  );

  const { data: channel } = useQuery({
    ...convexQuery(api.channels.getChannel, { id: channelId! }),
    enabled: !!channelId,
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Early return after hooks
  if (!convexUser) return null;

  return (
    <>
      <SignedOut>
        <div className="flex fixed inset-0 h-screen px-4 justify-center flex-col">
          <h1 className="text-2xl font-bold">Sign in to chat</h1>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex h-[calc(100vh+148px)] sm:h-[calc(100vh-48px)] md:h-[calc(100vh-64px)] md:pt-4 px-4 justify-end flex-col relative">
          <ScrollArea className="flex-grow overflow-auto px-4 overscroll-none">
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
                  channelId={channelId!}
                  channel={channel}
                />
              ))
            )}
            <div id="bottom" ref={bottomRef}></div>
            <BottomScroll bottomRef={bottomRef} />
          </ScrollArea>
          {channelId && (
            <MessageInput userId={convexUser._id} channel={channelId} />
          )}
        </div>
      </SignedIn>
    </>
  );
}
