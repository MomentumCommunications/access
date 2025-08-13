import * as React from "react";

import { Id } from "convex/_generated/dataModel";
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { useIsMobile } from "~/hooks/use-mobile";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Textarea } from "./ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { ScrollArea } from "./ui/scroll-area";
import { PencilLine } from "lucide-react";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

type Channel = {
  _id: Id<"channels">;
  _creationTime: number;
  name?: string;
  description: string;
  group?: Id<"groups">;
  isDM: boolean;
  isPrivate?: boolean;
  messages?: Id<"messages">;
  users?: Id<"groupMembers">;
  adminControlled?: boolean;
};

export function EditChannel({ channel }: { channel: Channel }) {
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
            <PencilLine className="text-muted-foreground" />
            <span>Edit</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>You may edit this message.</DialogDescription>
          </DialogHeader>
          <EditChannelForm channel={channel} />
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
          <PencilLine className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <ScrollArea className="px-2">
          <DrawerHeader className="text-left">
            <DrawerTitle>Edit Message</DrawerTitle>
          </DrawerHeader>
          <EditChannelForm channel={channel} />
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

const formSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().min(2).max(1000),
  isPrivate: z.boolean(),
  adminControlled: z.boolean(),
});

function EditChannelForm({ channel }: { channel: Channel }) {
  const mutation = useConvexMutation(api.channels.editChannel);

  const rowCount = channel.description.split("\n").length;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: channel.name,
      description: channel.description,
      isPrivate: channel.isPrivate,
      adminControlled: channel.adminControlled,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation({
      id: channel._id,
      name: values.name,
      description: values.description,
      isPrivate: values.isPrivate,
      adminControlled: values.adminControlled,
    });

    // send escape key
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={rowCount} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPrivate"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel>Private</FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adminControlled"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel>Admin Controlled</FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
