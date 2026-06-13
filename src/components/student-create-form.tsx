import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldContent,
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
import { Textarea } from "~/components/ui/textarea";

const studentCreateSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80, "First name must be 80 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(80, "Last name must be 80 characters or fewer."),
  preferredName: z
    .string()
    .max(80, "Preferred name must be 80 characters or fewer."),
  dateOfBirth: z.string(),
  gender: z.enum(["", "Female", "Male"]),
  school: z.string().max(160, "School must be 160 characters or fewer."),
  allergies: z
    .string()
    .max(1000, "Allergies must be 1000 characters or fewer."),
  recital: z.boolean(),
  relationship: z
    .string()
    .max(80, "Relationship must be 80 characters or fewer."),
  groupId: z.string(),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer."),
});

type StudentCreateValues = z.infer<typeof studentCreateSchema>;

const defaultValues: StudentCreateValues = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  gender: "",
  school: "",
  allergies: "",
  recital: false,
  relationship: "",
  groupId: "",
  notes: "",
};

type StudentCreateFormProps = {
  mode: "admin" | "member";
  groups?: Array<{ _id: Id<"groups">; name: string }>;
  accountId?: Id<"users">;
};

function StudentCreateForm({
  mode,
  groups = [],
  accountId,
}: StudentCreateFormProps) {
  const navigate = useNavigate();
  const createMyStudent = useConvexMutation(
    api.classes.createStudentForCurrentUser,
  );
  const adminCreateStudent = useConvexMutation(api.classes.adminCreateStudent);
  const form = useForm<StudentCreateValues>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues,
    mode: "onTouched",
  });

  async function onSubmit(values: StudentCreateValues) {
    form.clearErrors("root");

    try {
      const common = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName.trim() || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender,
        school: values.school.trim(),
        allergies: values.allergies.trim(),
        recital: values.recital,
      };

      if (mode === "admin") {
        await adminCreateStudent({
          ...common,
          groupId: values.groupId
            ? (values.groupId as Id<"groups">)
            : undefined,
          notes: values.notes.trim() || undefined,
          accountUser: accountId,
          relationship: accountId
            ? values.relationship.trim() || undefined
            : undefined,
        });
        if (accountId) {
          await navigate({
            to: "/admin/accounts/$userId",
            params: { userId: accountId },
          });
        } else {
          await navigate({ to: "/admin/students" });
        }
      } else {
        await createMyStudent({
          ...common,
          relationship: values.relationship.trim() || undefined,
        });
        await navigate({ to: "/students" });
      }
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The student could not be created. Please try again.",
      });
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Student details</CardTitle>
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
                        aria-invalid={fieldState.invalid}
                        autoComplete={
                          name === "firstName" ? "given-name" : "family-name"
                        }
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="preferredName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Preferred name
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="dateOfBirth"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Birthday</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="date"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="gender"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Gender</FieldLabel>
                    <Select
                      value={field.value || "not-specified"}
                      onValueChange={(value) =>
                        field.onChange(value === "not-specified" ? "" : value)
                      }
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-specified">
                          Not specified
                        </SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {mode === "admin" ? (
                <>
                  <Controller
                    name="groupId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Group</FieldLabel>
                        <Select
                          value={field.value || "unassigned"}
                          onValueChange={(value) =>
                            field.onChange(value === "unassigned" ? "" : value)
                          }
                        >
                          <SelectTrigger
                            id={field.name}
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group._id} value={group._id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  {accountId ? (
                    <Controller
                      name="relationship"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={field.name}>
                            Account relationship
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            aria-invalid={fieldState.invalid}
                            placeholder="Parent, guardian..."
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ) : null}
                </>
              ) : (
                <Controller
                  name="relationship"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Relationship
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              )}
            </div>

            <Controller
              name="school"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>School</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="allergies"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Allergies</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    className="min-h-24"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {mode === "admin" ? (
              <Controller
                name="notes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      className="min-h-24"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}

            <Controller
              name="recital"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  orientation="horizontal"
                  data-invalid={fieldState.invalid}
                >
                  <Checkbox
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>
                      Participates in recital
                    </FieldLabel>
                    <FieldError errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
          </FieldGroup>

          {form.formState.errors.root?.message ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {form.formState.errors.root.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild type="button">
              {mode === "admin" && accountId ? (
                <Link
                  to="/admin/accounts/$userId"
                  params={{ userId: accountId }}
                >
                  Cancel
                </Link>
              ) : (
                <Link to={mode === "admin" ? "/admin/students" : "/students"}>
                  Cancel
                </Link>
              )}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adding..." : "Add Student"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MemberStudentCreateForm() {
  return <StudentCreateForm mode="member" />;
}

export function AdminStudentCreateForm({
  accountId,
}: {
  accountId?: Id<"users">;
} = {}) {
  const groups = useConvexQuery(api.classes.adminListStudentGroups, {});

  return (
    <StudentCreateForm
      mode="admin"
      groups={groups ?? []}
      accountId={accountId}
    />
  );
}
