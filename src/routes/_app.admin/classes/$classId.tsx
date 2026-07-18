import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { resolvedClassEnrollmentOpen } from "../../../../shared/class-enrollment-selection";
import { resolvedClassEnrollmentMode } from "../../../../shared/per-session-signup";
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
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";
import { hasUserRole } from "~/lib/roles";
import {
  ArrowUpDown,
  CalendarDays,
  GraduationCap,
  Pencil,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_app/admin/classes/$classId")({
  component: AdminClassDetailPage,
});

type SessionStatus = "scheduled" | "cancelled" | "completed";
type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "declined";
type EnrollmentStatusFilter = EnrollmentStatus | "all";
type BillingTreatment = "" | "prorate" | "full";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

type AdminClassData = NonNullable<
  FunctionReturnType<typeof api.classes.adminGetClass>
>;
type EnrollmentRow = AdminClassData["enrollments"][number];
type SessionSignupRow = AdminClassData["sessionSignups"][number];

const classTabTriggerClass =
  "data-[state=active]:border-primary relative h-10 flex-none rounded-none border-x-0 border-b-2 border-t-0 border-transparent bg-transparent px-0 pb-3 pt-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

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
  const setStudentSessionSignups = useConvexMutation(
    api.classes.adminSetStudentSessionSignups,
  );
  const setClassEnrollmentOpen = useConvexMutation(
    api.classes.adminSetClassEnrollmentOpen,
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
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [sessionSignupStatus, setSessionSignupStatus] = useState<
    "pending" | "enrolled" | "waitlisted"
  >("enrolled");
  const [enrollmentOpenSaving, setEnrollmentOpenSaving] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] =
    useState<EnrollmentStatusFilter>("enrolled");
  const classMode = resolvedClassEnrollmentMode(
    classData?.classItem.enrollmentMode,
  );
  const enrollmentOpen = resolvedClassEnrollmentOpen(
    classData?.classItem.enrollmentOpen,
  );
  const availableSignupSessions = useMemo(
    () =>
      (classData?.sessions || []).filter(
        (session) =>
          session.active &&
          session.status !== "cancelled" &&
          session.date >= todayValue(),
      ),
    [classData?.sessions],
  );
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
  const existingSelectedSignups = useMemo(
    () =>
      (classData?.sessionSignups || []).filter(
        (signup) =>
          signup.student?._id === selectedStudent &&
          signup.status !== "cancelled",
      ),
    [classData?.sessionSignups, selectedStudent],
  );
  const filteredEnrollments = useMemo(() => {
    if (!classData) return [];
    if (enrollmentStatusFilter === "all") {
      return classData.enrollments;
    }
    return classData.enrollments.filter(
      (enrollment) => enrollment.status === enrollmentStatusFilter,
    );
  }, [classData, enrollmentStatusFilter]);

  useEffect(() => {
    setSelectedSessionIds(
      existingSelectedSignups.flatMap((signup) => {
        const session = signup.session;
        if (
          !session ||
          !session.active ||
          session.status === "cancelled" ||
          session.date < todayValue()
        ) {
          return [];
        }
        return [session._id];
      }),
    );
    const statuses = new Set(
      existingSelectedSignups
        .map((signup) => signup.status)
        .filter(
          (status): status is "pending" | "enrolled" | "waitlisted" =>
            status !== "cancelled",
        ),
    );
    if (statuses.size === 1) {
      setSessionSignupStatus([...statuses][0]);
    }
  }, [existingSelectedSignups]);

  const enrollmentColumns: ColumnDef<EnrollmentRow>[] = [
    {
      accessorFn: (row) =>
        row.student ? `${row.student.firstName} ${row.student.lastName}` : "",
      id: "student",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Student
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
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
              endDate: nextStatus === "dropped" ? todayValue() : undefined,
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
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      ),
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
  const sessionSignupColumns: ColumnDef<SessionSignupRow>[] = [
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
      accessorFn: (row) => row.session?.date || "",
      id: "date",
      header: "Session",
      cell: ({ row }) =>
        row.original.session
          ? formatMDYYYY(row.original.session.date)
          : "Missing session",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.status.replace("_", " ")}
        </span>
      ),
    },
    {
      accessorKey: "unitPriceCents",
      header: "Price",
      cell: ({ row }) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(row.original.unitPriceCents / 100),
    },
  ];

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!classData) return;
    setIsAddingSession(true);
    try {
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
      setAddSessionOpen(false);
      toast.success("Session added.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add session.",
      );
    } finally {
      setIsAddingSession(false);
    }
  }

  async function handleAddStudent(event: FormEvent) {
    event.preventDefault();
    setIsAddingStudent(true);
    try {
      if (classMode === "per_session") {
        await setStudentSessionSignups({
          classId: classId as Id<"classes">,
          student: selectedStudent as Id<"students">,
          sessions: selectedSessionIds as Id<"sessions">[],
          status: sessionSignupStatus,
        });
        setSelectedStudent("");
        setSelectedSessionIds([]);
        setSessionSignupStatus("enrolled");
        setAddStudentOpen(false);
        toast.success("Student session selections updated.");
        return;
      }
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
      setAddStudentOpen(false);
      toast.success("Student added to class.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add student.",
      );
    } finally {
      setIsAddingStudent(false);
    }
  }

  async function handleEnrollmentOpenChange(nextOpen: boolean) {
    setEnrollmentOpenSaving(true);
    try {
      await setClassEnrollmentOpen({
        classId: classId as Id<"classes">,
        enrollmentOpen: nextOpen,
      });
      toast.success(
        nextOpen
          ? "Self-service enrollment opened."
          : "Self-service enrollment closed.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Enrollment availability could not be updated.",
      );
    } finally {
      setEnrollmentOpenSaving(false);
    }
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
        <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 p-4 lg:p-8">
          <section className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-3xl font-bold">
                    {classData.classItem.title}
                  </h1>
                  <Badge variant="secondary" className="capitalize">
                    {classData.classItem.status}
                  </Badge>
                </div>
                {classData.classItem.description ? (
                  <p className="text-muted-foreground max-w-3xl">
                    {classData.classItem.description}
                  </p>
                ) : null}
              </div>
              <Button asChild className="shrink-0">
                <Link to="/admin/classes/$classId/edit" params={{ classId }}>
                  <Pencil />
                  Edit class
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <div className="text-muted-foreground">Schedule</div>
                <div className="font-medium">
                  {classData.classItem.scheduleSummary || "Not set"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Dates</div>
                <div className="font-medium">
                  {[
                    formatMDYYYY(classData.classItem.startDate),
                    formatMDYYYY(classData.classItem.endDate),
                  ]
                    .filter(Boolean)
                    .join(" – ") || "Not set"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Time</div>
                <div className="font-medium">
                  {formatTimeRange(
                    classData.classItem.startTime,
                    classData.classItem.endTime,
                  ) || "Not set"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Location</div>
                <div className="font-medium">
                  {classData.classItem.location || "Not set"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Enrollment</div>
                <div className="font-medium">
                  {
                    classData.enrollments.filter(
                      (enrollment) => enrollment.status === "enrolled",
                    ).length
                  }
                  {classData.classItem.capacity
                    ? ` / ${classData.classItem.capacity}`
                    : ""}{" "}
                  enrolled
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Signup mode</div>
                <div className="font-medium">
                  {classMode === "per_session"
                    ? `Per session · ${new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(
                        (classData.classItem.perSessionPriceCents || 0) / 100,
                      )}`
                    : "Standard tuition"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="font-medium">Self-service enrollment</div>
                <div className="text-muted-foreground text-sm">
                  {enrollmentOpen
                    ? "Open to customer enrollment requests"
                    : "Closed to customer enrollment requests"}
                </div>
              </div>
              <Switch
                checked={enrollmentOpen}
                disabled={enrollmentOpenSaving}
                onCheckedChange={handleEnrollmentOpenChange}
                aria-label="Self-service enrollment"
              />
            </div>
          </section>

          <Tabs defaultValue="enrollments" className="min-w-0 gap-2">
            <Separator />
            <TabsList className="text-muted-foreground h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="enrollments" className={classTabTriggerClass}>
                <GraduationCap />
                {classMode === "per_session"
                  ? "Session signups"
                  : "Enrollments"}
              </TabsTrigger>
              <TabsTrigger value="sessions" className={classTabTriggerClass}>
                <CalendarDays />
                Sessions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="enrollments" className="min-w-0 space-y-4 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    {classMode === "per_session"
                      ? "Session signups"
                      : "Enrollments"}
                  </h2>
                  <p className="text-muted-foreground">
                    {classMode === "per_session"
                      ? "Students registered for individual class dates."
                      : "Students connected to this class and their current status."}
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => setAddStudentOpen(true)}
                >
                  <Plus />
                  Add student
                </Button>
              </div>
              {classMode === "per_session" ? (
                <DataTable
                  columns={sessionSignupColumns}
                  data={classData.sessionSignups}
                  filterColumn="student"
                  filterPlaceholder="Filter students..."
                />
              ) : (
                <DataTable
                  columns={enrollmentColumns}
                  data={filteredEnrollments}
                  filterColumn="student"
                  filterPlaceholder="Filter students..."
                  toolbar={
                    <Select
                      value={enrollmentStatusFilter}
                      onValueChange={(value) =>
                        setEnrollmentStatusFilter(
                          value as EnrollmentStatusFilter,
                        )
                      }
                    >
                      <SelectTrigger className="w-full shrink-0 sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enrolled">Enrolled</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                        <SelectItem value="dropped">Dropped</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="sessions" className="min-w-0 space-y-4 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Sessions</h2>
                  <p className="text-muted-foreground">
                    Generated and manually added class dates.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => setAddSessionOpen(true)}
                >
                  <Plus />
                  Add session
                </Button>
              </div>
              {classData.sessions.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border p-8 text-center">
                  No sessions scheduled.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {classData.sessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Button asChild variant="link" className="h-auto p-0">
                          <Link
                            to="/admin/classes/$classId/$sessionId"
                            params={{ classId, sessionId: session._id }}
                          >
                            {formatMDYYYY(session.date)}
                          </Link>
                        </Button>
                        <div className="text-muted-foreground text-sm">
                          {formatTimeRange(
                            session.startTime,
                            session.endTime,
                          ) || "Time TBD"}
                          {session.location ? ` · ${session.location}` : ""}
                        </div>
                        <div className="text-muted-foreground text-xs capitalize">
                          {session.source}
                          {!session.active ? " · inactive" : ""}
                          {session.status !== "scheduled"
                            ? ` · ${session.status}`
                            : ""}
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
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      )}

      <Dialog
        open={addStudentOpen}
        onOpenChange={(open) => {
          if (!isAddingStudent) setAddStudentOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
          <form className="space-y-4" onSubmit={handleAddStudent}>
            <DialogHeader>
              <DialogTitle>Add student</DialogTitle>
              <DialogDescription>
                {classMode === "per_session"
                  ? "Choose a student and the individual sessions they should attend."
                  : "Create an enrollment for this class."}
              </DialogDescription>
            </DialogHeader>
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
                        {studentOptions.find((option) => option.value === value)
                          ?.label || value}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {classMode === "per_session" ? (
              <>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={sessionSignupStatus}
                    onValueChange={(value) =>
                      setSessionSignupStatus(
                        value as typeof sessionSignupStatus,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="enrolled">Enrolled</SelectItem>
                      <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="admin-select-all-sessions"
                      checked={
                        availableSignupSessions.length > 0 &&
                        selectedSessionIds.length ===
                          availableSignupSessions.length
                      }
                      onCheckedChange={(checked) =>
                        setSelectedSessionIds(
                          checked
                            ? availableSignupSessions.map(
                                (session) => session._id,
                              )
                            : [],
                        )
                      }
                    />
                    <Label htmlFor="admin-select-all-sessions">
                      Select all available sessions
                    </Label>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {availableSignupSessions.length === 0 ? (
                      <p className="text-muted-foreground p-3 text-center text-sm">
                        No upcoming sessions are available.
                      </p>
                    ) : (
                      availableSignupSessions.map((session) => (
                        <label
                          key={session._id}
                          className="hover:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-2"
                        >
                          <span className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedSessionIds.includes(session._id)}
                              onCheckedChange={(checked) =>
                                setSelectedSessionIds((current) =>
                                  checked
                                    ? [...new Set([...current, session._id])]
                                    : current.filter(
                                        (sessionId) =>
                                          sessionId !== session._id,
                                      ),
                                )
                              }
                            />
                            {formatMDYYYY(session.date)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatTimeRange(
                              session.startTime,
                              session.endTime,
                            ) || "Time TBD"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={newEnrollmentStatus}
                    onValueChange={(value) => {
                      setNewEnrollmentStatus(value as EnrollmentStatus);
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
                <div className="grid gap-3 sm:grid-cols-2">
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
              </>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isAddingStudent}
                onClick={() => setAddStudentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isAddingStudent ||
                  !selectedStudent ||
                  (classMode === "per_session"
                    ? selectedSessionIds.length === 0
                    : newEnrollmentStatus === "enrolled" && !billingTreatment)
                }
              >
                {isAddingStudent ? <Spinner /> : <Plus />}
                Add student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addSessionOpen}
        onOpenChange={(open) => {
          if (!isAddingSession) setAddSessionOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <form className="space-y-4" onSubmit={handleCreateSession}>
            <DialogHeader>
              <DialogTitle>Add session</DialogTitle>
              <DialogDescription>
                Add a manual session without changing the class recurrence.
              </DialogDescription>
            </DialogHeader>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="session-start">Start</Label>
                <Input
                  id="session-start"
                  type="time"
                  value={sessionStart}
                  onChange={(event) => setSessionStart(event.target.value)}
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
            <div className="space-y-1">
              <Label>Status</Label>
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
            </div>
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
                        {getAccountName(account)}
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
                        {getAccountName(account)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isAddingSession}
                onClick={() => setAddSessionOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingSession || !sessionDate}>
                {isAddingSession ? <Spinner /> : <Plus />}
                Add session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                  endDate: null,
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
                  endDate: null,
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
