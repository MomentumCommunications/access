import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { Save, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleGate } from "~/components/role-gate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { formatDateTime, toDateTimeLocalValue } from "~/lib/date-utils";

export const Route = createFileRoute(
  "/_app/admin/privates/$privateId_/$privateLessonId",
)({
  component: PrivateLessonDetailPage,
});

const lessonStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);
const studentStatuses = [
  "scheduled",
  "attended",
  "excused",
  "no_show",
  "cancelled",
] as const;
type StudentStatus = (typeof studentStatuses)[number];

const lessonFormSchema = z.object({
  startsAt: z.string().min(1, "Start date and time are required."),
  durationMinutes: z
    .string()
    .refine(
      (value) =>
        Number.isInteger(Number(value)) &&
        Number(value) >= 1 &&
        Number(value) <= 480,
      "Duration must be a whole number between 1 and 480.",
    ),
  status: lessonStatusSchema,
  notes: z.string().max(2000),
});

type LessonFormValues = z.infer<typeof lessonFormSchema>;

function studentName(student: Doc<"students">) {
  return `${student.firstName} ${student.lastName}`;
}

function ParticipantRow({
  row,
  lessonStatus,
}: {
  row: {
    participation: Doc<"privateLessonStudents">;
    student: Doc<"students"> | null;
  };
  lessonStatus: Doc<"privateLessons">["status"];
}) {
  const updateStudent = useConvexMutation(
    api.privates.updatePrivateLessonStudent,
  );
  const removeStudent = useConvexMutation(
    api.privates.removePrivateLessonStudent,
  );
  const [status, setStatus] = useState<StudentStatus>(
    row.participation.status,
  );
  const [billable, setBillable] = useState(row.participation.billable);
  const [notes, setNotes] = useState(row.participation.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(row.participation.status);
    setBillable(row.participation.billable);
    setNotes(row.participation.notes || "");
  }, [row.participation]);

  async function persist(
    nextStatus: StudentStatus,
    nextBillable: boolean,
    nextNotes: string,
  ) {
    setIsSaving(true);
    try {
      await updateStudent({
        privateLessonStudentId: row.participation._id,
        status: nextStatus,
        billable: nextBillable,
        notes: nextNotes.trim() || undefined,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update student state.",
      );
      setStatus(row.participation.status);
      setBillable(row.participation.billable);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(nextStatus: StudentStatus) {
    const nextBillable = nextStatus === "cancelled" ? false : billable;
    setStatus(nextStatus);
    setBillable(nextBillable);
    await persist(nextStatus, nextBillable, notes);
  }

  async function handleBillableChange(nextBillable: boolean) {
    setBillable(nextBillable);
    await persist(status, nextBillable, notes);
  }

  async function handleRemove() {
    if (!row.student) return;
    try {
      await removeStudent({
        privateLessonId: row.participation.privateLessonId,
        studentId: row.student._id,
      });
      toast.success("Student removed from lesson.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove student.",
      );
    }
  }

  return (
    <TableRow>
      <TableCell className="min-w-44 font-medium">
        {row.student ? studentName(row.student) : "Student not found"}
      </TableCell>
      <TableCell className="min-w-40">
        <Select
          value={status}
          onValueChange={(value) =>
            handleStatusChange(value as StudentStatus)
          }
          disabled={isSaving || lessonStatus === "cancelled"}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {studentStatuses.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "no_show" ? "No-show" : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            aria-label={`Billable for ${
              row.student ? studentName(row.student) : "student"
            }`}
            checked={billable}
            onCheckedChange={handleBillableChange}
            disabled={
              isSaving ||
              status === "cancelled" ||
              lessonStatus === "cancelled"
            }
          />
          <span className="text-sm">{billable ? "Yes" : "No"}</span>
        </div>
      </TableCell>
      <TableCell className="min-w-64">
        <div className="flex items-center gap-2">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional note"
            disabled={isSaving}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Save note"
            onClick={() => persist(status, billable, notes)}
            disabled={isSaving}
          >
            {isSaving ? <Spinner /> : <Save />}
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Remove student"
              disabled={!row.student || isSaving}
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove student from lesson?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes their participation and billing state for this
                occurrence.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemove}>
                Remove Student
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function PrivateLessonDetailPage() {
  const { privateId, privateLessonId } = Route.useParams();
  const data = useConvexQuery(api.privates.getPrivateLesson, {
    privateLessonId,
  });
  const updateLesson = useConvexMutation(api.privates.updatePrivateLesson);
  const addStudent = useConvexMutation(
    api.privates.addPrivateLessonStudent,
  );
  const [selectedStudent, setSelectedStudent] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    values: data
      ? {
          startsAt: toDateTimeLocalValue(data.lesson.startsAt),
          durationMinutes: String(data.lesson.durationMinutes),
          status: data.lesson.status,
          notes: data.lesson.notes || "",
        }
      : undefined,
    defaultValues: {
      startsAt: "",
      durationMinutes: "60",
      status: "scheduled",
      notes: "",
    },
  });
  const existingStudentIds = useMemo(
    () => new Set(data?.students.map((row) => row.participation.studentId)),
    [data?.students],
  );
  const studentOptions =
    data?.availableStudents
      .filter((student) => !existingStudentIds.has(student._id))
      .sort((a, b) => studentName(a).localeCompare(studentName(b))) || [];

  async function onSubmit(values: LessonFormValues) {
    form.clearErrors("root");
    const startsAt = new Date(values.startsAt).getTime();
    try {
      await updateLesson({
        privateLessonId,
        startsAt,
        durationMinutes: Number(values.durationMinutes),
        status: values.status,
        notes: values.notes.trim() || undefined,
      });
      toast.success("Lesson updated.");
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Unable to update lesson.",
      });
    }
  }

  async function handleAddStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedStudent) return;
    setIsAddingStudent(true);
    try {
      await addStudent({
        privateLessonId,
        studentId: selectedStudent as Id<"students">,
      });
      setSelectedStudent("");
      toast.success("Student added to lesson.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add student.",
      );
    } finally {
      setIsAddingStudent(false);
    }
  }

  return (
    <RoleGate allow="staff">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 lg:p-8">
        {data === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : data.private._id !== privateId ? (
          <p className="text-destructive">This lesson does not match the URL.</p>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold">{data.private.name}</h1>
              <p className="text-muted-foreground">
                {formatDateTime(data.lesson.startsAt)}
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
              <Card className="h-fit rounded-lg">
                <CardHeader>
                  <CardTitle>Lesson details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                      <Field data-invalid={!!form.formState.errors.startsAt}>
                        <FieldLabel htmlFor="private-lesson-start">
                          Starts
                        </FieldLabel>
                        <Input
                          id="private-lesson-start"
                          type="datetime-local"
                          {...form.register("startsAt")}
                        />
                        <FieldError
                          errors={[form.formState.errors.startsAt]}
                        />
                      </Field>
                      <Field
                        data-invalid={
                          !!form.formState.errors.durationMinutes
                        }
                      >
                        <FieldLabel htmlFor="private-lesson-duration">
                          Duration (minutes)
                        </FieldLabel>
                        <Input
                          id="private-lesson-duration"
                          type="number"
                          min={1}
                          max={480}
                          {...form.register("durationMinutes")}
                        />
                        <FieldError
                          errors={[form.formState.errors.durationMinutes]}
                        />
                      </Field>
                      <Field data-invalid={!!form.formState.errors.status}>
                        <FieldLabel>Status</FieldLabel>
                        <Select
                          value={form.watch("status")}
                          onValueChange={(value) =>
                            form.setValue(
                              "status",
                              value as LessonFormValues["status"],
                              { shouldDirty: true },
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError errors={[form.formState.errors.status]} />
                      </Field>
                      <Field data-invalid={!!form.formState.errors.notes}>
                        <FieldLabel htmlFor="private-lesson-notes">
                          Notes
                        </FieldLabel>
                        <Textarea
                          id="private-lesson-notes"
                          rows={4}
                          {...form.register("notes")}
                        />
                        <FieldError errors={[form.formState.errors.notes]} />
                      </Field>
                      <FieldError errors={[form.formState.errors.root]} />
                      <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting
                          ? "Saving..."
                          : "Save Lesson"}
                      </Button>
                    </FieldGroup>
                  </form>
                </CardContent>
              </Card>

              <Card className="min-w-0 rounded-lg">
                <CardHeader>
                  <CardTitle>Students</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={handleAddStudent}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label>Student</Label>
                      <Combobox
                        items={studentOptions.map((student) => student._id)}
                        value={selectedStudent || null}
                        onValueChange={(value) =>
                          setSelectedStudent(value || "")
                        }
                        itemToStringLabel={(value) =>
                          studentOptions.find(
                            (student) => student._id === value,
                          )
                            ? studentName(
                                studentOptions.find(
                                  (student) => student._id === value,
                                )!,
                              )
                            : ""
                        }
                      >
                        <ComboboxInput
                          className="w-full"
                          placeholder="Select student"
                          disabled={
                            data.students.length >= 3 ||
                            data.lesson.status === "cancelled"
                          }
                          showClear
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No students found.</ComboboxEmpty>
                          <ComboboxList>
                            {(value: string) => {
                              const student = studentOptions.find(
                                (option) => option._id === value,
                              );
                              return (
                                <ComboboxItem key={value} value={value}>
                                  {student ? studentName(student) : value}
                                </ComboboxItem>
                              );
                            }}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                    <Button
                      type="submit"
                      className="sm:mt-6"
                      disabled={
                        !selectedStudent ||
                        isAddingStudent ||
                        data.students.length >= 3 ||
                        data.lesson.status === "cancelled"
                      }
                    >
                      {isAddingStudent ? <Spinner /> : <UserPlus />}
                      Add Student
                    </Button>
                  </form>
                  {data.students.length >= 3 ? (
                    <p className="text-sm text-muted-foreground">
                      This lesson has the maximum of three students.
                    </p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Billable</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.students.length ? (
                        data.students.map((row) => (
                          <ParticipantRow
                            key={row.participation._id}
                            row={row}
                            lessonStatus={data.lesson.status}
                          />
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No students have been added to this lesson.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </RoleGate>
  );
}
