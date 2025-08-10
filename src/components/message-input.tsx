import { Button } from "./ui/button";
import { SendIcon } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { useState } from "react";
import { Id } from "convex/_generated/dataModel";
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { ImageUpload } from "./image-upload";
import { useUser } from "@clerk/tanstack-react-start";

export function MessageInput({
  userId,
  channel,
  adminControlled,
}: {
  userId: Id<"users">;
  channel: Id<"channels"> | string;
  adminControlled: boolean | undefined;
}) {
  const user = useUser();

  const convexUser = useConvexQuery(api.users.getUserByClerkId, {
    ClerkId: user?.user?.id,
  });

  const role = convexUser?.role;

  const mutate = useConvexMutation(api.messages.createMessage);

  const sendData = {
    channel: channel as Id<"channels"> | string,
    authorId: userId as Id<"users">,
  };

  const [message, setMessage] = useState("");

  const textRowCount = message.split("\n").length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const author = userId as Id<"users">;

    if (!author) return alert("Error");

    mutate({ message: trimmedMessage, author, channel: channel });

    setMessage("");
  };

  const disabledConditions = adminControlled && role !== "admin";

  return (
    <form className="flex flex-row gap-2" onSubmit={handleSubmit}>
      <Textarea
        autoFocus
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
  );
}
