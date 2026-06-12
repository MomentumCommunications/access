import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ChartPie, Pencil } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { formatAge, formatTimeRange } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/students/$studentId")({
  component: AdminStudentDetailPage,
});

type EnrollmentStatus = "pending" | "enrolled" | "waitlisted" | "dropped";
type BillingTreatment = "" | "prorate" | "full";

type AdminStudentData = NonNullable<
  FunctionReturnType<typeof api.classes.adminGetStudent>
>;
type EnrollmentRow = AdminStudentData["enrollments"][number];

function todayValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatWeeklyHours(weeklyMinutes: number) {
  const hours = weeklyMinutes / 60;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(hours)} ${hours === 1 ? "hour" : "hours"}`;
}

function formatClassOptionLabel(
  classItem: FunctionReturnType<
    typeof api.classes.adminListClasses
  >[number]["classItem"],
) {
  const schedule =
    classItem.scheduleSummary ||
    [
      [classItem.startDate, classItem.endDate].filter(Boolean).join(" - "),
      formatTimeRange(classItem.startTime, classItem.endTime),
    ]
      .filter(Boolean)
      .join(" · ");

  return schedule ? `${classItem.title} · ${schedule}` : classItem.title;
}

const columns: ColumnDef<EnrollmentRow>[] = [
  {
    accessorFn: (row) => row.classItem?.title || "",
    id: "class",
    header: "Class",
    cell: ({ row }) =>
      row.original.classItem ? (
        <Button asChild variant="link" className="h-auto p-0">
          <Link
            to="/admin/classes/$classId"
            params={{ classId: row.original.classItem._id }}
          >
            {row.original.classItem.title}
          </Link>
        </Button>
      ) : (
        "Missing class"
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "startDate",
    header: "Starts",
    cell: ({ row }) => row.original.startDate || "Now",
  },
  {
    accessorKey: "endDate",
    header: "Ends",
    cell: ({ row }) => row.original.endDate || "Open",
  },
  {
    id: "proration",
    header: "Tuition",
    cell: ({ row }) =>
      row.original.prorateTuition === false ? "Full period" : "Prorated",
  },
  {
    id: "requestedBy",
    header: "Requested by",
    cell: ({ row }) => row.original.requestedBy?.name || "Not set",
  },
];

function AdminStudentDetailPage() {
  const { studentId } = Route.useParams();
  const studentData = useConvexQuery(api.classes.adminGetStudent, {
    student: studentId as Id<"students">,
  });
  const classes = useConvexQuery(api.classes.adminListClasses, {});
  const weeklyClassMinutes = useConvexQuery(
    api.billing.adminWeeklyClassMinutes,
    { asOfDate: todayValue() },
  );
  const enrollStudent = useConvexMutation(api.classes.adminEnrollStudentInClass);
  const [selectedClass, setSelectedClass] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus>("enrolled");
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState("");
  const [billingTreatment, setBillingTreatment] =
    useState<BillingTreatment>("");
  const studentWeeklyMinutes =
    weeklyClassMinutes?.find((row) => row.studentId === studentId)
      ?.weeklyMinutes || 0;
  const classOptions = useMemo(
    () =>
      (classes || []).map((row) => ({
        value: row.classItem._id,
        label: formatClassOptionLabel(row.classItem),
      })),
    [classes],
  );

  async function handleEnroll(event: FormEvent) {
    event.preventDefault();
    await enrollStudent({
      student: studentId as Id<"students">,
      classId: selectedClass as Id<"classes">,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      prorateTuition:
        status === "enrolled" ? billingTreatment === "prorate" : undefined,
    });
    setSelectedClass("");
    setStatus("enrolled");
    setStartDate(todayValue());
    setEndDate("");
    setBillingTreatment("");
  }

  return (
    <RoleGate allow="admin">
      {studentData === undefined || classes === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !studentData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Student not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[22rem_1fr] lg:p-8">
          <section className="space-y-4">
            <Card className="rounded-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      {studentData.student.firstName}{" "}
                      {studentData.student.lastName}
                    </CardTitle>
                    <CardDescription>
                      {studentData.student.preferredName || "No preferred name"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="icon" variant="outline">
                      <Link
                        to="/admin/students/$studentId/report"
                        params={{ studentId: studentData.student._id }}
                      >
                        <ChartPie />
                        <span className="sr-only">View attendance report</span>
                      </Link>
                    </Button>
                    <Button asChild size="icon" variant="outline">
                      <Link
                        to="/admin/students/$studentId/edit"
                        params={{ studentId: studentData.student._id }}
                      >
                        <Pencil />
                        <span className="sr-only">Edit student</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {studentData.photoUrl ? (
                    <img
                      src={studentData.photoUrl}
                      alt={`${studentData.student.firstName} ${studentData.student.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl font-semibold text-muted-foreground">
                      {studentData.student.firstName.slice(0, 1)}
                      {studentData.student.lastName.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div>Status: {studentData.student.status}</div>
                <div>
                  Birthday: {studentData.student.dateOfBirth || "Not set"}
                </div>
                <div>Age: {formatAge(studentData.student.dateOfBirth)}</div>
                <div>Contacts: {studentData.contacts.length}</div>
                <div>
                  Weekly class hours:{" "}
                  {weeklyClassMinutes === undefined ? (
                    <Spinner className="inline size-3.5" />
                  ) : (
                    formatWeeklyHours(studentWeeklyMinutes)
                  )}
                </div>
                {studentData.student.notes ? (
                  <div>
                    <div className="font-medium">Notes</div>
                    <p className="text-muted-foreground">
                      {studentData.student.notes}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Add to class</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleEnroll}>
                  <div className="space-y-1">
                    <Label>Class</Label>
                    <Combobox
                      items={classOptions.map((option) => option.value)}
                      value={selectedClass || null}
                      onValueChange={(value) => setSelectedClass(value || "")}
                      itemToStringLabel={(value) =>
                        classOptions.find((option) => option.value === value)
                          ?.label || ""
                      }
                    >
                      <ComboboxInput
                        className="w-full"
                        placeholder="Select class"
                        showClear
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No classes found.</ComboboxEmpty>
                        <ComboboxList>
                          {(value: string) => (
                            <ComboboxItem key={value} value={value}>
                              {classOptions.find(
                                (option) => option.value === value,
                              )?.label || value}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => {
                        setStatus(value as EnrollmentStatus)
                        if (value !== "enrolled") setBillingTreatment("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="enrolled">Enrolled</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                        <SelectItem value="dropped">Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {status === "enrolled" ? (
                    <div className="space-y-1">
                      <Label>Tuition treatment</Label>
                      <Select
                        value={billingTreatment}
                        onValueChange={(value) =>
                          setBillingTreatment(value as BillingTreatment)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose billing treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prorate">
                            Prorate for enrollment dates
                          </SelectItem>
                          <SelectItem value="full">
                            Charge the full billing period
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="student-enrollment-start">
                        Start date
                      </Label>
                      <Input
                        id="student-enrollment-start"
                        type="date"
                        required
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="student-enrollment-end">End date</Label>
                      <Input
                        id="student-enrollment-end"
                        type="date"
                        required={status === "dropped"}
                        min={startDate}
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !selectedClass ||
                      (status === "enrolled" && !billingTreatment)
                    }
                  >
                    Add to Class
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
          <section className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold">Enrollments</h1>
              <p className="text-muted-foreground">
                Classes connected to this student.
              </p>
            </div>
            <DataTable
              columns={columns}
              data={studentData.enrollments}
              filterColumn="class"
              filterPlaceholder="Filter classes..."
            />
          </section>
        </main>
      )}
    </RoleGate>
  );
}
