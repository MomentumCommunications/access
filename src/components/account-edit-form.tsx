import { useConvexAction, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleCheckboxes } from "~/components/role-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  accountStatusChanged,
  accountStatusConfirmationCopy,
  resolveAccountStatus,
} from "../../shared/account-status";
import { getAccountName } from "~/lib/account-name";
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
  status: z.enum(["active", "inactive"]),
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
  const [pendingValues, setPendingValues] =
    useState<AccountEditValues | null>(null);
  const form = useForm<AccountEditValues>({
    resolver: zodResolver(accountEditSchema),
    defaultValues: {
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
      email: accountEmail(account.email),
      roles: resolveUserRoles(account),
      groups: account.group || [],
      status: resolveAccountStatus(account.status),
    },
    mode: "onTouched",
  });
  const selectedStatus = form.watch("status");
  const statusImpact = useConvexQuery(api.classes.adminGetAccountStatusImpact, {
    user: account._id,
    status: selectedStatus,
  });

  async function saveAccount(values: AccountEditValues) {
    form.clearErrors("root");
    try {
      const result = await updateAccount({
        user: account._id,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim().toLowerCase(),
        status: values.status,
        roles: values.roles,
        groups: values.groups as Id<"groups">[],
      });
      const skipped =
        result.statusResult?.skippedSharedStudentCount &&
        result.statusResult.skippedSharedStudentCount > 0
          ? ` ${result.statusResult.skippedSharedStudentCount} shared student${result.statusResult.skippedSharedStudentCount === 1 ? " was" : "s were"} kept active.`
          : "";
      toast.success(`Account updated.${skipped}`);
      await navigate({
        to: "/admin/accounts/$userId",
        params: { userId: account._id },
      });
      return true;
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The account could not be updated.",
      });
      toast.error(
        error instanceof Error
          ? error.message
          : "The account could not be updated.",
      );
      return false;
    }
  }

  async function onSubmit(values: AccountEditValues) {
    if (accountStatusChanged(account.status, values.status)) {
      setPendingValues(values);
      return;
    }
    await saveAccount(values);
  }

  async function confirmSave() {
    if (!pendingValues) return;
    if (await saveAccount(pendingValues)) {
      setPendingValues(null);
    }
  }

  function cancelStatusChange() {
    setPendingValues(null);
    form.setValue("status", resolveAccountStatus(account.status), {
      shouldDirty: false,
      shouldValidate: true,
    });
  }

  return (
    <>
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
              name="status"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Status changes apply to the account household and eligible
                    connected students.
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
      <AlertDialog
        open={pendingValues !== null}
        onOpenChange={(open) => {
          if (!open) cancelStatusChange();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingValues
                ? accountStatusConfirmationCopy({
                    status: pendingValues.status,
                    householdName: statusImpact?.householdName,
                    accountName: getAccountName(account),
                  })
                : "Change account status?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValues?.status === "inactive"
                ? "This will drop current enrollments, remove pending or waitlisted requests, and cancel active per-session selections for affected students."
                : "Accounts and students will be reactivated, but prior enrollments and session selections will not be restored."}
              {statusImpact ? (
                <>
                  {" "}
                  {statusImpact.affectedAccountCount} account
                  {statusImpact.affectedAccountCount === 1 ? "" : "s"} and{" "}
                  {statusImpact.studentCount} student
                  {statusImpact.studentCount === 1 ? "" : "s"} will change.
                  {statusImpact.skippedSharedStudentCount > 0
                    ? ` ${statusImpact.skippedSharedStudentCount} shared student${statusImpact.skippedSharedStudentCount === 1 ? " has" : "s have"} another active account and will remain active.`
                    : ""}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={form.formState.isSubmitting}
              onClick={cancelStatusChange}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={form.formState.isSubmitting || !statusImpact}
              onClick={(event) => {
                event.preventDefault();
                void confirmSave();
              }}
            >
              {form.formState.isSubmitting ? "Saving..." : "Confirm changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
