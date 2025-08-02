import * as React from "react";

import { cn } from "~/lib/utils";
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
import { Input } from "~/components/ui/input";
import { useIsMobile } from "~/hooks/use-mobile";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Textarea } from "./ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { Checkbox } from "./ui/checkbox";
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
import { PencilLine, Plus } from "lucide-react";

export function EditBulletin({ bulletin }: { bulletin: any }) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  console.log(bulletin);

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
          >
            <PencilLine />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Bulletin</DialogTitle>
            <DialogDescription>
              What would you like everyone to know?
            </DialogDescription>
          </DialogHeader>
          <EditBulletinForm bulletin={bulletin} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Add Bulletin</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>New Bulletin</DrawerTitle>
        </DrawerHeader>
        <EditBulletinForm bulletin={bulletin} />
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
  post: z.string().min(2).max(50),
  body: z.string().min(2).max(1000),
  group: z.array(z.string()),
  date: z.string(),
});

function EditBulletinForm({ bulletin }: { bulletin: any }) {
  const groups = useQuery(api.etcFunctions.getGroups, {});
  // Get mutation function from Convex
  const mutationFn = useConvexMutation(api.bulletins.editBulletin);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      post: bulletin.title,
      body: bulletin.body,
      group: [],
      date: bulletin.date,
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);

    const title = values.post;
    const body = values.body;
    const group = values.group;
    const date = values.date;

    mutationFn({
      id: bulletin._id,
      title,
      body,
      group,
      date,
    });

    form.reset();
  }

  return (
    <ScrollArea>
      <Form {...form}>
        <form
          className={cn("grid items-start gap-6")}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="post"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="What's on your mind?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body</FormLabel>
                <FormControl>
                  <Textarea placeholder="What's on your mind?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="group"
            render={() => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                {groups?.map((group) => (
                  <FormField
                    key={group._id}
                    control={form.control}
                    name="group"
                    render={({ field }) => (
                      <FormItem
                        key={group._id}
                        className="flex flex-row items-center gap-2"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(group.name)}
                            onCheckedChange={(checked) => {
                              // Ensure field.value is always an array
                              const currentValue = field.value || [];
                              return checked
                                ? field.onChange([...currentValue, group.name])
                                : field.onChange(
                                    currentValue.filter(
                                      (value) => value !== group.name,
                                    ),
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          {group.name}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </FormItem>
            )}
          />
          <Button type="submit">Save changes</Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
