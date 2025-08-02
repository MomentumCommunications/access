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

export function AddBulletin() {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Add Bulletin</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Bulletin</DialogTitle>
            <DialogDescription>
              What would you like everyone to know?
            </DialogDescription>
          </DialogHeader>
          <BulletinForm />
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
        <BulletinForm className="px-4" />
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

function BulletinForm({ className }: React.ComponentProps<"form">) {
  const groups = useQuery(api.etcFunctions.getGroups, {});
  // Get mutation function from Convex
  const mutationFn = useConvexMutation(api.bulletins.createBulletin);

  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachImage = useMutation(api.bulletins.attachImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      post: "",
      body: "",
      group: [],
      date: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);

    const title = values.post;
    const body = values.body;
    const team = values.group;
    const date = values.date;

    const newBulletinId = await mutationFn({ title, body, team, date });

    {
      if (selectedImage) {
        const postUrl = await generateUploadUrl();
        // Step 1: POST the file to the URL
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedImage!.type },
          body: selectedImage,
        });
        const { storageId } = await result.json();
        // Step 2: Save the newly allocated storage id to the database
        await attachImage({
          storageId,
          bulletin: newBulletinId,
        });

        setSelectedImage(null);
        imageInput.current!.value = "";
      }
    }
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
    <ScrollArea>
      <Form {...form}>
        <form
          className={cn("grid items-start gap-6", className)}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="post"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Textarea {...field} />
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
          <input
            type="file"
            accept="image/*"
            ref={imageInput}
            onChange={(event) => setSelectedImage(event.target.files![0])}
            disabled={selectedImage !== null}
          />
          <Button type="submit">Save changes</Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
