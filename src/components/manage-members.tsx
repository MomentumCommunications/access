import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { useIsMobile } from "~/hooks/use-mobile";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command";
import { Skeleton } from "./ui/skeleton";
import { useMutation } from "convex/react";

export function ManageMembers({ channelId }: { channelId: Id<"channels"> }) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
          >
            <Users />
            <span>Manage Members</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Members</DialogTitle>
            <DialogDescription>
              Add/remove members from this channel.
            </DialogDescription>
          </DialogHeader>
          <MemberList channelId={channelId} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
        >
          <Users />
          <span>Manage Members</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Manage Members</DrawerTitle>
          <DrawerDescription>
            Add/remove members from this channel.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-2">
          <MemberList channelId={channelId} />
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function MemberList({ channelId }: { channelId: Id<"channels"> }) {
  const { data: members, isLoading: membersLoading } = useQuery(
    convexQuery(api.users.getUsersByChannel, { channel: channelId }),
  );

  const { data: notMembers, isLoading: notMembersLoading } = useQuery(
    convexQuery(api.users.getUsersNotInChannel, { channel: channelId }),
  );

  const removalMutation = useMutation(api.users.removeFromChannel);
  const additionMutation = useMutation(api.users.joinChannel);

  function handleRemoveUser(
    channel: Id<"channels">,
    user: Id<"users"> | undefined,
  ) {
    if (!user) return;
    console.log("remove user, ", user, "from", channel);
    removalMutation({ channel, user });
  }

  function handleAddUser(
    channelId: Id<"channels">,
    user: Id<"users"> | undefined,
  ) {
    if (!user) return;
    console.log("add user, ", user);
    additionMutation({ channel: channelId, user });
  }

  return (
    <Command className="rounded-lg border shadow-md h-[calc(40vh)]">
      <CommandInput placeholder="Search members..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="In channel">
          {membersLoading ? (
            <Skeleton className="h-10" />
          ) : (
            members?.map((member) => (
              <CommandItem
                key={member?._id}
                onSelect={() => {
                  handleRemoveUser(channelId, member?._id);
                }}
              >
                <User />
                <span>{member?.displayName || member?.name}</span>
                <CommandShortcut className="text-red-500">
                  Remove
                </CommandShortcut>
              </CommandItem>
            ))
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Not in channel">
          {notMembersLoading ? (
            <Skeleton className="h-10" />
          ) : (
            notMembers?.map((member) => (
              <CommandItem
                key={member?._id}
                onSelect={() => {
                  handleAddUser(channelId, member?._id);
                }}
              >
                <User />
                <span>{member?.displayName || member?.name}</span>
                <CommandShortcut className="text-blue-500">Add</CommandShortcut>
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
