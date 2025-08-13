import AuthorInfo from "./author-info";
import { ImageComponent } from "./image-component";
import { MessageReactions } from "./message-reactions";
import { ReactionSubmenu } from "./reaction-picker";
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
  PencilLine,
  Trash,
  Reply,
  CornerUpRight,
  Dot,
} from "lucide-react";
import { Id } from "convex/_generated/dataModel";
import { EditMessage } from "./edit-message";
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
import { generateShareableMessageLink, Message } from "~/lib/message-utils";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  convexQuery,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";

function DeleteMessage({
  message,
  trigger,
}: {
  message: Message;
  userId: Id<"users">;
  trigger?: React.ReactNode;
}) {
  const { mutate: deleteFunction } = useMutation({
    mutationFn: useConvexMutation(api.messages.deleteMessage),
  });

  const deleteMessage = () => {
    deleteFunction({ id: message._id });

    toast("Message deleted");
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
  onReply,
}: {
  message: Message;
  userId: Id<"users">;
  channelId: Id<"channels">;
  channel?: { isDM: boolean };
  onRegisterElement?: (messageId: string, element: Element | null) => void;
  onReply?: (message: Message) => void;
}) {
  const isImage = message.format === "image";
  const [linkCopied, setLinkCopied] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const user = useConvexQuery(api.users.getUserById, {
    id: userId,
  });

  const { data: replyData, isLoading: replyLoading } = useQuery({
    ...convexQuery(api.messages.getReplyData, { id: message._id }),
    enabled: !!message.replyToId,
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

  function handleCopyText(text: string) {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  }

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
      toast("Message link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy message link:", error);
    }
  }, [channelId, message._id, channel?.isDM]);

  const isAuthorOrAdmin = message.author === userId || user?.role === "admin";

  function formatTime(date: number) {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    const dateObj = format(new Date(date), "yyyy-MM-dd");
    if (dateObj === today) {
      return format(date, "h:mm a");
    } else if (dateObj === yesterday) {
      return "Yesterday at " + format(date, "h:mm a");
    }
    return format(date, "M/d/yyyy h:mm a");
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={messageRef}
          id={message._id}
          className="flex p-1 flex-col gap-2 align-bottom hover:bg-muted/50 duration-100 flex-1 min-w-0 lg:p-4 rounded ease-in-out"
        >
          {/* display the reply */}
          {replyLoading && <Skeleton className="h-3 w-1/2" />}

          {replyData && (
            <div className="flex flex-row gap-2 items-center pl-4 w-min">
              <CornerUpRight className="flex-shrink-0 w-4 h-4 translate-y-0.5 text-muted-foreground" />
              <img
                src={replyData.author?.image}
                alt={replyData.author?.name}
                className="flex-shrink-0 w-6 h-6 rounded-full border border-muted"
              />
              <p className="text-sm text-muted-foreground flex-shrink-0">
                {replyData.author?.displayName || replyData.author?.name}:
              </p>
              {/* this is not the best way to deal with the flex container being too long issue */}
              {/* but it'll do for now */}
              {/* ideally this should inherit its max width from all of its parent */}
              <p className="text-sm text-muted-foreground truncate min-w-0 w-[calc(100vw-16rem)] xs:w-[calc(100vw-20rem)] sm:w-[calc(100vw-20rem)] md:w-[calc(100vw-36rem)] flex-1">
                {replyData.repliedMessage?.body || "(Lost or deleted)"}
              </p>
            </div>
          )}

          <div className="flex flex-row items-center align-middle gap-2 justify-start">
            <AuthorInfo author={message.author} />
            <Dot className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
            <div className="flex flex-row gap-2 items-center">
              <p className="text-xs text-muted-foreground">
                {formatTime(message._creationTime)}
              </p>
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
                      {onReply && (
                        <DropdownMenuItem onClick={() => onReply(message)}>
                          <Reply className="w-4 h-4" />
                          Reply
                        </DropdownMenuItem>
                      )}
                      <ReactionSubmenu
                        messageId={message._id}
                        userId={userId}
                        mode="dropdown"
                      />
                      {!isImage && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleCopyText(message.body)}
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
              </div>
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
        {onReply && (
          <ContextMenuItem onClick={() => onReply(message)}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </ContextMenuItem>
        )}
        <ReactionSubmenu
          messageId={message._id}
          userId={userId}
          mode="context"
        />
        {!isImage && (
          <>
            <ContextMenuItem onClick={() => handleCopyText(message.body)}>
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
