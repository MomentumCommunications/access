import { useConvexQuery } from "@convex-dev/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Doc } from "convex/_generated/dataModel";
import { DataTable } from "~/components/data-table";
import { RoleGate } from "~/components/role-gate";
import { Spinner } from "~/components/ui/spinner";

export const Route = createFileRoute("/_app/staff/classes")({
  component: StaffClassesPage,
});

const columns: ColumnDef<Doc<"classes">>[] = [
  {
    accessorKey: "title",
    header: "Class",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "scheduleSummary",
    header: "Schedule",
    cell: ({ row }) => row.original.scheduleSummary || "Not set",
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => row.original.location || "Not set",
  },
];

function StaffClassesPage() {
  const classes = useConvexQuery(api.classes.staffListClasses, {});

  return (
    <RoleGate allow="staff">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">My Classes</h1>
          <p className="text-muted-foreground">
            Classes assigned to you. Admins can see all classes.
          </p>
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
