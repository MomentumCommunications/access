import { useConvexMutation } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
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
};

export function StudentEditForm({
  mode,
  student,
  photoUrl,
  backTo,
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

  async function onSubmit(values: StudentFormValues) {
    form.clearErrors("root");

    try {
      const photo = await uploadPhoto(values.photo);
      const updates = {
        student: student._id,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName.trim() || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        notes: values.notes.trim() || undefined,
        status: values.status,
        ...(photo ? { photo } : {}),
      };

      if (mode === "admin") {
        await adminUpdateStudent(updates);
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
  );
}
