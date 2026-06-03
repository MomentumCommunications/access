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
import { formatAge } from "~/lib/date-utils";

export const Route = createFileRoute("/_app/admin/students/")({
  component: AdminStudentsPage,
});

type StudentRow = {
  student: Doc<"students">;
  contacts: Doc<"studentContacts">[];
};

const columns: ColumnDef<StudentRow>[] = [
  {
    accessorFn: (row) => `${row.student.firstName} ${row.student.lastName}`,
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/admin/students/$studentId"
          params={{ studentId: row.original.student._id }}
        >
          {row.original.student.firstName} {row.original.student.lastName}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "student.preferredName",
    header: "Preferred",
    cell: ({ row }) => row.original.student.preferredName || "Not set",
  },
  {
    accessorKey: "student.status",
    header: "Status",
    cell: ({ row }) => row.original.student.status,
  },
  {
    accessorKey: "student.dateOfBirth",
    header: "Birthday",
    cell: ({ row }) => row.original.student.dateOfBirth || "Not set",
  },
  {
    id: "age",
    header: "Age",
    cell: ({ row }) => formatAge(row.original.student.dateOfBirth),
  },
  {
    id: "contacts",
    header: "Contacts",
    cell: ({ row }) => row.original.contacts.length,
  },
];

function AdminStudentsPage() {
  const students = useConvexQuery(api.classes.adminListStudents, {});

  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">
              Student profiles are separate from login accounts.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/admin/students/create">
              <Plus />
              Add Student
            </Link>
          </Button>
        </div>
        {students === undefined ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={students}
            filterColumn="name"
            filterPlaceholder="Filter students..."
          />
        )}
      </main>
    </RoleGate>
  );
}
