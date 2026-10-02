import { useConvexAction } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { ConvexError } from "convex/values";
import { CheckCircle, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  accountHelpSchema,
  type AccountHelpContext,
} from "../../shared/account-help";
import { accountHelpStore } from "~/lib/account-help";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/account-help")({
  component: AccountHelpPage,
});
const formSchema = accountHelpSchema.extend({
  website: z.string().max(200).optional(),
});
type FormValues = z.infer<typeof formSchema>;

function AccountHelpPage() {
  const [context, setContext] = useState<AccountHelpContext | null | undefined>(
    undefined,
  );
  useEffect(() => {
    setContext(accountHelpStore.read());
  }, []);
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6 py-4">
        <header className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo_transparent.png"
            alt="Access Momentum Logo"
            className="size-16 rounded-full"
          />
          <h1 className="text-2xl font-bold">
            Having trouble getting your code?
          </h1>
          <p className="text-sm text-muted-foreground">
            We’re here to help you access your account.
          </p>
        </header>
        {context === undefined ? (
          <Spinner className="mx-auto" />
        ) : (
          <AccountHelpForm context={context} />
        )}
      </div>
    </main>
  );
}

function AccountHelpForm({ context }: { context: AccountHelpContext | null }) {
  const send = useConvexAction(api.contact.sendAccountHelp);
  const [sent, setSent] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: context?.email ?? "",
      phone: "",
      message: "",
      flow: context?.flow ?? "unknown",
      website: "",
    },
  });
  const backLink = (
    <Link
      to={(context?.returnTo || "/login") as never}
      className="text-sm underline underline-offset-4"
    >
      {context ? "Back to enter your code" : "Back to sign in"}
    </Link>
  );

  async function onSubmit(values: FormValues) {
    form.clearErrors("root");
    try {
      await send(values);
      setSent(true);
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : "We couldn’t send your message. Your details are still here; please try again in a minute.",
      });
    }
  }

  if (sent)
    return (
      <Card>
        <CardHeader>
          <CheckCircle className="mb-2 size-7 text-primary" />
          <CardTitle>Message sent</CardTitle>
          <CardDescription>
            Our team received your request and will follow up by email
            {form.getValues("phone")?.trim()
              ? " or at the callback number you provided"
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can return to your code-entry screen if your email arrives.
            Sending this message does not change your account or verification
            code.
          </p>
          {backLink}
        </CardContent>
      </Card>
    );

  return (
    <>
      <section
        className="space-y-2 text-sm text-muted-foreground"
        aria-label="Finding your code"
      >
        {context && (
          <p>
            We sent your code to{" "}
            <strong className="break-all text-foreground">
              {context.email}
            </strong>
            . Double-check the spelling.
          </p>
        )}
        <p>
          Check your spam or junk folder, and try searching your inbox for
          “Access Momentum.”
        </p>
        <p>
          Still stuck? Send us a message below. Prefer to talk by phone? Leave
          your number and our team can call you to help.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Ask the studio for help</CardTitle>
          <CardDescription>
            Please don’t include your password or verification code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="help-name">Your name</FieldLabel>
                <Input
                  id="help-name"
                  autoComplete="name"
                  required
                  maxLength={120}
                  aria-invalid={!!form.formState.errors.name}
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="help-email">
                  Email used for your account
                </FieldLabel>
                <Input
                  id="help-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register("email")}
                />
                <FieldDescription>
                  If you notice a typo, enter the correct address here so we can
                  follow up. This won’t change the email used on your code-entry
                  screen.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.email]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.phone}>
                <FieldLabel htmlFor="help-phone">
                  Callback number (optional)
                </FieldLabel>
                <Input
                  id="help-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  aria-invalid={!!form.formState.errors.phone}
                  {...form.register("phone")}
                />
                <FieldError errors={[form.formState.errors.phone]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.message}>
                <FieldLabel htmlFor="help-message">
                  Anything else we should know? (optional)
                </FieldLabel>
                <Textarea
                  id="help-message"
                  rows={3}
                  maxLength={5000}
                  aria-invalid={!!form.formState.errors.message}
                  {...form.register("message")}
                />
                <FieldError errors={[form.formState.errors.message]} />
              </Field>
              <div hidden aria-hidden="true">
                <label htmlFor="help-website">Leave this empty</label>
                <input
                  id="help-website"
                  tabIndex={-1}
                  autoComplete="off"
                  {...form.register("website")}
                />
              </div>
              <div aria-live="polite">
                <FieldError errors={[form.formState.errors.root]} />
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Mail />
                {form.formState.isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <div className="text-center">{backLink}</div>
    </>
  );
}
