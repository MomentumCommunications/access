import { Button } from "./ui/button";
import { SendIcon } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { useState } from "react";
import { Id } from "convex/_generated/dataModel";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { ImageUpload } from "./image-upload";

export function MessageInput({
  userId,
  channelId,
}: {
  userId: Id<"users">;
  channelId: Id<"channels">;
}) {
  const mutate = useConvexMutation(api.messages.createGeneralMessage);

  const sendData = {
    channelId: channelId as Id<"channels">,
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

    mutate({ message: trimmedMessage, author });

    setMessage("");
  };
  return (
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
        <ImageUpload senderData={sendData} />
      </div>
    </form>
  );
}
