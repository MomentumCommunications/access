import { useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/admin/classes/")({
  component: AdminClassesPage,
});

type ClassRow = {
  classItem: Doc<"classes">;
  enrollments: Doc<"classEnrollments">[];
  sessions: Doc<"sessions">[];
};

const columns: ColumnDef<ClassRow>[] = [
  {
    accessorKey: "classItem.title",
    id: "title",
    header: "Class",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/classes/$classId"
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
    cell: ({ row }) =>
      `${row.original.enrollments.length}/${row.original.classItem.capacity}`,
  },
  {
    accessorKey: "classItem.status",
    header: "Status",
    cell: ({ row }) => row.original.classItem.status,
  },
  {
    accessorKey: "classItem.location",
    header: "Location",
    cell: ({ row }) => row.original.classItem.location || "Not set",
  },
];

function AdminClassesPage() {
  const classes = useConvexQuery(api.classes.adminListClasses, {});

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              Manage class details, sessions, and enrollments.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/classes/create">
              <Plus />
              Create Class
            </Link>
          </Button>
        </div>
        {classes === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
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
