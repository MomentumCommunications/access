import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import {
  Hash,
  LockIcon,
  MessageSquare,
  Search,
  SearchIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useIsMobile } from "~/hooks/use-mobile";

export function SearchBar() {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const navigate = useNavigate();
  const { user } = useUser();

  const isMac = navigator.userAgent.includes("Mac");
  const isMobile = useIsMobile();

  const { data: convexUser } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user?.id }),
    enabled: !!user?.id,
  });

  const { data: channels } = useQuery({
    ...convexQuery(api.channels.getAccessibleChannelsForSearch, {
      user: convexUser?._id,
    }),
    enabled: !!convexUser?._id,
  });

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

  const handleChannelSelect = (channelId: string, isDM: boolean) => {
    const path = isDM ? `/dm/${channelId}` : `/channel/${channelId}`;
    navigate({ to: path });
    setOpen(false);
    setSearchValue("");
  };

  const handleSearchSelect = () => {
    if (searchValue.trim()) {
      navigate({
        to: "/search",
        search: { q: searchValue.trim() },
      });
      setOpen(false);
      setSearchValue("");
    }
  };

  // Helper function to get display name with fallbacks
  const getDisplayName = (item: { displayName?: string; name?: string }) => {
    return item.displayName || item.name || "Untitled";
  };

  // Filter channels based on search input
  const filteredPublicChannels =
    channels?.publicChannels?.filter((channel) =>
      getDisplayName(channel).toLowerCase().includes(searchValue.toLowerCase()),
    ) || [];

  const filteredPrivateChannels =
    channels?.privateChannels?.filter((channel) =>
      getDisplayName(channel).toLowerCase().includes(searchValue.toLowerCase()),
    ) || [];

  const filteredDMs =
    channels?.dms?.filter((dm) =>
      getDisplayName(dm).toLowerCase().includes(searchValue.toLowerCase()),
    ) || [];

  const hasChannelResults =
    filteredPublicChannels.length > 0 ||
    filteredPrivateChannels.length > 0 ||
    filteredDMs.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="md:w-fit lg:w-[600px] justify-start text-muted-foreground"
        >
          <SearchIcon className="h-4 w-4" />
          Search...
          {!isMobile && (
            <kbd className="ml-auto align-baseline pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">{isMac ? "⌘" : "Ctrl+"}</span>
              <span>F</span>
            </kbd>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full lg:w-[600px] -translate-y-10 p-0 data-[state=open]:animate-none">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search channels and messages..."
            className="h-9"
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {searchValue ? "No channels found." : "Start typing to search..."}
            </CommandEmpty>

            {/* Public Channels */}
            {filteredPublicChannels.length > 0 && (
              <CommandGroup heading="Public Channels">
                {filteredPublicChannels.map((channel) => (
                  <CommandItem
                    key={channel._id}
                    value={getDisplayName(channel)}
                    onSelect={() => handleChannelSelect(channel._id, false)}
                    className="flex items-center gap-2"
                  >
                    <Hash className="h-4 w-4" />
                    <span>{getDisplayName(channel)}</span>
                    {channel.description && (
                      <span className="text-xs text-muted-foreground ml-auto truncate">
                        {channel.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Private Channels */}
            {filteredPrivateChannels.length > 0 && (
              <CommandGroup heading="Private Channels">
                {filteredPrivateChannels.map((channel) => (
                  <CommandItem
                    key={channel._id}
                    value={getDisplayName(channel)}
                    onSelect={() => handleChannelSelect(channel._id, false)}
                    className="flex items-center gap-2"
                  >
                    <LockIcon className="h-4 w-4" />
                    <span>{getDisplayName(channel)}</span>
                    {channel.description && (
                      <span className="text-xs text-muted-foreground ml-auto truncate">
                        {channel.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* DMs */}
            {filteredDMs.length > 0 && (
              <CommandGroup heading="Direct Messages">
                {filteredDMs.map((dm) => (
                  <CommandItem
                    key={dm._id}
                    value={getDisplayName(dm)}
                    onSelect={() => handleChannelSelect(dm._id, true)}
                    className="flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{getDisplayName(dm)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Search Messages Option */}
            {searchValue.trim() && (
              <>
                {hasChannelResults && <CommandSeparator />}
                <CommandGroup heading="Search Messages">
                  <CommandItem
                    onSelect={handleSearchSelect}
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    <span>Search for &quot;{searchValue.trim()}&quot;</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
