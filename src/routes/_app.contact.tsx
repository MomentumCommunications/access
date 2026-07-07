import { useConvexAction } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

const contactTopics = [
  "unspecified",
  "enrollment",
  "class_request",
  "billing",
  "account_access",
  "bug_report",
  "feedback",
  "other",
] as const;

const contactTopicLabels: Record<ContactTopic, string> = {
  unspecified: "Unspecified",
  enrollment: "Enrollment",
  class_request: "Class request",
  billing: "Billing",
  account_access: "Account access",
  bug_report: "Bug report",
  feedback: "Feedback",
  other: "Other",
};

type ContactTopic = (typeof contactTopics)[number];

const contactFormSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(120),
  topic: z.enum(contactTopics),
  message: z.string().trim().min(1, "Message is required.").max(5000),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

function initialTopic(topic?: string): ContactTopic {
  if (topic === "unspecified") return "unspecified";
  return contactTopics.includes(topic as ContactTopic)
    ? (topic as ContactTopic)
    : "unspecified";
}

export const Route = createFileRoute("/_app/contact")({
  validateSearch: z.object({
    topic: z.string().optional(),
  }),
  component: ContactRoute,
});

function ContactRoute() {
  const { topic } = Route.useSearch();
  const sendContactMessage = useConvexAction(api.contact.sendContactMessage);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      subject: "",
      topic: initialTopic(topic),
      message: "",
    },
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      await sendContactMessage({
        subject: values.subject.trim(),
        topic: values.topic,
        message: values.message.trim(),
      });
      toast.success("Message sent.");
      form.reset({
        subject: "",
        topic: initialTopic(topic),
        message: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send your message right now.",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Contact</h1>
        <p className="text-muted-foreground">
          Send a message to the studio. We’ll include your account info so the
          team knows who to follow up with.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>How can we help?</CardTitle>
          <CardDescription>
            This sends an email to the studio team from inside Access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-5"
              noValidate
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactTopics.map((contactTopic) => (
                          <SelectItem key={contactTopic} value={contactTopic}>
                            {contactTopicLabels[contactTopic]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={120}
                        placeholder="What is this about?"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-56 resize-y"
                        maxLength={5000}
                        placeholder="Tell us what is going on..."
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value.length.toLocaleString()} / 5,000 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <Mail />
                  {form.formState.isSubmitting ? "Sending..." : "Send message"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
