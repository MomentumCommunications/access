import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { useIsMobile } from "~/hooks/use-mobile";
import { UsersIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface MessageReactionsProps {
  messageId: Id<"messages">;
  userId: Id<"users">;
}

interface ReactionDetailsProps {
  messageId: Id<"messages">;
  reactions: Array<{
    reactionName: string;
    emoji: string;
    count: number;
    users: Array<{ _id: Id<"users">; name: string; email?: string }>;
  }>;
}

function ReactionDetails({ reactions }: ReactionDetailsProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (reactions.length === 0) {
    return null;
  }

  const content = (
    <div className="max-h-60 overflow-y-auto">
      {reactions.map((reaction) => (
        <div
          key={reaction.reactionName}
          className="p-3 border-b last:border-b-0"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{reaction.emoji}</span>
            <span className="font-medium">{reaction.count}</span>
          </div>
          <div className="space-y-1">
            {reaction.users.map((user) => (
              <div key={user._id} className="text-sm text-muted-foreground">
                {user.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-1">
            <UsersIcon className="h-3 w-3" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Reactions</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1">
          <UsersIcon className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onPointerDownOutside={(e) => {
          // Prevent closing on mobile when interacting with content
          if (isMobile) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-3 border-b">
          <h4 className="font-medium">Reactions</h4>
        </div>
        {content}
      </PopoverContent>
    </Popover>
  );
}

export function MessageReactions({ messageId, userId }: MessageReactionsProps) {
  const reactions = useQuery(api.reactions.getMessageReactions, { messageId });
  const userReaction = useQuery(api.reactions.getUserReactionForMessage, {
    messageId,
    userId,
  });
  const addReaction = useMutation(api.reactions.addReaction);
  const removeReaction = useMutation(api.reactions.removeReaction);

  if (!reactions || reactions.length === 0) {
    return null;
  }

  const handleReactionClick = async (reactionName: string) => {
    try {
      if (userReaction === reactionName) {
        // User is removing their reaction
        await removeReaction({ messageId, userId });
      } else {
        // User is adding/changing their reaction
        await addReaction({ messageId, userId, reaction: reactionName });
      }
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1 pl-10">
      {reactions.map((reaction) => (
        <Button
          key={reaction.reactionName}
          variant="outline"
          size="sm"
          className={cn(
            "h-6 px-2 text-md border border-muted gap-1 hover:bg-accent",
            userReaction === reaction.reactionName &&
              "border-muted-foreground bg-muted dark:bg-muted hover:bg-blue-100",
          )}
          onClick={() => handleReactionClick(reaction.reactionName)}
        >
          <span>{reaction.emoji}</span>
          <span className="text-foreground">{reaction.count}</span>
        </Button>
      ))}
      <ReactionDetails messageId={messageId} reactions={reactions} />
    </div>
  );
}
