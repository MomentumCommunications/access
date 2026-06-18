import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Check, CheckCheck, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AttendanceRowActions } from "~/components/attendance-row-actions";
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
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";
import { cn } from "~/lib/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type QuickAttendanceStatus = "present" | "absent";

function AttendanceSession({ sessionId }: { sessionId: Id<"sessions"> }) {
  const sessionData = useConvexQuery(api.classes.staffGetAttendanceSession, {
    session: sessionId as Id<"sessions">,
  });
  const markAttendance = useConvexMutation(api.classes.markAttendance);
  const clearAttendance = useConvexMutation(api.classes.clearAttendance);
  const markSessionPresent = useConvexMutation(api.classes.markSessionPresent);
  const addStudentToSession = useConvexMutation(
    api.classes.addStudentToSession,
  );
  const [localAttendance, setLocalAttendance] = useState<
    Map<string, AttendanceStatus>
  >(new Map());
  const [error, setError] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [selectedAddStudent, setSelectedAddStudent] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    sessionData?.attendance.forEach((record) => {
      map.set(record.student, record.status);
    });
    return map;
  }, [sessionData]);
  const attendanceRecordByStudent = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof sessionData>["attendance"][number]
    >();
    sessionData?.attendance.forEach((record) => {
      map.set(record.student, record);
    });
    return map;
  }, [sessionData]);
  const addStudentOptions = useMemo(
    () =>
      (sessionData?.availableStudents || []).map((row) => ({
        value: row.student._id,
        label:
          row.student.preferredName ||
          `${row.student.firstName} ${row.student.lastName}`,
      })),
    [sessionData],
  );

  useEffect(() => {
    setLocalAttendance(attendanceByStudent);
  }, [attendanceByStudent]);

  async function toggleAttendance(
    student: Id<"students">,
    status: QuickAttendanceStatus,
  ) {
    const current = localAttendance.get(student);
    const next = new Map(localAttendance);
    const previous = new Map(localAttendance);
    setError("");

    if (current === status) {
      next.delete(student);
      setLocalAttendance(next);
      try {
        await clearAttendance({
          session: sessionId as Id<"sessions">,
          student,
        });
      } catch (error) {
        setLocalAttendance(previous);
        setError(
          error instanceof Error
            ? error.message
            : "Attendance could not be cleared.",
        );
      }
      return;
    }

    next.set(student, status);
    setLocalAttendance(next);
    try {
      await markAttendance({
        session: sessionId as Id<"sessions">,
        student,
        status,
      });
    } catch (error) {
      setLocalAttendance(previous);
      setError(
        error instanceof Error
          ? error.message
          : "Attendance could not be saved.",
      );
    }
  }

  async function markAllPresent() {
    if (!sessionData || isMarkingAll) {
      return;
    }

    const previous = new Map(localAttendance);
    const next = new Map(localAttendance);
    sessionData.enrollments.forEach((enrollment) => {
      if (enrollment.student) {
        next.set(enrollment.student._id, "present");
      }
    });

    setError("");
    setIsMarkingAll(true);
    setLocalAttendance(next);

    try {
      await markSessionPresent({
        session: sessionId as Id<"sessions">,
      });
    } catch (error) {
      setLocalAttendance(previous);
      setError(
        error instanceof Error
          ? error.message
          : "Attendance could not be marked.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleAddStudent(value: string | null) {
    if (!value || !sessionData || isAddingStudent) {
      return;
    }

    setSelectedAddStudent(value);
    setError("");
    setIsAddingStudent(true);

    try {
      await addStudentToSession({
        session: sessionId as Id<"sessions">,
        student: value as Id<"students">,
      });
      setSelectedAddStudent("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Student could not be added to this session.",
      );
    } finally {
      setIsAddingStudent(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        void markAllPresent();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markAllPresent]);

  return (
    <RoleGate allow="staff">
      {sessionData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !sessionData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Session not found</CardTitle>
              <CardDescription>
                This session is unavailable or no longer active.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-8">
          <div className="space-y-2">
            <div>
              <Link
                to="/admin/classes/$classId"
                params={{
                  classId: sessionData.classItem?._id as Id<"classes">,
                }}
              >
                <h1 className="text-3xl font-bold">
                  {sessionData.classItem?.title || "Untitled class"}
                </h1>
              </Link>
              <p className="text-muted-foreground">
                {formatMDYYYY(sessionData.session.date)} ·{" "}
                {formatTimeRange(
                  sessionData.session.startTime,
                  sessionData.session.endTime,
                ) || "Time TBD"}
                {sessionData.session.location
                  ? ` · ${sessionData.session.location}`
                  : ""}
              </p>
            </div>
          </div>

          <Card className="rounded-lg px-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Roster</CardTitle>
              <Button
                variant="outline"
                className="mr-2 h-10 w-12 cursor-pointer sm:w-16"
                onClick={markAllPresent}
                disabled={isMarkingAll || sessionData.enrollments.length === 0}
                title="Mark all present (A)"
              >
                <CheckCheck className="size-5" />
                <span className="sr-only">Mark all present</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 px-3">
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
              {sessionData.enrollments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No enrolled students for this session.
                </p>
              ) : null}
              {sessionData.enrollments.map((enrollment) => {
                if (!enrollment.student) return null;
                const student = enrollment.student;
                const current = localAttendance.get(student._id);
                const attendanceRecord = attendanceRecordByStudent.get(
                  student._id,
                );
                const studentName =
                  student.preferredName ||
                  `${student.firstName} ${student.lastName}`;

                return (
                  <div
                    key={student._id}
                    className="flex flex-row items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {enrollment.photoUrl ? (
                        <img
                          src={enrollment.photoUrl}
                          alt={studentName}
                          className="size-10 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {studentName}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <div
                        className="grid w-24 shrink-0 grid-cols-2 gap-2 sm:w-32"
                        aria-label={`Mark attendance for ${studentName}`}
                      >
                        <AttendanceToggleButton
                          label="Present"
                          selected={current === "present"}
                          tone="present"
                          onClick={() =>
                            toggleAttendance(student._id, "present")
                          }
                        />
                        <AttendanceToggleButton
                          label="Absent"
                          selected={current === "absent"}
                          tone="absent"
                          onClick={() =>
                            toggleAttendance(student._id, "absent")
                          }
                        />
                      </div>
                      <AttendanceRowActions
                        session={sessionId as Id<"sessions">}
                        student={student._id}
                        studentName={studentName}
                        status={current}
                        reason={attendanceRecord?.reason}
                        canRemove={enrollment.status === "session"}
                        onError={setError}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-row items-center gap-3 rounded-md border border-dashed p-3">
                <div className="size-10 bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full">
                  <UserPlus className="size-5" />
                </div>
                <Combobox
                  items={addStudentOptions.map((option) => option.value)}
                  value={selectedAddStudent || null}
                  onValueChange={(value) => void handleAddStudent(value)}
                  itemToStringLabel={(value) =>
                    addStudentOptions.find((option) => option.value === value)
                      ?.label || ""
                  }
                  disabled={isAddingStudent}
                >
                  <ComboboxInput
                    className="w-full"
                    placeholder="Add Student"
                    showClear
                    disabled={isAddingStudent}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No students found.</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string) => (
                        <ComboboxItem key={value} value={value}>
                          {addStudentOptions.find(
                            (option) => option.value === value,
                          )?.label || value}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </CardContent>
          </Card>
        </main>
      )}
    </RoleGate>
  );
}

function AttendanceToggleButton({
  label,
  selected,
  tone,
  onClick,
}: {
  label: string;
  selected: boolean;
  tone: QuickAttendanceStatus;
  onClick: () => void;
}) {
  const Icon = tone === "present" ? Check : X;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "bg-background text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-[3px] sm:h-12",
        tone === "present" &&
          "hover:border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:border-green-800 dark:hover:bg-green-950/40 dark:hover:text-green-300",
        tone === "absent" &&
          "hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300",
        selected &&
          tone === "present" &&
          "shadow-xs border-green-500 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950/60 dark:text-green-300",
        selected &&
          tone === "absent" &&
          "shadow-xs border-red-500 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950/60 dark:text-red-300",
      )}
    >
      <Icon className="size-7 sm:size-6" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default AttendanceSession;
