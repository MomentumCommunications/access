import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
} from "~/components/ui/form";
import { Checkbox } from "~/components/ui/checkbox";
import { Id } from "convex/_generated/dataModel";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import React from "react";
import { cn } from "~/lib/utils";

const formSchema = z.object({
  groups: z.array(z.string()).min(1),
});

export function UserGroups({
  groups,
  user,
}: {
  groups:
    | {
        _id: Id<"groups">;
        _creationTime: number;
        info?: string | undefined;
        document?: string | undefined;
        name: string;
        description: string;
        password: string;
      }[]
    | undefined;
  user:
    | {
        _id: Id<"users">;
        name: string;
        displayName?: string | undefined;
        description?: string | undefined;
        email?: string[] | undefined;
        role?: "admin" | "staff" | "member" | undefined;
        group?: string[];
        image?: string | undefined;
        externalId: string;
      }
    | null
    | undefined;
}) {
  const [open, setOpen] = React.useState(false);

  const userGroups = groups?.filter((group) =>
    user?.group?.includes(group._id),
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      groups: userGroups?.map((group) => group._id) || [],
    },
  });

  const assignments = useConvexMutation(api.etcFunctions.assignGroups);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (user) {
      await assignments({
        user: user._id,
        groups: data.groups as Id<"groups">[],
      });
    }
    setOpen(false);
  };

  return (
    <div className="flex flex-row gap-1">
      {userGroups?.map((group) => (
        <Badge
          key={group._id}
          variant="secondary"
          className={cn(
            "px-2 h-8 saturate-75",
            group.name === "mdp" && "bg-rose-800",
            group.name === "mdp2" && "bg-teal-800",
            group.name === "club" && "bg-indigo-800",
          )}
        >
          <span className="uppercase select-none font-semibold">
            {group.name}
          </span>
        </Badge>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <Button size="sm" variant="ghost" className="w-10 h-8">
            <span className="text-sm text-muted-foreground">+/-</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Groups</DialogTitle>
            <DialogDescription>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <FormField
                    control={form.control}
                    name="groups"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">
                            Assignments
                          </FormLabel>
                          <FormDescription>
                            Select the groups you want to assign to {user?.name}
                            .
                          </FormDescription>
                        </div>
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
                                    onCheckedChange={(checked) =>
                                      checked
                                        ? field.onChange([
                                            ...field.value,
                                            group._id,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== group._id,
                                            ),
                                          )
                                    }
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {group.name}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Submit</Button>
                </form>
              </Form>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
