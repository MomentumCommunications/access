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

const columns: ColumnDef<Doc<"classes">>[] = [
  {
    accessorKey: "title",
    header: "Class",
    cell: ({ row }) => (
      <Button asChild variant="link" className="h-auto p-0">
        <Link
          to="/staff/classes/$classId"
          params={{ classId: row.original._id }}
        >
          {row.original.title}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "scheduleSummary",
    header: "Schedule",
    cell: ({ row }) => row.original.scheduleSummary || "Not set",
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
