import { useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { useState } from "react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";

export const Route = createFileRoute("/_app/staff/classes")({
  component: StaffClassesPage,
});

type StaffClassRow = {
  classItem: Doc<"classes">;
  enrollments: Doc<"classEnrollments">[];
  sessionSignups: Doc<"classSessionSignups">[];
};

const columns: ColumnDef<StaffClassRow>[] = [
  {
    accessorKey: "classItem.title",
    id: "title",
    header: "Class",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/staff/classes/$classId"
          params={{ classId: row.original.classItem._id }}
        >
          {row.original.classItem.title}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "classItem.scheduleSummary",
    header: "Schedule",
    cell: ({ row }) => row.original.classItem.scheduleSummary || "Not set",
  },
  {
    id: "capacity",
    header: "Capacity",
    cell: ({ row }) => {
      const { classItem, enrollments, sessionSignups } = row.original;
      const activeEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === "enrolled",
      );
      if (classItem.enrollmentMode === "per_session") {
        const countBySession = new Map<string, number>();
        for (const signup of sessionSignups) {
          if (signup.status !== "pending" && signup.status !== "enrolled") {
            continue;
          }
          countBySession.set(
            signup.session,
            (countBySession.get(signup.session) || 0) + 1,
          );
        }
        const highestSessionCount = Math.max(0, ...countBySession.values());
        return classItem.capacity === undefined
          ? `${highestSessionCount} selected`
          : `${highestSessionCount}/${classItem.capacity} per session`;
      }
      return classItem.capacity === undefined
        ? `${enrollments.length} enrolled`
        : `${activeEnrollments.length}/${classItem.capacity}`;
    },
  },
];

function StaffClassesPage() {
  const [showAll, setShowAll] = useState(false);
  const classes = useConvexQuery(api.classes.staffListClasses, { showAll });

  return (
    <RoleGate allow="staff">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              {showAll
                ? "Showing every class."
                : "Showing classes assigned to you."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="staff-show-all-classes"
              checked={showAll}
              onCheckedChange={setShowAll}
            />
            <Label htmlFor="staff-show-all-classes">Show all classes</Label>
          </div>
        </div>
        {classes === undefined ? (
          <div className="min-h-40 flex items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={classes}
            filterColumn="title"
            filterPlaceholder="Filter classes..."
          />
        )}
      </main>
    </RoleGate>
  );
}
