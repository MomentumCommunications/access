import { useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Lightbulb, Mail, Phone, User } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Spinner } from "~/components/ui/spinner";
import { formatMDYYYY } from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";
import { formatPhone } from "~/lib/utils";

export const Route = createFileRoute("/_app/staff/classes_/$classId")({
  component: StaffClassDetailPage,
});

type StaffClassData = NonNullable<
  FunctionReturnType<typeof api.classes.staffGetClass>
>;
type EnrollmentRow = StaffClassData["enrollments"][number];
type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "declined";
type EnrollmentStatusFilter = EnrollmentStatus | "all";

function studentDisplayName(student: EnrollmentRow["student"]) {
  if (!student) return "Missing student";
  return (
    student.preferredName ||
    [student.firstName, student.lastName].filter(Boolean).join(" ")
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ContactSheet({ row }: { row: EnrollmentRow }) {
  const name = studentDisplayName(row.student);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="h-auto justify-start gap-3 px-1">
          <Avatar className="size-10">
            <AvatarImage src={row.photoUrl || undefined} alt={name} />
            <AvatarFallback>
              {initials(name) || <User className="size-4" />}
            </AvatarFallback>
          </Avatar>
          <span className="text-left font-medium">{name}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90%] sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            Student contacts for this class enrollment.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          {row.contacts.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              No contacts are connected to this student.
            </div>
          ) : (
            row.contacts.map(({ contact, user }) => {
              const contactName = user
                ? getAccountName(user)
                : contact.name || contact.inviteEmail || "Unnamed contact";
              return (
                <div key={contact._id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={user?.image} alt={contactName} />
                      <AvatarFallback>
                        {initials(contactName) || <User className="size-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {contactName}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {contact.relationship || "Relationship not set"}
                          </div>
                        </div>
                        {contact.isPrimary ? (
                          <Badge variant="secondary">Primary</Badge>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="size-4 shrink-0" />
                          <span>
                            {user?.phone ? (
                              <a href={`tel:${user.phone}`}>
                                {formatPhone(user.phone)}
                              </a>
                            ) : (
                              "Phone not set"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="size-4 shrink-0" />
                          <span className="truncate">
                            {user ? (
                              <a href={`mailto:${user.email}`}>{user.email}</a>
                            ) : (
                              contact.inviteEmail || "Email not set"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <SheetFooter>
          <Lightbulb className="size-8 text-yellow-500" />
          <small>
            Tip: On mobile, long-press a phone number to see call, text and copy
            options.
          </small>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function StaffClassDetailPage() {
  const { classId } = Route.useParams();
  const classData = useConvexQuery(api.classes.staffGetClass, {
    classId: classId as Id<"classes">,
  });
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] =
    useState<EnrollmentStatusFilter>("enrolled");

  const filteredEnrollments = useMemo(() => {
    if (!classData) return [];
    if (enrollmentStatusFilter === "all") return classData.enrollments;
    return classData.enrollments.filter(
      (enrollment) => enrollment.status === enrollmentStatusFilter,
    );
  }, [classData, enrollmentStatusFilter]);

  const enrolledCount =
    classData?.enrollments.filter(
      (enrollment) => enrollment.status === "enrolled",
    ).length || 0;

  const columns: ColumnDef<EnrollmentRow>[] = [
    {
      accessorFn: (row) => studentDisplayName(row.student),
      id: "student",
      header: "Student",
      cell: ({ row }) => <ContactSheet row={row.original} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "dates",
      header: "Enrollment dates",
      cell: ({ row }) => {
        const start = formatMDYYYY(row.original.startDate) || "Now";
        const end = formatMDYYYY(row.original.endDate) || "Open";
        return `${start} - ${end}`;
      },
    },
  ];

  return (
    <RoleGate allow="staff">
      {classData === undefined ? (
        <main className="flex min-h-[calc(100svh-54px)] items-center justify-center">
          <Spinner className="size-5" />
        </main>
      ) : !classData ? (
        <main className="mx-auto max-w-3xl p-4 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Class not found</CardTitle>
              <CardDescription>
                This class may have been removed or is not assigned to you.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl gap-4 p-4 lg:p-8">
          <section className="space-y-4">
            <div className="space-y-2">
              <Button asChild variant="ghost" className="-ml-3">
                <Link to="/staff/classes">
                  <ArrowLeft />
                  Classes
                </Link>
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold">
                    {classData.classItem.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {classData.visibleGroups.length > 0 ? (
                      classData.visibleGroups.map((group) => (
                        <Badge key={group._id} variant="secondary">
                          {group.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">All groups</Badge>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground text-sm">
                  Enrollments{" "}
                  <span className="text-foreground font-medium">
                    {enrolledCount}
                    {classData.classItem.capacity !== undefined
                      ? `/${classData.classItem.capacity}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium">
                    {classData.classItem.location || "Not set"}
                  </div>
                </div>
              </div>
            </div>
            <Separator className="my-4 w-full" />
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Enrollments</h2>
              <p className="text-muted-foreground">
                Class enrollment roster and student information. Click on a
                student to view their contact information.
              </p>
            </div>
            <DataTable
              columns={columns}
              data={filteredEnrollments}
              filterColumn="student"
              filterPlaceholder="Filter students..."
              toolbar={
                <Select
                  value={enrollmentStatusFilter}
                  onValueChange={(value) =>
                    setEnrollmentStatusFilter(value as EnrollmentStatusFilter)
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
          </section>
        </main>
      )}
    </RoleGate>
  );
}
