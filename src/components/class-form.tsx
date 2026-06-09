import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
import { Textarea } from "~/components/ui/textarea";
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

const classFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(120, "Title must be 120 characters or fewer."),
    description: z
      .string()
      .max(2000, "Description must be 2000 characters or fewer."),
    status: z.enum(["draft", "published", "archived"]),
    scheduleSummary: z
      .string()
      .max(200, "Schedule must be 200 characters or fewer."),
    location: z
      .string()
      .max(200, "Location must be 200 characters or fewer."),
    capacity: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(Number(value)) && Number(value) >= 0),
        "Capacity must be a whole number of zero or more.",
      ),
    minAge: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(Number(value)) && Number(value) >= 0),
        "Minimum age must be a whole number of zero or more.",
      ),
    maxAge: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(Number(value)) && Number(value) >= 0),
        "Maximum age must be a whole number of zero or more.",
      ),
    startDate: z.string(),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    weekdays: z.array(weekdaySchema),
    assignedStaff: z.string(),
    seasonId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (
      values.minAge !== "" &&
      values.maxAge !== "" &&
      Number(values.maxAge) < Number(values.minAge)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAge"],
        message: "Maximum age must be greater than or equal to minimum age.",
      });
    }

    if (
      values.startDate &&
      values.endDate &&
      values.endDate < values.startDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }

    if (
      values.startTime &&
      values.endTime &&
      values.endTime <= values.startTime
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after the start time.",
      });
    }

    const hasRecurringSchedule =
      values.startDate ||
      values.endDate ||
      values.startTime ||
      values.endTime ||
      values.weekdays.length > 0;

    if (hasRecurringSchedule) {
      const requiredFields = [
        ["startDate", values.startDate, "Start date is required."],
        ["endDate", values.endDate, "End date is required."],
        ["startTime", values.startTime, "Start time is required."],
        ["endTime", values.endTime, "End time is required."],
      ] as const;

      requiredFields.forEach(([path, value, message]) => {
        if (!value) {
          ctx.addIssue({ code: "custom", path: [path], message });
        }
      });

      if (values.weekdays.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["weekdays"],
          message: "Select at least one day for a recurring schedule.",
        });
      }
    }
  });

type ClassFormValues = z.infer<typeof classFormSchema>;
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

const emptyValues: ClassFormValues = {
  title: "",
  description: "",
  status: "draft",
  scheduleSummary: "",
  location: "",
  capacity: "",
  minAge: "",
  maxAge: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  weekdays: [],
  assignedStaff: "none",
  seasonId: "none",
};

function valuesFromClass(
  classItem: Doc<"classes">,
  seasonId?: Id<"seasons">,
): ClassFormValues {
  return {
    title: classItem.title,
    description: classItem.description || "",
    status: classItem.status,
    scheduleSummary: classItem.scheduleSummary || "",
    location: classItem.location || "",
    capacity: classItem.capacity?.toString() || "",
    minAge: classItem.minAge?.toString() || "",
    maxAge: classItem.maxAge?.toString() || "",
    startDate: classItem.startDate || "",
    endDate: classItem.endDate || "",
    startTime: classItem.startTime || "",
    endTime: classItem.endTime || "",
    weekdays: classItem.weekdays || [],
    assignedStaff: classItem.assignedStaff?.[0] || "none",
    seasonId: seasonId || "none",
  };
}

type ClassFormProps =
  | { mode: "create"; classItem?: never; classId?: never }
  | {
      mode: "edit";
      classItem: Doc<"classes">;
      classId: Id<"classes">;
      seasonId?: Id<"seasons">;
    };

