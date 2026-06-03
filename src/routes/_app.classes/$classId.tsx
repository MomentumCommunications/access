import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";

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
  const [selectedStudent, setSelectedStudent] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup() {
    if (!selectedStudent) {
      setMessage("Select a student first.");
      return;
    }
    await signUp({
      classId: classId as Id<"classes">,
      student: selectedStudent as Id<"students">,
    });
    setMessage("Signup request submitted.");
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
                  {classData.activeEnrollmentCount}
                  {classItem.capacity ? ` / ${classItem.capacity}` : ""} active
                  requests
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Upcoming dated class sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {classData.sessions.length === 0 ? (
              <p className="text-muted-foreground">No sessions scheduled.</p>
            ) : (
              classData.sessions.map((session) => (
                <div
                  key={session._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span>{session.date}</span>
                  <span className="text-muted-foreground">
                    {[session.startTime, session.endTime]
                      .filter(Boolean)
                      .join(" - ") || "Time TBD"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
      <aside className="space-y-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Request a spot</CardTitle>
            <CardDescription>
              Select a student profile, then submit the signup request.
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
                <Button className="w-full" onClick={handleSignup}>
                  Submit Signup
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
