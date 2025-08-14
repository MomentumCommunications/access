import { UserProfile, useUser } from "@clerk/tanstack-react-start";
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { BookOpenText } from "lucide-react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { toast } from "sonner";

const formSchema = z.object({
  bio: z.string().max(1000),
});

export const Route = createFileRoute("/_app/account")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = useUser();

  const convexUser = useConvexQuery(api.users.getUserByClerkId, {
    ClerkId: user.user?.id,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: convexUser?.description || "",
    },
  });

  const mutation = useConvexMutation(api.users.addUserDescription);

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation({
      description: values.bio,
      user: convexUser?._id,
    });

    toast("Description updated");
  }

  return (
    <div className="flex px-2 md:px-4 w-full items-center justify-start pt-8 md:py-24 flex-col gap-6 md:gap-12">
      <div className="flex flex-col gap-6 md:gap-12 max-w-4xl w-full">
        <UserProfile
          routing="hash"
          fallback={<Skeleton className="w-full h-[704px]" />}
        >
          <UserProfile.Page label="account" />
          <UserProfile.Page
            label="About Me"
            url="/about-me"
            labelIcon={<BookOpenText className="w-4 h-4" />}
          >
            <div className="p-4 flex flex-col gap-4 items-start w-full">
              <div className="flex flex-col gap-2 w-full">
                <h2 className="text-2xl font-semibold">About Me</h2>
                <p className="text-muted-foreground">
                  Let others know more about you, who&apos;s your kids, stuff
                  you like and anything else you would like to share.
                </p>
                <Separator />
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                  >
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>About Me</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormDescription id="bio-description">
                            Characters: {field.value.length} / 1000
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit">Submit</Button>
                  </form>
                </Form>
              </div>
            </div>
          </UserProfile.Page>
          <UserProfile.Page label="security" />
        </UserProfile>
      </div>
    </div>
  );
}