export function ClassForm(props: ClassFormProps) {
  const navigate = useNavigate();
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const seasons = useConvexQuery(api.classes.adminListSeasons, {});
  const createClass = useConvexMutation(api.classes.adminCreateClass);
  const updateClass = useConvexMutation(api.classes.adminUpdateClass);
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues:
      props.mode === "edit"
        ? valuesFromClass(props.classItem, props.seasonId)
        : emptyValues,
    mode: "onTouched",
  });

  async function onSubmit(values: ClassFormValues) {
    form.clearErrors("root");
    const classValues = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      status: values.status,
      scheduleSummary: values.scheduleSummary.trim() || undefined,
      location: values.location.trim() || undefined,
      capacity: values.capacity === "" ? undefined : Number(values.capacity),
      minAge: values.minAge === "" ? undefined : Number(values.minAge),
      maxAge: values.maxAge === "" ? undefined : Number(values.maxAge),
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
      weekdays: values.weekdays.length ? values.weekdays : undefined,
      assignedStaff:
        values.assignedStaff === "none"
          ? undefined
          : [values.assignedStaff as Id<"users">],
      seasonId:
        values.seasonId === "none"
          ? undefined
          : (values.seasonId as Id<"seasons">),
    };

    try {
      if (props.mode === "create") {
        const classId = await createClass(classValues);
        await navigate({
          to: "/admin/classes/$classId",
          params: { classId },
        });
      } else {
        await updateClass({ classId: props.classId, ...classValues });
        await navigate({
          to: "/admin/classes/$classId",
          params: { classId: props.classId },
        });
      }
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The class could not be saved. Please try again.",
      });
    }
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Title</FieldLabel>
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Description</FieldLabel>
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
        <Controller
          name="seasonId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Season</FieldLabel>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                disabled={seasons === undefined}
              >
                <SelectTrigger
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                >
                  <SelectValue
                    placeholder={
                      seasons === undefined
                        ? "Loading seasons..."
                        : "Select a season"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No season</SelectItem>
                  {seasons?.map(({ season }) => (
                    <SelectItem key={season._id} value={season._id}>
                      {season.name} ({season.startDate} - {season.endDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="scheduleSummary"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Schedule summary</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Mondays, 4:00 - 5:00 PM"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="location"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Location</FieldLabel>
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
            name="capacity"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Capacity</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  min="0"
                  step="1"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["minAge", "maxAge"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {name === "minAge" ? "Minimum age" : "Maximum age"}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    min="0"
                    step="1"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["startDate", "endDate"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {name === "startDate" ? "Start date" : "End date"}
                  </FieldLabel>
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
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["startTime", "endTime"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {name === "startTime" ? "Start time" : "End time"}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="time"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ))}
        </div>
        <Controller
          name="weekdays"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet>
              <FieldLegend variant="label">Days</FieldLegend>
              <FieldGroup
                data-slot="checkbox-group"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {weekdays.map((weekday) => {
                  const id = `class-weekday-${weekday}`;
                  return (
                    <Field
                      key={weekday}
                      orientation="horizontal"
                      data-invalid={fieldState.invalid}
                      className="rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        id={id}
                        name={field.name}
                        checked={field.value.includes(weekday)}
                        aria-invalid={fieldState.invalid}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, weekday]
                              : field.value.filter((day) => day !== weekday),
                          )
                        }
                      />
                      <FieldLabel
                        htmlFor={id}
                        className="font-normal capitalize"
                      >
                        {weekday}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </FieldGroup>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />
        <Controller
          name="assignedStaff"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Assigned staff</FieldLabel>
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
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts
                    ?.filter((account) => hasUserRole(account, "staff"))
                    .map((account) => (
                      <SelectItem key={account._id} value={account._id}>
                        {account.name ||
                          (Array.isArray(account.email)
                            ? account.email[0]
                            : account.email) ||
                          "Unnamed"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
        <Button asChild type="button" variant="outline">
          {props.mode === "edit" ? (
            <Link
              to="/admin/classes/$classId"
              params={{ classId: props.classId }}
            >
              Cancel
            </Link>
          ) : (
            <Link to="/admin/classes">Cancel</Link>
          )}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Saving..."
            : props.mode === "create"
              ? "Create Class"
              : "Save Class"}
        </Button>
      </div>
    </form>
  );
}
