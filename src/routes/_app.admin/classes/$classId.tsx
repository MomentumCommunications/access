import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
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
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import { hasUserRole } from "~/lib/roles";

export const Route = createFileRoute("/_app/admin/classes/$classId")({
  component: AdminClassDetailPage,
});

type SessionStatus = "scheduled" | "cancelled" | "completed";
type EnrollmentStatus = "pending" | "enrolled" | "waitlisted" | "dropped";
type BillingTreatment = "" | "prorate" | "full";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

type AdminClassData = NonNullable<
  FunctionReturnType<typeof api.classes.adminGetClass>
>;
type EnrollmentRow = AdminClassData["enrollments"][number];

function AdminClassDetailPage() {
  const { classId } = Route.useParams();
  const classData = useConvexQuery(api.classes.adminGetClass, {
    classId: classId as Id<"classes">,
  });
  const accounts = useConvexQuery(api.classes.adminListAccounts, {});
  const students = useConvexQuery(api.classes.adminListStudents, {});
  const createSession = useConvexMutation(api.classes.adminCreateSession);
  const setSessionActive = useConvexMutation(api.classes.adminSetSessionActive);
  const enrollStudent = useConvexMutation(
    api.classes.adminEnrollStudentInClass,
  );
  const updateEnrollment = useConvexMutation(
    api.classes.adminUpdateEnrollmentStatus,
  );
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [sessionAssignedStaff, setSessionAssignedStaff] = useState("none");
  const [sessionSubstitute, setSessionSubstitute] = useState("none");
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("scheduled");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [newEnrollmentStatus, setNewEnrollmentStatus] =
    useState<EnrollmentStatus>("enrolled");
  const [enrollmentStartDate, setEnrollmentStartDate] = useState(todayValue);
  const [enrollmentEndDate, setEnrollmentEndDate] = useState("");
  const [billingTreatment, setBillingTreatment] =
    useState<BillingTreatment>("");
  const [enrollmentToActivate, setEnrollmentToActivate] =
    useState<EnrollmentRow | null>(null);
  const studentOptions = useMemo(
    () =>
      (students || []).map((row) => {
        const fullName = `${row.student.firstName} ${row.student.lastName}`;
        return {
          value: row.student._id,
          label: row.student.preferredName
            ? `${row.student.preferredName} (${fullName})`
            : fullName,
        };
      }),
    [students],
  );

  const enrollmentColumns: ColumnDef<EnrollmentRow>[] = [
    {
      accessorFn: (row) =>
        row.student ? `${row.student.firstName} ${row.student.lastName}` : "",
      id: "student",
      header: "Student",
      cell: ({ row }) =>
        row.original.student
          ? `${row.original.student.firstName} ${row.original.student.lastName}`
          : "Missing student",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Select
          value={row.original.status}
          onValueChange={(nextStatus) => {
            if (
              nextStatus === "enrolled" &&
              row.original.status !== "enrolled"
            ) {
              setEnrollmentToActivate(row.original);
              return;
            }
            void updateEnrollment({
              enrollment: row.original._id,
              status: nextStatus as EnrollmentStatus,
              endDate:
                nextStatus === "dropped"
                  ? row.original.endDate ||
                    [todayValue(), row.original.startDate]
                      .filter((date): date is string => !!date)
                      .sort()
                      .at(-1)
                  : row.original.endDate,
            });
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "proration",
      header: "Tuition",
      cell: ({ row }) =>
        row.original.prorateTuition === false
          ? "Full period"
          : "Prorated",
    },
    {
      id: "requestedBy",
      header: "Requested by",
      cell: ({ row }) => row.original.requestedBy?.name || "Not set",
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
  ];

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!classData) return;
    await createSession({
      classId: classId as Id<"classes">,
      date: sessionDate,
      startTime: sessionStart || undefined,
      endTime: sessionEnd || undefined,
      location: classData.classItem.location || undefined,
      assignedStaff:
        sessionAssignedStaff === "none"
          ? undefined
          : [sessionAssignedStaff as Id<"users">],
      substitute:
        sessionSubstitute === "none"
          ? undefined
          : (sessionSubstitute as Id<"users">),
      status: sessionStatus,
    });
    setSessionDate("");
    setSessionStart("");
    setSessionEnd("");
    setSessionAssignedStaff("none");
    setSessionSubstitute("none");
    setSessionStatus("scheduled");
  }

  async function handleAddStudent(event: FormEvent) {
    event.preventDefault();
    await enrollStudent({
      classId: classId as Id<"classes">,
      student: selectedStudent as Id<"students">,
      status: newEnrollmentStatus,
      startDate: enrollmentStartDate || undefined,
      endDate: enrollmentEndDate || undefined,
      prorateTuition:
        newEnrollmentStatus === "enrolled"
          ? billingTreatment === "prorate"
          : undefined,
    });
    setSelectedStudent("");
    setNewEnrollmentStatus("enrolled");
    setEnrollmentStartDate(todayValue());
    setEnrollmentEndDate("");
    setBillingTreatment("");
  }

  return (
    <RoleGate allow="admin">
      {classData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !classData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Class not found</CardTitle>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 p-4 lg:grid-cols-[24rem_1fr] lg:p-8">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold">{classData.classItem.title}</h1>
            <Separator className="my-4" />
          </div>
          <section className="min-w-0 space-y-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Class details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {classData.classItem.status}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Schedule</div>
                  <div className="font-medium">
                    {classData.classItem.scheduleSummary || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Dates</div>
                  <div className="font-medium">
                    {[
                      formatMDYYYY(classData.classItem.startDate),
                      formatMDYYYY(classData.classItem.endDate),
                    ]
                      .filter(Boolean)
                      .join(" - ") || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Time</div>
                  <div className="font-medium">
                    {[
                      classData.classItem.startTime,
                      classData.classItem.endTime,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium">
                    {classData.classItem.location || "Not set"}
                  </div>
                </div>
                <Button asChild className="w-full">
                  <Link to="/admin/classes/$classId/edit" params={{ classId }}>
                    Edit Class
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Add student</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleAddStudent}>
                  <div className="space-y-1">
                    <Label>Student</Label>
                    <Combobox
                      items={studentOptions.map((option) => option.value)}
                      value={selectedStudent || null}
                      onValueChange={(value) => setSelectedStudent(value || "")}
                      itemToStringLabel={(value) =>
                        studentOptions.find((option) => option.value === value)
                          ?.label || ""
                      }
                    >
                      <ComboboxInput
                        className="w-full"
                        placeholder="Select student"
                        showClear
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No students found.</ComboboxEmpty>
                        <ComboboxList>
                          {(value: string) => (
                            <ComboboxItem key={value} value={value}>
                              {studentOptions.find(
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
                      value={newEnrollmentStatus}
                      onValueChange={(value) => {
                        setNewEnrollmentStatus(value as EnrollmentStatus)
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
                  {newEnrollmentStatus === "enrolled" ? (
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="enrollment-start-date">Start date</Label>
                      <Input
                        id="enrollment-start-date"
                        type="date"
                        required
                        value={enrollmentStartDate}
                        onChange={(event) =>
                          setEnrollmentStartDate(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="enrollment-end-date">End date</Label>
                      <Input
                        id="enrollment-end-date"
                        type="date"
                        required={newEnrollmentStatus === "dropped"}
                        min={enrollmentStartDate}
                        value={enrollmentEndDate}
                        onChange={(event) =>
                          setEnrollmentEndDate(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={
                      !selectedStudent ||
                      (newEnrollmentStatus === "enrolled" &&
                        !billingTreatment)
                    }
                  >
                    Add Student
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Add session</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleCreateSession}>
                  <div className="space-y-1">
                    <Label htmlFor="session-date">Date</Label>
                    <Input
                      id="session-date"
                      type="date"
                      required
                      value={sessionDate}
                      onChange={(event) => setSessionDate(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="session-start">Start</Label>
                      <Input
                        id="session-start"
                        type="time"
                        value={sessionStart}
                        onChange={(event) =>
                          setSessionStart(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="session-end">End</Label>
                      <Input
                        id="session-end"
                        type="time"
                        value={sessionEnd}
                        onChange={(event) => setSessionEnd(event.target.value)}
                      />
                    </div>
                  </div>
                  <Select
                    value={sessionStatus}
                    onValueChange={(value) =>
                      setSessionStatus(value as SessionStatus)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <Label>Session staff</Label>
                    <Select
                      value={sessionAssignedStaff}
                      onValueChange={setSessionAssignedStaff}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use class staff</SelectItem>
                        {accounts
                          ?.filter((account) => hasUserRole(account, "staff"))
                          .map((account) => (
                            <SelectItem key={account._id} value={account._id}>
                              {account.name || account.email || "Unnamed"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Substitute</Label>
                    <Select
                      value={sessionSubstitute}
                      onValueChange={setSessionSubstitute}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {accounts
                          ?.filter((account) => hasUserRole(account, "staff"))
                          .map((account) => (
                            <SelectItem key={account._id} value={account._id}>
                              {account.name || account.email || "Unnamed"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" variant="outline" className="w-full">
                    Add Session
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
          <section className="min-w-0 space-y-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Enrollments</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={enrollmentColumns}
                  data={classData.enrollments}
                  filterColumn="student"
                  filterPlaceholder="Filter students..."
                />
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ScrollArea className="h-[800px]">
                  {classData.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No sessions scheduled.
                    </p>
                  ) : (
                    classData.sessions.map((session) => (
                      <div
                        key={session._id}
                        className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-medium">
                            {formatMDYYYY(session.date)}
                          </div>
                          <div className="text-muted-foreground">
                            {formatTimeRange(
                              session.startTime,
                              session.endTime,
                            ) || "Time TBD"}
                          </div>
                          <div className="text-xs capitalize text-muted-foreground">
                            {session.source}
                            {!session.active ? " · inactive" : ""}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSessionActive({
                              session: session._id,
                              active: !session.active,
                            })
                          }
                        >
                          {session.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </section>
        </main>
      )}
      <AlertDialog
        open={!!enrollmentToActivate}
        onOpenChange={(open) => {
          if (!open) setEnrollmentToActivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>How should tuition be charged?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether this enrollment should be prorated when its dates
              cover only part of a billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => {
                if (!enrollmentToActivate) return;
                void updateEnrollment({
                  enrollment: enrollmentToActivate._id,
                  status: "enrolled",
                  prorateTuition: false,
                });
                setEnrollmentToActivate(null);
              }}
            >
              Charge full period
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (!enrollmentToActivate) return;
                void updateEnrollment({
                  enrollment: enrollmentToActivate._id,
                  status: "enrolled",
                  prorateTuition: true,
                });
                setEnrollmentToActivate(null);
              }}
            >
              Prorate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}
