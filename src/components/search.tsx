import { useUser } from "@clerk/tanstack-react-start";
import {
  convexQuery,
  useConvex,
  useConvexQuery,
} from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { SearchIcon } from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { generateShareableMessageLink } from "~/lib/message-utils";

export function Search() {
  const [open, setOpen] = React.useState(false);

  const user = useUser();

  const convex = useConvex();

  const convexUser = useConvexQuery(api.users.getUserByClerkId, {
    ClerkId: user?.user?.id,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery(
    convexQuery(api.messages.getMessagesByUserAccessability, {
      user: convexUser?._id,
    }),
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  async function handleSelect(value: Id<"messages">) {
    const channel = await convex.query(api.channels.getChannelByMessage, {
      messageId: value,
    });

    const messageLink = generateShareableMessageLink(
      channel?._id as Id<"channels">,
      value,
      channel?.isDM,
    );

    console.log("messageLink", messageLink);

    window.location.href = messageLink;

    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="md:w-1/5 lg:w-[700px] justify-start text-muted-foreground"
        >
          <SearchIcon className="h-4 w-4" />
          Search...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full md:w-1/5 lg:w-[700px] -translate-y-10 p-0 data-[state=open]:animate-none">
        <Command>
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {messagesLoading && <p>Loading...</p>}
              {messages?.map((message) => {
                const messageDate = format(
                  new Date(message._creationTime),
                  "M/d/yy kk:mm:ss",
                );
                const datedMessage = `${messageDate}: ${message.body}`;
                return (
                  <CommandItem
                    key={message._id}
                    value={datedMessage}
                    onSelect={() => {
                      handleSelect(message._id);
                    }}
                    className="text-ellipsis overflow-hidden whitespace-nowrap"
                  >
                    {datedMessage}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
