import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import { Header } from "~/components/header";
import { ScrollArea } from "~/components/ui/scroll-area";
import { BottomScroll } from "~/components/bottom-scroll";
import { MessageComponent } from "~/components/message-component";
import { MessageInput } from "~/components/message-input";

export const Route = createFileRoute("/chat/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useUser();

  const { data: channelId } = useQuery(
    convexQuery(api.etcFunctions.getChannelIdByName, { name: "general" }),
  );

  const userId = user?.publicMetadata.convexId as Id<"users">;

  const { data: messages } = useQuery(
    convexQuery(api.messages.getGeneralMessages, {}),
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Early return after hooks
  if (!userId) return null;

  return (
    <>
      <Header
        currentPage="General"
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Chat", url: "/chat/" },
        ]}
      />
      <SignedOut>
        <div className="flex fixed inset-0 h-screen px-4 justify-center flex-col">
          <h1 className="text-2xl font-bold">Sign in to chat</h1>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex h-[calc(100vh+148px)] sm:h-[calc(100vh-48px)] md:h-[calc(100vh-64px)] md:pt-4 px-4 justify-end flex-col relative">
          <ScrollArea className="flex-grow overflow-auto px-4 overscroll-none">
            {messages?.map((m) => (
              <MessageComponent key={m._id} message={m} userId={userId} />
            ))}
            <div id="bottom" ref={bottomRef}></div>
            <BottomScroll bottomRef={bottomRef} />
          </ScrollArea>
          {channelId && <MessageInput userId={userId} channelId={channelId} />}
        </div>
      </SignedIn>
    </>
  );
}
