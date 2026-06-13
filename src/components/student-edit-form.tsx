import { useConvexMutation } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { requiresStudentStatusConfirmation } from "../../shared/student-status";
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

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const studentFormSchema = z.object({
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
  groupId: z.string(),
  school: z.string().max(160, "School must be 160 characters or fewer."),
  allergies: z
    .string()
    .max(1000, "Allergies must be 1000 characters or fewer."),
  recital: z.boolean(),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer."),
  status: z.enum(["active", "inactive", "archived"]),
  photo: z.custom<File | null>().superRefine((file, ctx) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      ctx.addIssue({ code: "custom", message: "Choose an image file." });
    }
    if (file.size > MAX_PHOTO_SIZE) {
      ctx.addIssue({
        code: "custom",
        message: "Photo must be 5 MB or smaller.",
      });
    }
  }),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

type StudentEditFormProps = {
  mode: "admin" | "member";
  student: Doc<"students">;
  photoUrl?: string | null;
  backTo: string;
  groups?: Array<{ _id: Id<"groups">; name: string }>;
};

function StudentEditForm({
  mode,
  student,
  photoUrl,
  backTo,
  groups = [],
}: StudentEditFormProps) {
  const navigate = useNavigate();
  const generateUploadUrl = useConvexMutation(
    api.classes.generateStudentPhotoUploadUrl,
  );
  const updateMyStudent = useConvexMutation(api.classes.updateMyStudent);
  const adminUpdateStudent = useConvexMutation(api.classes.adminUpdateStudent);
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: student.firstName,
      lastName: student.lastName,
      preferredName: student.preferredName || "",
      dateOfBirth: student.dateOfBirth || "",
      gender: student.gender || "",
      groupId: student.groupId || "",
      school: student.school || "",
      allergies: student.allergies || "",
      recital: student.recital ?? false,
      notes: student.notes || "",
      status: student.status,
      photo: null,
    },
    mode: "onTouched",
  });
  const selectedPhoto = form.watch("photo");
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const previewUrl = useMemo(
    () => (selectedPhoto ? URL.createObjectURL(selectedPhoto) : null),
    [selectedPhoto],
  );
  const displayedPhoto = previewUrl || photoUrl;
  const [pendingAdminValues, setPendingAdminValues] =
    useState<StudentFormValues | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function uploadPhoto(photo: File | null) {
    if (!photo) return undefined;

    const postUrl = await generateUploadUrl({});
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": photo.type || "image/jpeg" },
      body: photo,
    });

    if (!result.ok) {
      throw new Error("Photo upload failed.");
    }

    const { storageId } = (await result.json()) as {
      storageId: Id<"_storage">;
    };
    return storageId;
  }

  async function saveStudent(values: StudentFormValues) {
    form.clearErrors("root");

    try {
      const photo = await uploadPhoto(values.photo);
      const updates = {
        student: student._id,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName.trim() || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender,
        school: values.school.trim(),
        allergies: values.allergies.trim(),
        recital: values.recital,
        notes: values.notes.trim() || undefined,
        ...(photo ? { photo } : {}),
      };

      if (mode === "admin") {
        await adminUpdateStudent({
          ...updates,
          status: values.status,
          groupId: values.groupId
            ? (values.groupId as Id<"groups">)
            : null,
        });
      } else {
        await updateMyStudent(updates);
      }

      await navigate({ to: backTo as never });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The student could not be saved. Please try again.",
      });
    }
  }

  async function onSubmit(values: StudentFormValues) {
    if (
      mode === "admin" &&
      requiresStudentStatusConfirmation(student.status, values.status)
    ) {
      setPendingAdminValues(values);
      return;
    }
    await saveStudent(values);
  }

  async function confirmStatusChange() {
    if (!pendingAdminValues) return;
    setIsConfirmingStatus(true);
    try {
      await saveStudent(pendingAdminValues);
      setPendingAdminValues(null);
    } finally {
      setIsConfirmingStatus(false);
    }
  }

  return (
    <>
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
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {displayedPhoto ? (
                  <img
                    src={displayedPhoto}
                    alt={`${firstName} ${lastName}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    {firstName.slice(0, 1)}
                    {lastName.slice(0, 1)}
                  </span>
                )}
              </div>
              <Controller
                name="photo"
                control={form.control}
                render={({ field: { onChange, name }, fieldState }) => (
                  <Field
                    className="w-full"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor={name}>Photo</FieldLabel>
                    <Input
                      id={name}
                      name={name}
                      type="file"
                      accept="image/*"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) =>
                        onChange(event.target.files?.[0] || null)
                      }
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

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
              ) : null}
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
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
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
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
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
                    className="min-h-28"
                  />
                  <FieldError errors={[fieldState.error]} />
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
              <Link to={backTo as never}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Student"}
            </Button>
          </div>
        </form>
      </CardContent>
      </Card>

      <AlertDialog
        open={pendingAdminValues !== null}
        onOpenChange={(open) => {
          if (!open && !isConfirmingStatus) {
            setPendingAdminValues(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change this student to {pendingAdminValues?.status}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Active enrollments will be ended today, pending and waitlisted
              requests will be removed, and this student will no longer appear
              in tuition calculations. Existing dropped enrollment history
              will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirmingStatus}
              onClick={(event) => {
                event.preventDefault();
                void confirmStatusChange();
              }}
            >
              {isConfirmingStatus ? "Updating..." : "Confirm change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type MemberStudentEditFormProps = Omit<
  StudentEditFormProps,
  "mode" | "groups"
>;

export function MemberStudentEditForm(props: MemberStudentEditFormProps) {
  return <StudentEditForm {...props} mode="member" />;
}

type AdminStudentEditFormProps = Omit<StudentEditFormProps, "mode">;

export function AdminStudentEditForm(props: AdminStudentEditFormProps) {
  return <StudentEditForm {...props} mode="admin" />;
}
