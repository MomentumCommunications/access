import { Button } from "./ui/button";
import { SendIcon, X } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { useState, useRef, useEffect } from "react";
import { Id } from "convex/_generated/dataModel";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { ImageUpload } from "./image-upload";
import { useUser } from "@clerk/tanstack-react-start";

type ReplyingTo = {
  _id: Id<"messages">;
  body: string;
  author: Id<"users">;
  _creationTime: number;
};

export function MessageInput({
  userId,
  channel,
  adminControlled,
  replyingTo,
  onCancelReply,
}: {
  userId: Id<"users">;
  channel: Id<"channels"> | string;
  adminControlled: boolean | undefined;
  replyingTo?: ReplyingTo;
  onCancelReply?: () => void;
}) {
  const user = useUser();

  const { data: convexUser } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user?.user?.id }),
    enabled: !!user?.user?.id,
  });

  const role = convexUser?.role;

  const mutate = useConvexMutation(api.messages.createMessage);

  const sendData = {
    channel: channel as Id<"channels"> | string,
    authorId: userId as Id<"users">,
  };

  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const textRowCount = message.split("\n").length;

  // Focus textarea when replying starts
  useEffect(() => {
    if (replyingTo) {
      // Small delay to ensure the reply UI has rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [replyingTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const author = userId as Id<"users">;

    if (!author) return alert("Error");

    mutate({
      message: trimmedMessage,
      author,
      channel: channel,
      replyToId: replyingTo?._id,
    });

    setMessage("");
    onCancelReply?.();
  };

  const disabledConditions = adminControlled && role !== "admin";

  const { data: replyAuthor } = useQuery({
    ...convexQuery(api.users.getUserById, {
      id: replyingTo?.author || ("" as Id<"users">),
    }),
    enabled: !!replyingTo?.author,
  });

  return (
    <div className="flex flex-col gap-2">
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border-l-4 border-primary">
          <div className="flex-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">
                Replying to {replyAuthor?.displayName || replyAuthor?.name}
              </span>
            </div>
          </div>
          {onCancelReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      <form className="flex flex-row gap-2" onSubmit={handleSubmit}>
        <Textarea
          autoFocus
          ref={textareaRef}
          rows={textRowCount}
          className="w-full"
          name="message"
          disabled={disabledConditions}
          value={message}
          placeholder={
            disabledConditions
              ? "You are not allowed to send messages in this channel."
              : "Send a message..."
          }
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
          <ImageUpload senderData={sendData} />
        </div>
      </form>
    </div>
  );
}
