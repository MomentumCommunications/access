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
import { Input } from "~/components/ui/input";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Textarea } from "./ui/textarea";
import { useQuery } from "convex/react";
import { Checkbox } from "./ui/checkbox";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { ScrollArea } from "./ui/scroll-area";
import { PencilLine } from "lucide-react";
import { Id } from "convex/_generated/dataModel";
import { useEffect } from "react";

export function EditBulletin({ bulletin }: { bulletin: any }) {
  const [open, setOpen] = React.useState(false);

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
      <DialogContent className="sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Edit Bulletin</DialogTitle>
          <DialogDescription>
            Make changes to &quot;{bulletin.title}&quot;
          </DialogDescription>
        </DialogHeader>
        <EditBulletinForm bulletin={bulletin} />
      </DialogContent>
    </Dialog>
  );
}

const formSchema = z.object({
  post: z.string().min(2).max(50),
  body: z.string().min(2).max(2000),
  group: z.array(z.string()), // Group IDs now
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

  // Update form values when groups data is loaded
  useEffect(() => {
    if (groups && bulletin) {
      const groupIds =
        bulletin.groups ||
        groups
          .filter((g) => bulletin.group?.includes(g.name))
          .map((g) => g._id) ||
        [];

      form.reset({
        post: bulletin.title,
        body: bulletin.body,
        group: groupIds,
        date: bulletin.date,
      });
    }
  }, [groups, bulletin, form]);

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const title = values.post;
    const body = values.body;
    const groupIds = values.group as Id<"groups">[]; // This now contains group IDs
    const date = values.date;

    // Convert group IDs to group names for backward compatibility
    const groupNames =
      groups?.filter((g) => groupIds.includes(g._id)).map((g) => g.name) || [];

    mutationFn({
      id: bulletin._id,
      title,
      body,
      group: groupNames, // Keep old format for backward compatibility
      groups: groupIds, // Pass group IDs to new field
      date,
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
                <FormDescription>
                  Date is set to {bulletin.date}
                </FormDescription>
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
                  <Textarea
                    {...field}
                    placeholder="What's on your mind?"
                    className="min-h-32"
                  />
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
                            checked={field.value?.includes(group._id)}
                            onCheckedChange={(checked) => {
                              // Ensure field.value is always an array
                              const currentValue = field.value || [];
                              return checked
                                ? field.onChange([...currentValue, group._id])
                                : field.onChange(
                                    currentValue.filter(
                                      (value) => value !== group._id,
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
