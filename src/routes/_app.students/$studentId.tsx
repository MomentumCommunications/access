import { useConvexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, BookOpen, Pencil, Users } from "lucide-react";
import { PdfEmbed } from "~/components/pdf-embed";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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

type StudentData = NonNullable<
  FunctionReturnType<typeof api.classes.getMyStudent>
>;

const studentTabTriggerClass =
  "data-[state=active]:border-primary relative h-10 flex-none rounded-none border-x-0 border-b-2 border-t-0 border-transparent bg-transparent px-0 pb-3 pt-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

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
  const studentName = `${student.firstName} ${student.lastName}`;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 lg:p-8">
      <section className="pt-6 pb-0">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/students">
            <ArrowLeft />
            Students
          </Link>
        </Button>
        <div className="space-y-4 lg:p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage
                  src={studentData.photoUrl || undefined}
                  alt={studentName}
                  className="object-cover"
                />
                <AvatarFallback>
                  {student.firstName.slice(0, 1)}
                  {student.lastName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="wrap-break-words text-3xl font-bold">
                  {studentName}
                </h1>
                {student.preferredName ? (
                  <p className="text-muted-foreground wrap-break-words">
                    Preferred name: {student.preferredName}
                  </p>
                ) : null}
              </div>
            </div>
            <Button asChild className="shrink-0 self-start sm:self-auto">
              <Link
                to="/students/$studentId/edit"
                params={{ studentId: student._id }}
              >
                <Pencil />
                Edit
              </Link>
            </Button>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{student.status}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Age</dt>
              <dd className="font-medium">{formatAge(student.dateOfBirth)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Birthday</dt>
              <dd className="font-medium">
                {student.dateOfBirth
                  ? format(student.dateOfBirth, "MMMM d, yyyy")
                  : "Not set"}
              </dd>
            </div>
          </dl>
          {student.notes ? (
            <div className="space-y-1">
              <div className="text-muted-foreground">Notes</div>
              <p className="whitespace-pre-wrap wrap-break-words text-sm leading-6">
                {student.notes}
              </p>
            </div>
          ) : null}
        </div>
        <Separator />
      </section>
      <StudentDetailTabs key={student._id} studentData={studentData} />
    </main>
  );
}

function StudentDetailTabs({ studentData }: { studentData: StudentData }) {
  const [selectedTab, setSelectedTab] = useState("classes");
  const { hasBuddyAssignments } = studentData;

  useEffect(() => {
    if (!hasBuddyAssignments) setSelectedTab("classes");
  }, [hasBuddyAssignments]);

  return (
    <Tabs
      value={hasBuddyAssignments ? selectedTab : "classes"}
      onValueChange={setSelectedTab}
      className="gap-4"
    >
      <TabsList
        aria-label="Student details"
        className="text-muted-foreground h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent p-0"
      >
        <TabsTrigger value="classes" className={studentTabTriggerClass}>
          <BookOpen />
          Classes
        </TabsTrigger>
        {hasBuddyAssignments ? (
          <TabsTrigger value="buddies" className={studentTabTriggerClass}>
            <Users />
            Buddies
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="classes">
        <StudentClassesTab studentData={studentData} />
      </TabsContent>
      {hasBuddyAssignments ? (
        <TabsContent value="buddies">
          <StudentBuddiesTab studentData={studentData} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function StudentClassesTab({ studentData }: { studentData: StudentData }) {
  const { student } = studentData;
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Classes</h2>
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
            <h3 className="text-xl font-bold">Per-session classes</h3>
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
  );
}

function StudentBuddiesTab({ studentData }: { studentData: StudentData }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Buddies</h2>
        <p className="text-muted-foreground">
          Current and past buddy assignments.
        </p>
      </div>
      {studentData.buddies.map((assignment) => {
        const { buddy } = assignment;
        const name = buddy
          ? `${buddy.firstName} ${buddy.lastName}`
          : "Buddy unavailable";
        return (
          <Card key={assignment._id} className="w-full min-w-0 rounded-lg">
            <CardHeader>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarImage
                      src={buddy?.photoUrl || undefined}
                      alt={name}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {buddy ? (
                        `${buddy.firstName.slice(0, 1)}${buddy.lastName.slice(0, 1)}`
                      ) : (
                        <Users className="size-5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="break-words">{name}</CardTitle>
                    {buddy?.preferredName ? (
                      <CardDescription className="break-words">
                        Preferred name: {buddy.preferredName}
                      </CardDescription>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assignment.year ? (
                    <span className="text-muted-foreground text-sm">
                      {assignment.year}
                    </span>
                  ) : null}
                  <Badge variant={assignment.current ? "secondary" : "outline"}>
                    {assignment.current ? "Current" : "Past"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.notes ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {assignment.notes}
                </p>
              ) : null}
              {!buddy ? (
                <p className="text-muted-foreground text-sm">
                  This buddy’s profile is no longer available.
                </p>
              ) : buddy.buddySheet ? (
                <PdfEmbed
                  studentId={studentData.student._id}
                  storageId={buddy.buddySheet}
                  title={`${name} — buddy sheet`}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No buddy sheet available.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
