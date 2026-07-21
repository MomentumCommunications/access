import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
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
import { formatMDYYYY, formatTimeRange } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/trial/")({
  validateSearch: z.object({ student: z.string().optional() }),
  component: TrialClassSelectionPage,
});

function studentName(student: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}) {
  return student.preferredName || `${student.firstName} ${student.lastName}`;
}

function TrialClassSelectionPage() {
  const navigate = useNavigate();
  const { student: requestedStudentId } = Route.useSearch();
  const students = useConvexQuery(api.trials.listMyStudents, {});
  const selectedStudent =
    students?.find((student) => student.id === requestedStudentId) ||
    students?.[0];
  const classes = useConvexQuery(
    api.trials.listAvailableClasses,
    selectedStudent
      ? { studentId: selectedStudent.id as Id<"students"> }
      : "skip",
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Request a paid trial</h1>
        <p className="text-muted-foreground">
          Choose a student and class, then select one upcoming class date.
        </p>
      </div>

      {students === undefined ? (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : students.length === 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Add a student first</CardTitle>
            <CardDescription>
              A student profile is required before requesting a trial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/students/create" search={{ returnTo: "/trial" }}>
                <Plus />
                Add student
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="max-w-sm space-y-1.5">
            <label className="text-sm font-medium">Student</label>
            <Select
              value={selectedStudent?.id}
              onValueChange={(student) =>
                void navigate({ to: "/trial", search: { student } })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {studentName(student)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {classes === undefined ? (
            <div className="flex min-h-48 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : classes.length === 0 ? (
            <Card className="rounded-lg border-dashed">
              <CardHeader>
                <CardTitle>No trial dates available</CardTitle>
                <CardDescription>
                  There are no eligible upcoming classes for this student right
                  now. Contact the studio if you need help finding a class.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {classes.map((row) => (
                <Card key={row.classItem.id} className="rounded-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{row.classItem.title}</CardTitle>
                        <CardDescription>
                          {row.classItem.scheduleSummary ||
                            formatTimeRange(
                              row.classItem.startTime,
                              row.classItem.endTime,
                            ) ||
                            "Schedule varies"}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">Paid trial</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {row.classItem.description ? (
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {row.classItem.description}
                      </p>
                    ) : null}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4" />
                        Next date {formatMDYYYY(row.nextSessionDate)} ·{" "}
                        {row.sessionCount} available
                      </div>
                      {row.classItem.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4" />
                          {row.classItem.location}
                        </div>
                      ) : null}
                    </div>
                    <Button className="w-full" asChild>
                      <Link
                        to="/trial/$classId"
                        params={{ classId: row.classItem.id }}
                        search={{ student: selectedStudent?.id }}
                      >
                        Choose a date
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
