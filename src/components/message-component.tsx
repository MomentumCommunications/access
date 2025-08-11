import AuthorInfo from "./author-info";
import { ImageComponent } from "./image-component";
import { MessageReactions } from "./message-reactions";
import { ReactionPicker } from "./reaction-picker";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  ClipboardIcon,
  LinkIcon,
  MoreHorizontal,
  Trash2,
  Check,
  SmileIcon,
  PencilLine,
  Trash,
} from "lucide-react";
import { Id } from "convex/_generated/dataModel";
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
import { useState, useCallback, useRef, useEffect } from "react";
import { useConvexQuery } from "@convex-dev/react-query";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";

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
  trigger,
}: {
  message: Message;
  userId: Id<"users">;
  trigger?: React.ReactNode;
}) {
  const deleteFunction = useMutation(api.messages.deleteMessage);

  const deleteMessage = () => {
    deleteFunction({ id: message._id });
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
    >
      <Trash2 color="red" />
      <span className="text-red-500">Delete</span>
    </Button>
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || defaultTrigger}
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
  channel,
  onRegisterElement,
}: {
  message: Message;
  userId: Id<"users">;
  channelId: Id<"channels">;
  channel?: { isDM: boolean };
  onRegisterElement?: (messageId: string, element: Element | null) => void;
}) {
  const isImage = message.format === "image";
  const [linkCopied, setLinkCopied] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const user = useConvexQuery(api.users.getUserById, {
    id: userId,
  });

  // Register this message element for read tracking
  useEffect(() => {
    if (onRegisterElement && messageRef.current) {
      onRegisterElement(message._id, messageRef.current);
    }

    return () => {
      if (onRegisterElement) {
        onRegisterElement(message._id, null);
      }
    };
  }, [message._id, onRegisterElement]);

  const handleCopyMessageLink = useCallback(async () => {
    try {
      const isDM = channel?.isDM ?? false;
      const messageLink = generateShareableMessageLink(
        channelId,
        message._id,
        isDM,
      );
      await navigator.clipboard.writeText(messageLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy message link:", error);
    }
  }, [channelId, message._id, channel?.isDM]);

  const isAuthorOrAdmin = message.author === userId || user?.role === "admin";

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={messageRef}
          id={message._id}
          className="flex p-2 flex-col gap-2 align-bottom hover:bg-muted/50 duration-100 lg:p-4 rounded ease-in-out"
        >
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
                    <ReactionPicker
                      messageId={message._id}
                      userId={userId}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <SmileIcon />
                          Add Reaction
                        </DropdownMenuItem>
                      }
                    />
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
                        {message.author === userId && (
                          <EditMessage
                            message={message}
                            trigger={
                              <DropdownMenuItem>
                                <PencilLine className="w-4 h-4" />
                                Edit
                              </DropdownMenuItem>
                            }
                          />
                        )}
                      </>
                    )}
                    <DropdownMenuItem onClick={handleCopyMessageLink}>
                      {linkCopied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <LinkIcon />
                      )}
                      <span>
                        {linkCopied ? "Link Copied!" : "Copy Message Link"}
                      </span>
                    </DropdownMenuItem>
                    {isAuthorOrAdmin && (
                      <DeleteMessage message={message} userId={userId} />
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-sm text-muted-foreground">
                {format(new Date(message._creationTime), "M/d/yy h:mma")}
              </p>
            </div>
          </div>
          <div className="text-sm whitespace-pre-wrap pl-10">
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
          <MessageReactions messageId={message._id} userId={userId} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ReactionPicker
          messageId={message._id}
          userId={userId}
          trigger={
            <ContextMenuItem onSelect={(e) => e.preventDefault()}>
              <SmileIcon className="mr-2 h-4 w-4" />
              Add Reaction
            </ContextMenuItem>
          }
        />
        {!isImage && (
          <>
            <ContextMenuItem
              onClick={() => navigator.clipboard.writeText(message.body)}
            >
              <ClipboardIcon className="mr-2 h-4 w-4" />
              Copy Text
            </ContextMenuItem>
            {message.author === userId && (
              <EditMessage
                message={message}
                trigger={
                  <ContextMenuItem onSelect={(e) => e.preventDefault()}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit Message
                  </ContextMenuItem>
                }
              />
            )}
          </>
        )}
        <ContextMenuItem onClick={handleCopyMessageLink}>
          {linkCopied ? (
            <>
              <Check className="mr-2 h-4 w-4" /> Link Copied!
            </>
          ) : (
            <>
              <LinkIcon className="mr-2 h-4 w-4" /> Copy Message Link
            </>
          )}
        </ContextMenuItem>
        {isAuthorOrAdmin && (
          <DeleteMessage
            message={message}
            userId={userId}
            trigger={
              <ContextMenuItem
                variant="destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete Message
              </ContextMenuItem>
            }
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
