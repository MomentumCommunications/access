import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { SidebarMenuButton } from "./ui/sidebar";
import { Plus } from "lucide-react";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
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
} from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Id } from "convex/_generated/dataModel";
import { Switch } from "./ui/switch";

const formSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1),
  isPrivate: z.boolean(),
  adminControlled: z.boolean(),
});

export function NewChannel({ userId }: { userId: Id<"users"> }) {
  const mutate = useConvexMutation(api.channels.createChannel);

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isPrivate: false,
      adminControlled: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { name, description, isPrivate, adminControlled } = values;
    const user = userId;

    try {
      const channelId = await mutate({
        name,
        description,
        isPrivate,
        user,
        adminControlled,
      });

      if (channelId) {
        window.location.href = `/channel/${channelId}`;

        form.reset();

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
    } catch (error) {
      console.error("Failed to create channel", error);
      // handle error (show message, etc)
    }
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton className="border border-muted">
          <Plus />
          <span>Create</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Channel</DialogTitle>
          <DialogDescription>Make a new chat.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name</FormLabel>
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
                  <FormLabel>Channel Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    What&apos;cha wanna talk about?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Private Channel</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminControlled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Admin Controlled
                  </FormLabel>
                  <FormDescription>
                    Only admins can send messages in this channel.
                  </FormDescription>
                </FormItem>
              )}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
