import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { X } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { getAccountName } from "~/lib/account-name";
import { hasUserRole } from "~/lib/roles";

const weekdaySchema = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const privateFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    instructorId: z.string().min(1, "Select an instructor."),
    studentIds: z
      .array(z.string())
      .min(1, "Select at least one student.")
      .max(3, "A private can include at most three students."),
    defaultDurationMinutes: z
      .string()
      .refine(
        (value) =>
          Number.isInteger(Number(value)) &&
          Number(value) >= 1 &&
          Number(value) <= 480,
        "Duration must be a whole number between 1 and 480.",
      ),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    startTime: z.string().min(1, "Start time is required."),
    weekdays: z.array(weekdaySchema).min(1, "Select at least one weekday."),
    timezone: z.string().min(1),
    isActive: z.boolean(),
    notes: z.string().max(2000),
  })
  .superRefine((values, ctx) => {
    if (values.endDate < values.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

type PrivateFormValues = z.infer<typeof privateFormSchema>;
type Weekday = z.infer<typeof weekdaySchema>;

const weekdays: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const defaultValues: PrivateFormValues = {
  name: "",
  instructorId: "",
  studentIds: [],
  defaultDurationMinutes: "60",
  startDate: "",
  endDate: "",
  startTime: "",
  weekdays: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  isActive: true,
  notes: "",
};

function valuesFromPrivate(privateSeries: Doc<"privates">): PrivateFormValues {
  return {
    name: privateSeries.name,
    instructorId: privateSeries.instructorId,
    studentIds: privateSeries.studentIds || [],
    defaultDurationMinutes: String(privateSeries.defaultDurationMinutes),
    startDate: privateSeries.schedulePrompt.startDate,
    endDate: privateSeries.schedulePrompt.endDate,
    startTime: privateSeries.schedulePrompt.startTime,
    weekdays: privateSeries.schedulePrompt.weekdays,
    timezone: privateSeries.schedulePrompt.timezone,
    isActive: privateSeries.isActive,
    notes: privateSeries.notes || "",
  };
}

type PrivateFormProps =
  | { mode: "create"; privateSeries?: never; privateId?: never }
  | {
      mode: "edit";
      privateSeries: Doc<"privates">;
      privateId: Id<"privates">;
    };

export function PrivateForm(props: PrivateFormProps) {
  const navigate = useNavigate();
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const students = useConvexQuery(api.classes.adminListStudents, {});
  const createPrivate = useConvexMutation(api.privates.adminCreatePrivate);
  const updatePrivate = useConvexMutation(api.privates.adminUpdatePrivate);
  const form = useForm<PrivateFormValues>({
    resolver: zodResolver(privateFormSchema),
    defaultValues:
      props.mode === "edit"
        ? valuesFromPrivate(props.privateSeries)
        : defaultValues,
    mode: "onTouched",
  });
  const [studentSearch, setStudentSearch] = useState("");
  const instructors =
    accounts?.filter(
      (account) =>
        hasUserRole(account, "staff") || hasUserRole(account, "admin"),
    ) || [];

  async function onSubmit(values: PrivateFormValues) {
    form.clearErrors("root");
    const payload = {
      name: values.name.trim(),
      instructorId: values.instructorId as Id<"users">,
      studentIds: values.studentIds as Id<"students">[],
      defaultDurationMinutes: Number(values.defaultDurationMinutes),
      schedulePrompt: {
        startDate: values.startDate,
        endDate: values.endDate,
        startTime: values.startTime,
        weekdays: values.weekdays,
        timezone: values.timezone,
      },
      isActive: values.isActive,
      notes: values.notes.trim() || undefined,
    };

    try {
      if (props.mode === "create") {
        const privateId = await createPrivate(payload);
        await navigate({
          to: "/admin/privates/$privateId",
          params: { privateId },
        });
      } else {
        await updatePrivate({ privateId: props.privateId, ...payload });
      }
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Unable to save private.",
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="private-name">Name</FieldLabel>
            <Input id="private-name" {...form.register("name")} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Controller
            control={form.control}
            name="instructorId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Instructor</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((account) => (
                      <SelectItem key={account._id} value={account._id}>
                        {getAccountName(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="studentIds"
          render={({ field, fieldState }) => {
            const studentRows = students || [];
            const selectedStudents = field.value
              .map((studentId) =>
                studentRows.find(
                  ({ student }) => student._id === studentId,
                )?.student,
              )
              .filter((student) => student !== undefined);
            const normalizedSearch = studentSearch.trim().toLowerCase();
            const filteredStudents = studentRows
              .filter(({ student }) =>
                `${student.firstName} ${student.lastName}`
                  .toLowerCase()
                  .includes(normalizedSearch),
              )
              .sort((a, b) =>
                `${a.student.firstName} ${a.student.lastName}`.localeCompare(
                  `${b.student.firstName} ${b.student.lastName}`,
                ),
              );

            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Students</FieldLabel>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex min-h-7 flex-wrap gap-2">
                    {selectedStudents.length ? (
                      selectedStudents.map((student) => (
                        <Badge
                          key={student._id}
                          variant="secondary"
                          className="gap-1"
                        >
                          {student.firstName} {student.lastName}
                          <button
                            type="button"
                            className="rounded-sm hover:text-destructive"
                            aria-label={`Remove ${student.firstName} ${student.lastName}`}
                            onClick={() =>
                              field.onChange(
                                field.value.filter(
                                  (studentId) => studentId !== student._id,
                                ),
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Select one to three students.
                      </span>
                    )}
                  </div>
                  <Input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Filter students..."
                  />
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {filteredStudents.map(({ student }) => {
                      const checked = field.value.includes(student._id);
                      const disabled = !checked && field.value.length >= 3;
                      return (
                        <label
                          key={student._id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(nextChecked) =>
                              field.onChange(
                                nextChecked
                                  ? [...field.value, student._id]
                                  : field.value.filter(
                                      (studentId) =>
                                        studentId !== student._id,
                                    ),
                              )
                            }
                          />
                          {student.firstName} {student.lastName}
                        </label>
                      );
                    })}
                    {students && filteredStudents.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        No students found.
                      </p>
                    ) : null}
                  </div>
                </div>
                <FieldError errors={[fieldState.error]} />
              </Field>
            );
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!form.formState.errors.defaultDurationMinutes}>
            <FieldLabel htmlFor="private-duration">
              Default duration (minutes)
            </FieldLabel>
            <Input
              id="private-duration"
              type="number"
              min={1}
              max={480}
              {...form.register("defaultDurationMinutes")}
            />
            <FieldError
              errors={[form.formState.errors.defaultDurationMinutes]}
            />
          </Field>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Field orientation="horizontal" className="self-end rounded-md border p-3">
                <FieldLabel htmlFor="private-active">Active</FieldLabel>
                <Switch
                  id="private-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </Field>
            )}
          />
        </div>

        <FieldSet>
          <FieldLegend>Recurring schedule</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!form.formState.errors.startDate}>
              <FieldLabel htmlFor="private-start-date">Start date</FieldLabel>
              <Input
                id="private-start-date"
                type="date"
                {...form.register("startDate")}
              />
              <FieldError errors={[form.formState.errors.startDate]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.endDate}>
              <FieldLabel htmlFor="private-end-date">End date</FieldLabel>
              <Input
                id="private-end-date"
                type="date"
                {...form.register("endDate")}
              />
              <FieldError errors={[form.formState.errors.endDate]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.startTime}>
              <FieldLabel htmlFor="private-start-time">Start time</FieldLabel>
              <Input
                id="private-start-time"
                type="time"
                {...form.register("startTime")}
              />
              <FieldError errors={[form.formState.errors.startTime]} />
            </Field>
          </div>
          <Controller
            control={form.control}
            name="weekdays"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Weekdays</FieldLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weekdays.map((weekday) => (
                    <label
                      key={weekday}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm capitalize"
                    >
                      <Checkbox
                        checked={field.value.includes(weekday)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, weekday]
                              : field.value.filter((day) => day !== weekday),
                          )
                        }
                      />
                      {weekday}
                    </label>
                  ))}
                </div>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Field data-invalid={!!form.formState.errors.timezone}>
            <FieldLabel htmlFor="private-timezone">Timezone</FieldLabel>
            <Input id="private-timezone" {...form.register("timezone")} />
            <FieldError errors={[form.formState.errors.timezone]} />
          </Field>
        </FieldSet>

        <Field data-invalid={!!form.formState.errors.notes}>
          <FieldLabel htmlFor="private-notes">Notes</FieldLabel>
          <Textarea id="private-notes" rows={4} {...form.register("notes")} />
          <FieldError errors={[form.formState.errors.notes]} />
        </Field>

        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Saving..."
            : props.mode === "create"
              ? "Create Private"
              : "Save Changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}
