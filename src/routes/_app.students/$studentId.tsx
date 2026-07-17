import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { BookOpen, Pencil } from "lucide-react";
import { PerSessionClassCard } from "~/components/per-session-class-card";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatAge } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/students/$studentId")({
  component: StudentDetailPage,
});

function StudentDetailPage() {
  const { studentId } = Route.useParams();
  const studentData = useConvexQuery(api.classes.getMyStudent, {
    student: studentId as Id<"students">,
  });

  if (studentData === undefined) {
    return (
      <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
        <Spinner className="size-5" />
      </main>
    );
  }

  if (!studentData) {
    return (
      <main className="mx-auto max-w-3xl p-4 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Student not found</CardTitle>
            <CardDescription>
              This student is not connected to your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { student } = studentData;
  const displayName =
    student.preferredName || `${student.firstName} ${student.lastName}`;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[22rem_1fr] lg:p-8">
      <section className="space-y-4">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{displayName}</CardTitle>
                <CardDescription>
                  {student.firstName} {student.lastName}
                </CardDescription>
              </div>
              <Button asChild size="icon" variant="outline">
                <Link
                  to="/students/$studentId/edit"
                  params={{ studentId: student._id }}
                >
                  <Pencil />
                  <span className="sr-only">Edit student</span>
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border">
              {studentData.photoUrl ? (
                <img
                  src={studentData.photoUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-muted-foreground text-5xl font-semibold">
                  {student.firstName.slice(0, 1)}
                  {student.lastName.slice(0, 1)}
                </span>
              )}
            </div>
            <dl className="grid gap-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{student.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Birthday</dt>
                <dd className="font-medium">
                  {student.dateOfBirth
                    ? format(student.dateOfBirth, "MMMM d, yyyy")
                    : "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Age</dt>
                <dd className="font-medium">
                  {formatAge(student.dateOfBirth)}
                </dd>
              </div>
            </dl>
            {student.notes ? (
              <div>
                <div className="font-medium">Notes</div>
                <p className="text-muted-foreground">{student.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              Classes currently connected to this student.
            </p>
          </div>
          <Button asChild>
            <Link to="/classes" search={{ student: student._id }}>
              <BookOpen />
              Enroll this student in classes
            </Link>
          </Button>
        </div>
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            {studentData.enrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No classes connected yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentData.enrollments.map((enrollment) => (
                    <TableRow key={enrollment._id}>
                      <TableCell className="font-medium">
                        {enrollment.classItem?.title || "Missing class"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.classItem?.scheduleSummary ||
                          [
                            enrollment.classItem?.startTime,
                            enrollment.classItem?.endTime,
                          ]
                            .filter(Boolean)
                            .join(" - ") ||
                          "Schedule TBD"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {enrollment.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {studentData.perSessionClasses.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-bold">Per-session classes</h2>
              <p className="text-muted-foreground">
                Review and update this student&apos;s selected class dates.
              </p>
            </div>
            {studentData.perSessionClasses.map((row) => (
              <PerSessionClassCard
                key={row.classItem._id}
                studentId={student._id}
                row={row}
              />
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
