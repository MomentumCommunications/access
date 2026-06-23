import { useConvexAction } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleCheckboxes } from "~/components/role-controls";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { resolveUserRoles, type UserRole } from "~/lib/roles";

const accountEditSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z.string().max(30, "Phone number must be 30 characters or fewer."),
  email: z.email("Enter a valid email address."),
  roles: z
    .array(z.enum(["member", "staff", "admin"]))
    .min(1, "Select at least one role."),
  groups: z.array(z.string()),
});

type AccountEditValues = z.infer<typeof accountEditSchema>;

function accountEmail(email?: string | string[]) {
  return Array.isArray(email) ? email[0] || "" : email || "";
}

export function AccountEditForm({
  account,
  groups,
}: {
  account: Doc<"users">;
  groups: Array<Doc<"groups">>;
}) {
  const navigate = useNavigate();
  const updateAccount = useConvexAction(api.stripe.adminUpdateAccount);
  const form = useForm<AccountEditValues>({
    resolver: zodResolver(accountEditSchema),
    defaultValues: {
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
      email: accountEmail(account.email),
      roles: resolveUserRoles(account),
      groups: account.group || [],
    },
    mode: "onTouched",
  });

  async function onSubmit(values: AccountEditValues) {
    form.clearErrors("root");
    try {
      await updateAccount({
        user: account._id,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim().toLowerCase(),
        roles: values.roles,
        groups: values.groups as Id<"groups">[],
      });
      toast.success("Account updated.");
      await navigate({
        to: "/admin/accounts/$userId",
        params: { userId: account._id },
      });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The account could not be updated.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account details</CardTitle>
        <CardDescription>
          Update contact information and access assignments.
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
                    Updating an activated account changes its login email and
                    signs it out on other devices.
                  </FieldDescription>
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
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="groups"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Groups</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groups.map((group) => (
                      <label
                        key={group._id}
                        htmlFor={`account-group-${group._id}`}
                        className="flex items-center gap-2 rounded-md border p-3 text-sm"
                      >
                        <Checkbox
                          id={`account-group-${group._id}`}
                          checked={field.value.includes(group._id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, group._id]
                                : field.value.filter(
                                    (groupId) => groupId !== group._id,
                                  ),
                            )
                          }
                        />
                        <FieldContent>
                          <FieldLabel
                            htmlFor={`account-group-${group._id}`}
                            className="font-normal"
                          >
                            {group.name}
                          </FieldLabel>
                        </FieldContent>
                      </label>
                    ))}
                  </div>
                  {groups.length === 0 ? (
                    <FieldDescription>No groups are available.</FieldDescription>
                  ) : null}
                  <FieldError errors={[fieldState.error]} />
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
              <Link
                to="/admin/accounts/$userId"
                params={{ userId: account._id }}
              >
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

