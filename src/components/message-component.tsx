import AuthorInfo from "./author-info";
import { ImageComponent } from "./image-component";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ClipboardIcon, LinkIcon, MoreHorizontal, Trash2, Check } from "lucide-react";
import { Id } from "convex/_generated/dataModel";
import { Separator } from "./ui/separator";
import { EditMessage } from "./edit-message";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { format } from "date-fns";
import { Markdown } from "./markdown-wrapper";
import { generateShareableMessageLink } from "~/lib/message-utils";
import { useState, useCallback } from "react";

type Message = {
  _id: Id<"messages">;
  _creationTime: number;
  body: string;
  date?: string;
  author: Id<"users">;
  image?: string;
  format?: string;
  channel: string; // assuming id is represented as a string
  reactions?: string; // assuming id is represented as a string
  edited?: boolean;
};

function DeleteMessage({
  message,
  userId,
}: {
  message: Message;
  userId: Id<"users">;
}) {
  const deleteFunction = useMutation(api.messages.deleteMessage);

  const deleteMessage = () => {
    deleteFunction({ id: message._id });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          disabled={message.author !== userId}
          variant="ghost"
          className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
        >
          <Trash2 color="red" />
          <span className="text-red-500">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this message?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteMessage}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MessageComponent({
  message,
  userId,
  channelId,
}: {
  message: Message;
  userId: Id<"users">;
  channelId: Id<"channels">;
}) {
  const isImage = message.format === "image";
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyMessageLink = useCallback(async () => {
    try {
      const messageLink = generateShareableMessageLink(channelId, message._id);
      await navigator.clipboard.writeText(messageLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy message link:", error);
    }
  }, [channelId, message._id]);

  return (
    <div id={message._id} className="flex flex-col gap-2 align-bottom">
      <div className="flex flex-row justify-between">
        <AuthorInfo author={message.author} />
        <div className="flex flex-row gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="z-10 cursor-pointer w-4 h-[22px]"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuGroup>
                {!isImage && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        navigator.clipboard.writeText(message.body)
                      }
                    >
                      <ClipboardIcon />
                      Copy Text
                    </DropdownMenuItem>
                    <EditMessage message={message} userId={userId} />
                  </>
                )}
                <DropdownMenuItem onClick={handleCopyMessageLink}>
                  {linkCopied ? <Check className="w-4 h-4" /> : <LinkIcon />}
                  <span>{linkCopied ? "Link Copied!" : "Copy Message Link"}</span>
                </DropdownMenuItem>
                <DeleteMessage message={message} userId={userId} />
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-sm text-muted-foreground">
            {format(new Date(message._creationTime), "M/d/yy h:mma")}
          </p>
        </div>
      </div>
      <div className="prose prose-list:marker:text-primary text-sm whitespace-pre-wrap list-disc">
        {isImage ? (
          <ImageComponent storageId={message.body as Id<"_storage">} />
        ) : (
          <Markdown content={message.body} />
        )}
        {message.edited && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">(edited)</p>
          </div>
        )}
      </div>
      <Separator className="my-2" />
    </div>
  );
}
