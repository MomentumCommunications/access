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
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuItem,
} from "~/components/ui/context-menu";
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
  { emoji: "🫠", name: "melting_face", label: "melting face" },
];

interface ReactionPickerProps {
  messageId: Id<"messages">;
  userId: Id<"users">;
  trigger?: React.ReactNode;
  onReactionSelect?: () => void;
  mode?: "popover" | "dropdown" | "context" | "drawer";
}

function ReactionGrid({
  messageId,
  userId,
  onReactionSelect,
}: {
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

function ReactionSubmenuItems({
  messageId,
  userId,
  onReactionSelect,
  mode,
}: {
  messageId: Id<"messages">;
  userId: Id<"users">;
  onReactionSelect?: () => void;
  mode: "dropdown" | "context";
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

  const MenuItemComponent =
    mode === "dropdown" ? DropdownMenuItem : ContextMenuItem;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-4">
        {REACTION_EMOJIS.map(({ emoji, name }) => (
          <MenuItemComponent
            key={name}
            onClick={() => handleReactionClick(name)}
            className="text-xl"
          >
            <span>{emoji}</span>
          </MenuItemComponent>
        ))}
      </div>
    </>
  );
}

export function ReactionSubmenu({
  messageId,
  userId,
  trigger,
  onReactionSelect,
  mode,
}: {
  messageId: Id<"messages">;
  userId: Id<"users">;
  trigger?: React.ReactNode;
  onReactionSelect?: () => void;
  mode: "dropdown" | "context";
}) {
  const isMobile = useIsMobile();

  // On mobile, always use drawer regardless of mode
  if (isMobile) {
    return (
      <ReactionPicker
        messageId={messageId}
        userId={userId}
        trigger={trigger}
        onReactionSelect={onReactionSelect}
        mode="drawer"
      />
    );
  }

  if (mode === "dropdown") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SmileIcon className="h-4 -ml-1 mr-1 text-muted-foreground" />
          <span>Add Reaction</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent sideOffset={2} alignOffset={-5}>
          <ReactionSubmenuItems
            messageId={messageId}
            userId={userId}
            onReactionSelect={onReactionSelect}
            mode={mode}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <SmileIcon className="mr-4 h-4 w-4 text-muted-foreground" />
        <span>Add Reaction</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent sideOffset={2} alignOffset={-5}>
        <ReactionSubmenuItems
          messageId={messageId}
          userId={userId}
          onReactionSelect={onReactionSelect}
          mode={mode}
        />
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function ReactionPicker({
  messageId,
  userId,
  trigger,
  onReactionSelect,
  mode = "popover",
}: ReactionPickerProps) {
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
      <SmileIcon className="h-4 mr-1 text-muted-foreground" />
      React
    </Button>
  );

  // Handle sub-menu modes
  if (mode === "dropdown" || mode === "context") {
    return (
      <ReactionSubmenu
        messageId={messageId}
        userId={userId}
        trigger={trigger}
        onReactionSelect={onReactionSelect}
        mode={mode}
      />
    );
  }

  // Force drawer mode if mobile or explicitly requested
  if (isMobile || mode === "drawer") {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="sm">
            <SmileIcon className="h-4 mr-2 text-muted-foreground" />
            React
          </Button>
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

  // Default popover mode
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
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
