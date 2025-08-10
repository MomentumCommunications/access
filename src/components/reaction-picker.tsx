import { useState } from "react";
import { useMutation } from "convex/react";
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
import { SmileIcon } from "lucide-react";

const REACTION_EMOJIS = [
  { emoji: "👍", name: "thumbs_up", label: "thumbs up" },
  { emoji: "👎", name: "thumbs_down", label: "thumbs down" },
  { emoji: "❤️", name: "heart", label: "heart" },
  { emoji: "😂", name: "laugh", label: "laugh" },
  { emoji: "😢", name: "sad", label: "sad" },
  { emoji: "😮", name: "surprised", label: "surprised" },
  { emoji: "😡", name: "angry", label: "angry" },
  { emoji: "🔥", name: "fire", label: "fire" },
  { emoji: "💯", name: "hundred", label: "100" },
  { emoji: "🎉", name: "party", label: "party" },
  { emoji: "🤔", name: "thinking", label: "thinking" },
  { emoji: "👏", name: "clap", label: "clap" },
];

interface ReactionPickerProps {
  messageId: Id<"messages">;
  userId: Id<"users">;
  trigger?: React.ReactNode;
  onReactionSelect?: () => void;
}

function ReactionGrid({ messageId, userId, onReactionSelect }: {
  messageId: Id<"messages">;
  userId: Id<"users">;
  onReactionSelect?: () => void;
}) {
  const addReaction = useMutation(api.reactions.addReaction);

  const handleReactionClick = async (reactionName: string) => {
    try {
      await addReaction({
        messageId,
        userId,
        reaction: reactionName,
      });
      onReactionSelect?.();
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  return (
    <div className="grid grid-cols-6 gap-2 p-4">
      {REACTION_EMOJIS.map(({ emoji, name, label }) => (
        <Button
          key={name}
          variant="ghost"
          size="sm"
          className="h-10 w-10 text-xl hover:bg-accent"
          onClick={() => handleReactionClick(name)}
          title={label}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}

export function ReactionPicker({ messageId, userId, trigger, onReactionSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleReactionSelect = () => {
    setOpen(false);
    onReactionSelect?.();
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <SmileIcon className="h-4 w-4" />
      React
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {trigger || defaultTrigger}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Choose a reaction</DrawerTitle>
          </DrawerHeader>
          <ReactionGrid
            messageId={messageId}
            userId={userId}
            onReactionSelect={handleReactionSelect}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="bottom"
        sideOffset={4}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => setOpen(false)}
        onEscapeKeyDown={() => setOpen(false)}
        onFocusOutside={(e) => {
          // Allow clicking on the popover content
          const target = e.target as Element;
          const popoverContent = e.currentTarget;
          if (popoverContent.contains(target)) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-3 border-b">
          <h4 className="font-medium">Choose a reaction</h4>
        </div>
        <ReactionGrid
          messageId={messageId}
          userId={userId}
          onReactionSelect={handleReactionSelect}
        />
      </PopoverContent>
    </Popover>
  );
}