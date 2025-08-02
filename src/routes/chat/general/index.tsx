import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { SendIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AuthorInfo from "~/components/author-info";
import { Header } from "~/components/header";
import { ImageComponent } from "~/components/image-component";
import { ImageUpload } from "~/components/image-upload";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
// TODO: fix this style import jankyness part 2
import styles from "~/styles/markdown.txt?raw";

export const Route = createFileRoute("/chat/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useUser();

  const { data: channelId, isLoading: channelLoading } = useQuery(
    convexQuery(api.etcFunctions.getChannelIdByName, { name: "general" }),
  );

  const userId = user?.publicMetadata.convexId;

  const sendData = {
    channelId: channelId as Id<"channels">,
    authorId: userId as Id<"users">,
  };

  const { data: messages } = useQuery(
    convexQuery(api.messages.getGeneralMessages, {}),
  );

  const [message, setMessage] = useState("");

  const mutate = useConvexMutation(api.messages.createGeneralMessage);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const textRowCount = message.split("\n").length;

  // Early return after hooks
  if (!userId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const author = userId as Id<"users">;

    if (!author) return alert("Error");

    mutate({ message: trimmedMessage, author });

    setMessage("");
  };
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
        <div className="flex h-[calc(100vh+148px)] sm:h-[calc(100vh-48px)] md:h-[calc(100vh-64px)] md:pt-4 px-4 justify-end flex-col">
          <ScrollArea className="flex-grow overflow-auto px-4 overscroll-none">
            {messages?.map((m) => (
              <React.Fragment key={m._id}>
                <div id={m._id} className="flex flex-col gap-2 align-bottom">
                  <div className="flex flex-row justify-between">
                    <AuthorInfo author={m.author} />
                    <p className="text-sm text-muted-foreground">
                      {new Date(m._creationTime).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                      })}
                    </p>
                  </div>
                  <div className="prose prose-list:marker:text-primary text-sm whitespace-pre-wrap list-disc">
                    {m.format === "image" ? (
                      <ImageComponent storageId={m.body as Id<"_storage">} />
                    ) : (
                      <div className={styles}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.body}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
                <Separator className="my-2" />
              </React.Fragment>
            ))}
            <div ref={bottomRef}></div>
          </ScrollArea>
          <form className="flex flex-row gap-2" onSubmit={handleSubmit}>
            <Textarea
              autoFocus
              rows={textRowCount}
              className="w-full"
              name="message"
              value={message}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                // Submit on Enter (without Shift)
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
                // Allow new line on Shift+Enter
              }}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={!message.trim()}>
                <SendIcon />
              </Button>
              {channelLoading && <p>Loading...</p>}
              {channelId && <ImageUpload senderData={sendData} />}
            </div>
          </form>
        </div>
      </SignedIn>
    </>
  );
}
