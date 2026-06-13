import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { formatAge, formatFullDate, formatTimeRange } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/students/")({
  component: StudentsPage,
});

function StudentsPage() {
  const students = useConvexQuery(api.classes.listMyStudents, {});
  const visibleStudents = students?.filter((row) => row.student) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">
            Student profiles connected to your account.
          </p>
        </div>
        <Button asChild>
          <Link to="/students/create">
            <Plus />
            Add Student
          </Link>
        </Button>
      </div>

      {students === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : visibleStudents.length === 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>No students yet</CardTitle>
            <CardDescription>
              Add a student profile before requesting class spots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/students/create">Add Student</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleStudents.map((row) => {
            const student = row.student!;
            const displayName =
              student.preferredName ||
              `${student.firstName} ${student.lastName}`;

            return (
              <Card key={student._id} className="rounded-lg h-min">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {row.photoUrl ? (
                        <img
                          src={row.photoUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          {student.firstName.slice(0, 1)}
                          {student.lastName.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle>
                        <Link
                          to="/students/$studentId"
                          params={{ studentId: student._id }}
                          className="hover:underline"
                        >
                          {displayName}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {student.firstName} {student.lastName}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Age</dt>
                      <dd className="font-medium">
                        {formatAge(student.dateOfBirth)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Birthday</dt>
                      <dd className="font-medium">
                        {(student.dateOfBirth &&
                          formatFullDate(student.dateOfBirth)) ||
                          "Not set"}
                      </dd>
                    </div>
                  </dl>

                  <Accordion type="single" collapsible>
                    <AccordionItem value="classes">
                      <AccordionTrigger>View classes</AccordionTrigger>
                      <AccordionContent>
                        {row.classes.length === 0 &&
                        row.perSessionClasses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No classes connected yet.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Class</TableHead>
                                <TableHead>Schedule</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {row.classes.map(({ enrollment, classItem }) =>
                                classItem ? (
                                  <TableRow key={enrollment._id}>
                                    <TableCell className="font-medium">
                                      {classItem.title}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {classItem.scheduleSummary ||
                                        formatTimeRange(
                                          classItem.startTime,
                                          classItem.endTime,
                                        ) ||
                                        "Schedule TBD"}
                                    </TableCell>
                                  </TableRow>
                                ) : null,
                              )}
                              {row.perSessionClasses.map(
                                ({ classItem, selectedCount }) => (
                                  <TableRow key={`per-session-${classItem._id}`}>
                                    <TableCell className="font-medium">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {classItem.title}
                                        <Badge variant="secondary">
                                          Per-session
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {selectedCount}{" "}
                                      {selectedCount === 1 ? "date" : "dates"}{" "}
                                      selected
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
