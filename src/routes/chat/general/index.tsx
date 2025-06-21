import { SignedIn, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import React from "react";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/chat/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  const tags = Array.from({ length: 5 }).map(
    (_, i, a) => `v1.2.0-beta.${a.length - i}`,
  );

  const { user } = useUser();

  const userId = user?.publicMetadata.convexId;

  const mutate = useConvexMutation(api.messages.createGeneralMessage);

  const { data: messages } = useQuery(
    convexQuery(api.messages.getGeneralMessages, {}),
  );

  console.log(messages);

  return (
    <>
      <Header
        currentPage="General"
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Chat", url: "/chat/" },
        ]}
      />
      <SignedIn>
        <div className="flex h-[calc(100vh-132px)] px-4 align-bottom flex-col">
          <ScrollArea className="flex flex-col align-bottom w-full h-full">
            {messages?.map((m) => (
              <React.Fragment key={m._id}>
                <div className="text-sm">{m.body}</div>
                <Separator className="my-2" />
              </React.Fragment>
            ))}
          </ScrollArea>
          <form
            className="flex flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.currentTarget;
              const message = form.message.value;
              const author = userId as Id<"users">;

              if (!author) return alert("Error");

              mutate({ message, author });

              form.reset();
            }}
          >
            <Textarea
              className="w-full"
              name="message"
              placeholder="Type a message..."
            />
            <Button type="submit">Send</Button>
          </form>
        </div>
      </SignedIn>
    </>
  );
}
