import { useConvexMutation } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";

type Bulletin = {
  _id: Id<"bulletin">;
  title: string;
  body: string;
  pinned: boolean;
  image?: string;
  date?: string;
  author?: string;
  group?: string[];
  groups?: Id<"groups">[];
  reactions?: Id<"reactions">;
  hidden?: boolean;
};

export const Route = createFileRoute("/_app/$bulletinId")({
  component: RouteComponent,
});

const formSchema = z.object({
  title: z.string().min(2).max(50),
  body: z.string().min(2).max(2000),
  groups: z.array(z.string()), // Group IDs now
  date: z.string(),
});

function RouteComponent() {
  const { bulletinId } = Route.useParams();
  const bulletin = useQuery(api.bulletins.getBulletin, {
    id: bulletinId as Id<"bulletin">,
  });
  const navigate = useNavigate();

  if (bulletin === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col px-2 pb-2">
        <p>Loading...</p>
      </div>
    );
  }

  if (bulletin === null) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-2 pb-2">
        <div className="flex w-full items-center justify-end">
          <Button variant={"link"} onClick={() => navigate({ to: "/home" })}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
        <p>Bulletin not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-2 px-2 pb-12">
      <div className="flex w-full items-center justify-end">
        <Button variant={"link"} onClick={() => navigate({ to: "/home" })}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      </div>
      <div className="w-full">
        <h1 className="text-foreground mb-4 text-3xl font-bold">
          Edit Bulletin
        </h1>
        <Separator className="bg-muted mb-2" />
      </div>
      <EditBulletinForm bulletin={bulletin} />
    </div>
  );
}

function EditBulletinForm({ bulletin }: { bulletin: Bulletin }) {
  const groups = useQuery(api.etcFunctions.getGroups, {});
  // Get mutation function from Convex
  const mutationFn = useConvexMutation(api.bulletins.editBulletin);

  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: bulletin.title,
      body: bulletin.body,
      groups: [],
      date: bulletin.date ?? "",
    },
  });

  // Update form values when groups data is loaded
  useEffect(() => {
    if (groups && bulletin) {
      const groupIds =
        bulletin.groups && bulletin.groups.length > 0
          ? bulletin.groups
          : groups
              .filter((g) => bulletin.group?.includes(g.name))
              .map((g) => g._id);

      form.reset({
        title: bulletin.title,
        body: bulletin.body,
        groups: groupIds,
        date: bulletin.date ?? "",
      });
    }
  }, [groups, bulletin, form]);

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const title = values.title;
    const body = values.body;
    const groupIds = values.groups as Id<"groups">[]; // This now contains group IDs
    const date = values.date;

    // Convert group IDs to group names for backward compatibility
    const groupNames =
      groups?.filter((g) => groupIds.includes(g._id)).map((g) => g.name) || [];

    await mutationFn({
      id: bulletin._id,
      title,
      body,
      group: groupNames, // Keep old format for backward compatibility
      groups: groupIds, // Pass group IDs to new field
      date,
    });

    navigate({ to: "/home" });
  }

  return (
    <Form {...form}>
      <form
        className="grid w-full items-start gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="title"
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
                Date is set to {bulletin.date || "not set"}
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
          name="groups"
          render={() => (
            <FormItem>
              <FormLabel>Group</FormLabel>
              {groups?.map((group) => (
                <FormField
                  key={group._id}
                  control={form.control}
                  name="groups"
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
  );
}
