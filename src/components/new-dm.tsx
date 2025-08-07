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
import {
  convexQuery,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";
import { SidebarMenuButton } from "./ui/sidebar";
import { Plus, UserIcon } from "lucide-react";
import { useIsMobile } from "~/hooks/use-mobile";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function NewDm({ userId }: { userId: Id<"users"> | undefined }) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <SidebarMenuButton className="border border-muted">
            <Plus />
            <span>New DM</span>
          </SidebarMenuButton>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start a new DM</DialogTitle>
            <DialogDescription>
              Select at least one user to start a DM with.
            </DialogDescription>
          </DialogHeader>
          <NewDmForm userId={userId} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <SidebarMenuButton className="border border-muted">
          <Plus />
          <span>New DM</span>
        </SidebarMenuButton>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Profile</DrawerTitle>
          <DrawerDescription>
            Select at least one user to start a DM with.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <NewDmForm userId={userId} />
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

const formSchema = z.object({
  members: z.array(z.string()).min(1),
});

function NewDmForm({ userId }: { userId: Id<"users"> | undefined }) {
  const navigate = useNavigate();
  const mutate = useConvexMutation(api.channels.createDm);

  const { data: users, isLoading } = useQuery(
    convexQuery(api.users.getOtherUsers, { id: userId }),
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { members: [] },
  });

  const selectedMemberNames = form.watch("members");

  // Find selected user IDs
  const selectedUserIds = selectedMemberNames
    .map((name) => users?.find((u) => u.name === name)?._id)
    .filter(Boolean) as Id<"users">[];

  // Build user ID list including the current user
  const allUserIds = userId ? [...new Set([userId, ...selectedUserIds])] : [];

  // ✅ This hook can be called at the top level
  const existingDm = useConvexQuery(
    api.channels.getDmByMembers,
    userId ? { userIds: allUserIds } : "skip",
  );

  function addMember(member: {
    name: string;
    _id: Id<"users">;
    displayName?: string;
  }) {
    const currentMembers = form.getValues("members") || [];
    if (!currentMembers.includes(member.name)) {
      form.setValue("members", [...currentMembers, member.name]);
    }
  }

  async function onSubmit() {
    if (!userId) return;

    if (existingDm) {
      navigate({
        to: "/dm/$dm",
        params: { dm: existingDm._id },
      });
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          keyCode: 27,
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      return;
    }

    const title = selectedUserIds
      .map(
        (id) =>
          users?.find((u) => u._id === id)?.displayName ||
          users?.find((u) => u._id === id)?.name,
      )
      .join(", ");

    try {
      const dmId = await mutate({
        title,
        user: userId,
        newMembers: selectedUserIds,
      });

      if (dmId) {
        navigate({
          to: "/dm/$dm",
          params: { dm: dmId },
        });
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            keyCode: 27,
            code: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to create DM", error);
    }
  }

  if (!userId) return null;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 md:h-[calc(100vh/3)] flex flex-col justify-between"
      >
        <FormField
          control={form.control}
          name="members"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Members</FormLabel>
              <FormControl>
                <Command>
                  <CommandInput placeholder="Search members..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      {isLoading ? (
                        <CommandItem disabled>Loading...</CommandItem>
                      ) : (
                        users?.map((user) => (
                          <CommandItem
                            key={user._id}
                            onSelect={() => addMember(user)}
                          >
                            <Avatar>
                              <AvatarImage src={user.image} />
                              <AvatarFallback>
                                <UserIcon />
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.displayName || user.name}</span>
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </FormControl>
              <FormDescription>
                Starting a conversation with:{" "}
                {field.value && field.value.length > 0
                  ? field.value.join(", ")
                  : "..."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
