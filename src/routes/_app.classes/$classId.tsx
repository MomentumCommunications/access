import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { resolvedClassEnrollmentOpen } from "../../../shared/class-enrollment-selection";
import { resolvedClassEnrollmentMode } from "../../../shared/per-session-signup";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/classes/$classId")({
  component: ClassDetailPage,
});

function ClassDetailPage() {
  const { classId } = Route.useParams();
  const classData = useConvexQuery(api.classes.getClassForSignup, {
    classId: classId as Id<"classes">,
  });
  const students = useConvexQuery(api.classes.listMyStudents, {});
  const signUp = useConvexMutation(api.classes.signUpStudentForClass);
  const signUpForSessions = useConvexMutation(
    api.classes.signUpStudentForSessions,
  );
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const classMode = resolvedClassEnrollmentMode(
    classData?.classItem.enrollmentMode,
  );
  const studentSignups = useMemo(
    () =>
      (classData?.sessionSignups || []).filter(
        (signup) =>
          signup.student === selectedStudent && signup.status !== "cancelled",
      ),
    [classData?.sessionSignups, selectedStudent],
  );
  const lockedSessionIds = useMemo(
    () =>
      new Set(
        studentSignups
          .filter((signup) => signup.status === "enrolled")
          .map((signup) => signup.session),
      ),
    [studentSignups],
  );

  useEffect(() => {
    const availableSessionIds = new Set(
      (classData?.sessions || []).map((session) => session._id),
    );
    setSelectedSessions(
      studentSignups
        .map((signup) => signup.session)
        .filter((sessionId) => availableSessionIds.has(sessionId)),
    );
  }, [classData?.sessions, studentSignups]);

  async function handleSignup() {
    if (!selectedStudent) {
      setMessage("Select a student first.");
      return;
    }
    try {
      if (classMode === "per_session") {
        if (selectedSessions.length === 0) {
          setMessage("Select at least one session.");
          return;
        }
        await signUpForSessions({
          classId: classId as Id<"classes">,
          student: selectedStudent as Id<"students">,
          sessions: selectedSessions as Id<"sessions">[],
        });
        setMessage("Session signup request submitted.");
      } else {
        await signUp({
          classId: classId as Id<"classes">,
          student: selectedStudent as Id<"students">,
        });
        setMessage("Signup request submitted.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The signup request could not be submitted.",
      );
    }
  }

  if (classData === undefined || students === undefined) {
    return (
      <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
        <Spinner className="size-5" />
      </main>
    );
  }

  if (!classData) {
    return (
      <main className="mx-auto max-w-3xl p-4 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Class unavailable</CardTitle>
            <CardDescription>
              This class is not available for signup.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const classItem = classData.classItem;
  const enrollmentOpen = resolvedClassEnrollmentOpen(classItem.enrollmentOpen);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 p-4 lg:grid-cols-[1fr_22rem] lg:p-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{classItem.title}</h1>
          <p className="text-muted-foreground">{classItem.scheduleSummary}</p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {classItem.description ? <p>{classItem.description}</p> : null}
            <dl className="grid gap-2 text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Location</dt>
                <dd>{classItem.location || "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Capacity</dt>
                <dd>
                  {classMode === "per_session"
                    ? classItem.capacity === undefined
                      ? "No limit per session"
                      : `${classItem.capacity} per session`
                    : `${classData.activeEnrollmentCount}${
                        classItem.capacity ? ` / ${classItem.capacity}` : ""
                      } active requests`}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Signup</dt>
                <dd>
                  {!enrollmentOpen
                    ? "Closed to self-service enrollment"
                    : classMode === "per_session"
                      ? `${new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(
                          (classItem.perSessionPriceCents || 0) / 100,
                        )} per selected session`
                      : "All sessions"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Upcoming dated class sessions.</CardDescription>
            </div>
            {classMode === "per_session" && selectedStudent ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-sessions"
                  disabled={!enrollmentOpen}
                  checked={
                    classData.sessions.length > 0 &&
                    selectedSessions.length === classData.sessions.length
                  }
                  onCheckedChange={(checked) =>
                    setSelectedSessions(
                      checked
                        ? classData.sessions.map((session) => session._id)
                        : [...lockedSessionIds],
                    )
                  }
                />
                <Label htmlFor="select-all-sessions">Select all</Label>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {classData.sessions.length === 0 ? (
              <p className="text-muted-foreground">No sessions scheduled.</p>
            ) : (
              classData.sessions.map((session) => {
                const selected = selectedSessions.includes(session._id);
                const locked = lockedSessionIds.has(session._id);
                return (
                  <label
                    key={session._id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span className="flex items-center gap-3">
                      {classMode === "per_session" && selectedStudent ? (
                        <Checkbox
                          checked={selected}
                          disabled={locked || !enrollmentOpen}
                          onCheckedChange={(checked) =>
                            setSelectedSessions((current) =>
                              checked
                                ? [...new Set([...current, session._id])]
                                : current.filter(
                                    (sessionId) =>
                                      sessionId !== session._id,
                                  ),
                            )
                          }
                        />
                      ) : null}
                      <span>
                        {formatMDYYYY(session.date)}
                        {locked ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Confirmed
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatTimeRange(session.startTime, session.endTime) ||
                        "Time TBD"}
                    </span>
                  </label>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
      <aside className="space-y-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>
              {classMode === "per_session"
                ? "Choose sessions"
                : "Request a spot"}
            </CardTitle>
            <CardDescription>
              {!enrollmentOpen
                ? "Enrollment is closed for this class."
                : classMode === "per_session"
                  ? "Select a student and one or more dates. Each selected session uses the listed per-session price."
                  : "Select a student profile, then submit the signup request."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {students.filter((row) => row.student).length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add a student profile before requesting a class spot.
                </p>
                <Button asChild className="w-full">
                  <Link to="/students/create">Add Student</Link>
                </Button>
              </div>
            ) : (
              <>
                <Select
                  value={selectedStudent}
                  onValueChange={setSelectedStudent}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students
                      .filter((row) => row.student)
                      .map((row) => (
                        <SelectItem
                          key={row.student!._id}
                          value={row.student!._id}
                        >
                          {row.student!.preferredName ||
                            `${row.student!.firstName} ${row.student!.lastName}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!enrollmentOpen}
                  onClick={handleSignup}
                >
                  {!enrollmentOpen
                    ? "Enrollment closed"
                    : classMode === "per_session"
                      ? `Request ${selectedSessions.length} session${
                          selectedSessions.length === 1 ? "" : "s"
                        }`
                      : "Submit Signup"}
                </Button>
              </>
            )}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </main>
  );
}
