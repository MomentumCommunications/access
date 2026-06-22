import { useConvexAction } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Controller, useForm } from "react-hook-form";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { RoleCheckboxes } from "~/components/role-controls";
import type { UserRole } from "~/lib/roles";

const accountSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.email("Enter a valid email address."),
  phone: z.string().max(30, "Phone number must be 30 characters or fewer."),
  roles: z
    .array(z.enum(["member", "staff", "admin"]))
    .min(1, "Select at least one role."),
  sendInvitation: z.boolean(),
});

type AccountValues = z.infer<typeof accountSchema>;

export function AccountCreateForm() {
  const navigate = useNavigate();
  const createAccount = useConvexAction(api.stripe.adminCreateAccount);
  const sendInvitation = useConvexAction(api.invitationActions.send);
  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      roles: ["member"],
      sendInvitation: true,
    },
    mode: "onTouched",
  });

  async function onSubmit(values: AccountValues) {
    form.clearErrors("root");
    try {
      const result = await createAccount({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || undefined,
        roles: values.roles,
      });
      if (values.sendInvitation) {
        const invitation = await sendInvitation({
          targetUserId: result.userId,
        });
        if (invitation.warning) {
          await navigator.clipboard.writeText(invitation.url);
          toast.warning(`${invitation.warning} The link was copied.`);
        } else {
          toast.success("Account created and invitation sent.");
        }
      }
      if (result.warning) {
        toast.warning(result.warning);
      } else if (!values.sendInvitation) {
        toast.success(
          result.billingProvisioned
            ? "Account, household, and Stripe customer created."
            : "Workforce account created.",
        );
      }
      await navigate({
        to: "/admin/accounts/$userId",
        params: { userId: result.userId },
      });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The account could not be created.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account details</CardTitle>
        <CardDescription>
          This creates an imported client record, not login credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["firstName", "lastName"] as const).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        {name === "firstName" ? "First name" : "Last name"}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        autoComplete={
                          name === "firstName" ? "given-name" : "family-name"
                        }
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ))}
            </div>

            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Registration will match this address to the account.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="roles"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Roles</FieldLabel>
                  <RoleCheckboxes
                    roles={field.value as UserRole[]}
                    onRolesChange={field.onChange}
                  />
                  <FieldDescription>
                    Selecting Admin initially enables all three roles.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="sendInvitation"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>
                      Send invitation email
                    </FieldLabel>
                    <FieldDescription>
                      Sends a secure account setup link that expires in 7 days.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            />
          </FieldGroup>

          {form.formState.errors.root?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/accounts">Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create account"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
