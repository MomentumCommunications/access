import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Plus, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
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

const studentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  preferredName: z.string().max(80),
  dateOfBirth: z.string(),
  gender: z.enum(["", "Female", "Male"]),
  school: z.string().max(160),
  allergies: z.string().max(1000),
  recital: z.boolean(),
  relationship: z.string().max(80),
});

type StudentValues = z.infer<typeof studentSchema>;

const emptyStudent: StudentValues = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  gender: "",
  school: "",
  allergies: "",
  recital: false,
  relationship: "",
};

export function StudentsStep() {
  const navigate = useNavigate();
  const state = useConvexQuery(api.onboarding.getState, {});
  const addStudent = useConvexMutation(api.onboarding.addStudent);
  const removeStudent = useConvexMutation(api.onboarding.removeStudent);
  const setStep = useConvexMutation(api.onboarding.setStep);
  const form = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyStudent,
    mode: "onTouched",
  });
  const createdIds = new Set(state?.onboarding?.createdStudentIds ?? []);
  const students = state?.students ?? [];

  async function onSubmit(values: StudentValues) {
    form.clearErrors("root");
    try {
      await addStudent({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName.trim() || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender,
        school: values.school.trim(),
        allergies: values.allergies.trim(),
        recital: values.recital,
        relationship: values.relationship.trim() || undefined,
      });
      form.reset(emptyStudent);
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The student could not be added.",
      });
    }
  }

  async function handleContinue() {
    await setStep({ step: "review" });
    await navigate({ to: "/register/review" });
  }

  async function handleRemove(student: Id<"students">) {
    form.clearErrors("root");
    try {
      await removeStudent({ student });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The student could not be removed.",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Students</h1>
        <p className="mt-1 text-muted-foreground">
          Add each student connected to this account.
        </p>
      </div>

      {students.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Added students">
          {students.map(({ student }) => {
            const wasCreated = createdIds.has(student._id);
            return (
              <Badge
                key={student._id}
                variant="secondary"
                className="gap-1.5 py-1 pl-2.5 pr-1"
              >
                <span>
                  {student.preferredName || student.firstName} {student.lastName}
                </span>
                {wasCreated ? (
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-foreground/10"
                    aria-label={`Remove ${student.firstName} ${student.lastName}`}
                    onClick={() => void handleRemove(student._id)}
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <span className="rounded-sm bg-background/70 px-1 text-[10px] font-normal">
                    Imported
                  </span>
                )}
              </Badge>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add a student</CardTitle>
          <CardDescription>
            Save this student, then add another or continue.
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
                          aria-invalid={fieldState.invalid}
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
                          className="w-full"
                          aria-invalid={fieldState.invalid}
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
                <Controller
                  name="relationship"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Your relationship
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="Parent, guardian, self..."
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
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
                      className="min-h-20"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

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
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
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
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={students.length === 0}
                onClick={() => void handleContinue()}
              >
                Continue to review
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Plus className="size-4" />
                {form.formState.isSubmitting ? "Adding..." : "Add student"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
