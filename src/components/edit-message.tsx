import * as React from "react";

import { Id } from "convex/_generated/dataModel";
import { DropdownMenuItem } from "./ui/dropdown-menu";
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
};

export function EditMessage({
  message,
  userId,
}: {
  message: Message;
  userId: Id<"users">;
}) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={message.author !== userId}
            variant="ghost"
            className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            <span>Edit</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>You may edit this message.</DialogDescription>
          </DialogHeader>
          <EditMessageForm message={message} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          disabled={message.author !== userId}
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
          <EditMessageForm message={message} />
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
  message: z.string(),
});

function EditMessageForm({ message }: { message: Message }) {
  const mutation = useConvexMutation(api.messages.editMessage);

  const rowCount = message.body.split("\n").length;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: message.body,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation({
      id: message._id,
      body: values.message,
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
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea {...field} rows={rowCount} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
